import express from "express";
import { prisma } from "../prisma.js";
import { requireAuth } from "../middleware/auth.js";
import {
  searchLocal, ensureUnits, ingestUnits, getDocWithUnits,
  getCatalogStatus, syncCatalog, SkkniError, listCategories,
  ensureExamPackage, buildShuffledInstance, courseCoverage, COURSE_UNITS,
  ensureUnitExamPackage, buildUnitExamInstance, unitStates, ensureCompetencyWeight, gradeFreeText,
} from "../skkni.js";
import { isLlmConfigured } from "../llm.js";
import { awardOnce, COIN } from "../gamification.js";
import { refreshReadiness } from "../readiness.js";
import { refreshRank } from "../rankcalc.js";

// Kompetensi SKKNI = acuan utama semua perhitungan (skill, soal, syarat naik level).
// User memilih 1 dokumen SKKNI (profesi/bidang) sebagai target → jadi patokan fitur lain.
const router = express.Router();
router.use(requireAuth);

// Pencarian kompetensi dari katalog lokal (hasil sinkron dari Kemnaker), bisa difilter kategori.
router.get("/search", async (req, res) => {
  const offset = parseInt(req.query.offset, 10) || 0;
  const { items, total } = await searchLocal(req.query.q, req.query.category, 100, offset);
  const status = await getCatalogStatus();
  res.json({ items, total, offset, catalog: status });
});

// Daftar kategori umum + jumlah kompetensi (untuk chip filter).
router.get("/categories", async (req, res) => {
  res.json({ categories: await listCategories() });
});

// Status sinkron katalog (untuk indikator "sedang mengambil daftar SKKNI…").
router.get("/catalog-status", async (req, res) => {
  res.json(await getCatalogStatus());
});

// Detail 1 dokumen + unit (dari cache; tarik dari Kemnaker bila belum pernah di-cache).
router.get("/documents/:id", async (req, res) => {
  try {
    const doc = await ensureUnits(req.params.id);
    if (!doc) return res.status(404).json({ error: "Dokumen tidak ditemukan." });
    res.json(doc);
  } catch (e) {
    const status = e instanceof SkkniError ? e.status : 502;
    res.status(status).json({ error: e.message || "Gagal mengambil unit SKKNI." });
  }
});

// User menetapkan kompetensi target. Menetapkan pilihan SEKETIKA (dari katalog lokal),
// lalu menarik unit di LATAR BELAKANG bila belum ter-cache — agar klien tak perlu menunggu
// throttle Kemnaker (yang bisa >30dtk dan memicu timeout). Klien poll /skkni/chosen.
router.post("/choose", async (req, res) => {
  const docId = String(req.body?.docId ?? "").trim();
  if (!docId) return res.status(400).json({ error: "docId wajib diisi." });
  try {
    let doc = await prisma.skkniDocument.findUnique({ where: { id: docId } });
    // Jarang: dokumen belum ada di katalog lokal → tarik dulu (ini bisa lama, tapi kasusnya langka).
    if (!doc) {
      const full = await ensureUnits(docId);
      if (!full) return res.status(404).json({ error: "Dokumen SKKNI tidak ditemukan." });
      doc = await prisma.skkniDocument.findUnique({ where: { id: docId } });
    }
    const title = (doc.title || "").replace(/^SKKNI\s+/i, "").trim() || doc.title;
    await prisma.user.update({ where: { id: req.user.id }, data: { chosenSkkniId: doc.id, chosenSkkniTitle: title } });

    if (doc.unitsCached) {
      ensureCompetencyWeight(doc.id).catch((e) => console.warn("[skkni] weight bg:", e.message));
      return res.json({ ok: true, ready: true, chosen: { id: doc.id, title, unitCount: doc.unitCount } });
    }
    // Belum ada unit → tarik di latar belakang (lewat antrean throttle). Tidak menunggu.
    // Setelah unit ter-cache, klasifikasi bobot kompetensi (cap rank).
    ingestUnits(doc.id).then(() => ensureCompetencyWeight(doc.id)).catch((e) => console.warn("[skkni] ingest/weight bg:", e.message));
    res.json({ ok: true, ready: false, chosen: { id: doc.id, title } });
  } catch (e) {
    const status = e instanceof SkkniError ? e.status : 502;
    res.status(status).json({ error: e.message || "Gagal menetapkan kompetensi." });
  }
});

// Kompetensi yang sedang dipilih user + unit-unitnya.
router.get("/chosen", async (req, res) => {
  const u = await prisma.user.findUnique({ where: { id: req.user.id }, select: { chosenSkkniId: true, chosenSkkniTitle: true } });
  if (!u?.chosenSkkniId) return res.json({ chosen: null });
  const doc = await getDocWithUnits(u.chosenSkkniId);
  res.json({ chosen: { id: u.chosenSkkniId, title: u.chosenSkkniTitle }, doc });
});

// ── Ujian kompetensi berbasis unit SKKNI pilihan user ────────────────────────
function shapeExam(questions, u, coverage, pkg) {
  return {
    source: "skkni",
    competencyTitle: u.chosenSkkniTitle,
    timeLimit: 20,
    totalQuestions: questions.length,
    courseUnits: pkg?.unitCount,
    coverage,
    questions: questions.map((q, i) => ({
      id: i, competencyCode: q.unitCode, competencyName: q.unitTitle, question: q.q, options: q.options,
    })),
  };
}

// Ambil ujian: pakai instance teracak yang aktif; kalau belum ada, buat dari PAKET course
// (di-generate sekali & disimpan di library), lalu acak urutan soal + opsi.
router.get("/exam", async (req, res) => {
  const userId = req.user.id;
  const u = await prisma.user.findUnique({ where: { id: userId }, select: { chosenSkkniId: true, chosenSkkniTitle: true, currentKkniLevel: true } });
  if (!u?.chosenSkkniId) return res.status(400).json({ error: "Belum memilih kompetensi SKKNI. Pilih di halaman Profil dulu." });

  // Instance aktif (biar refresh saat mengerjakan tetap konsisten).
  const active = await prisma.skkniExam.findUnique({ where: { userId_docId: { userId, docId: u.chosenSkkniId } } });
  if (active) {
    const pkg = await prisma.examPackage.findUnique({ where: { docId: u.chosenSkkniId } });
    const coverage = pkg ? await courseCoverage(userId, pkg) : null;
    return res.json(shapeExam(JSON.parse(active.questions), u, coverage, pkg));
  }

  if (!isLlmConfigured()) return res.status(503).json({ error: "Ujian SKKNI membutuhkan AI yang aktif. Hubungi admin." });

  let pkg;
  try { pkg = await ensureExamPackage(u.chosenSkkniId, u.chosenSkkniTitle); }
  catch (e) { return res.status(502).json({ error: "Gagal menyiapkan paket soal: " + e.message }); }
  if (!pkg) return res.status(503).json({ error: "Dokumen ini belum memiliki unit kompetensi terdigitasi di Kemnaker." });

  const instance = buildShuffledInstance(pkg);      // acak urutan soal + opsi
  await prisma.skkniExam.upsert({
    where: { userId_docId: { userId, docId: u.chosenSkkniId } },
    create: { userId, docId: u.chosenSkkniId, questions: JSON.stringify(instance) },
    update: { questions: JSON.stringify(instance) },
  });
  const coverage = await courseCoverage(userId, pkg);
  res.json(shapeExam(instance, u, coverage, pkg));
});

router.post("/exam/submit", async (req, res) => {
  try {
    const userId = req.user.id;
    const answers = req.body?.answers ?? {};
    const u = await prisma.user.findUnique({ where: { id: userId } });
    if (!u?.chosenSkkniId) return res.status(400).json({ error: "Belum memilih kompetensi SKKNI." });

    const exam = await prisma.skkniExam.findUnique({ where: { userId_docId: { userId, docId: u.chosenSkkniId } } });
    if (!exam) return res.status(400).json({ error: "Ambil soal ujian dulu." });
    const questions = JSON.parse(exam.questions);

    // Skor per unit (rata-rata benar dari soal-soal unit itu).
    const byUnit = {};
    questions.forEach((q, i) => {
      const code = q.unitCode;
      (byUnit[code] ??= { name: q.unitTitle, correct: 0, total: 0 }).total++;
      if (Number(answers[i]) === q.answerKey) byUnit[code].correct++;
    });
    const results = Object.entries(byUnit).map(([code, v]) => {
      const score = Math.round((v.correct / v.total) * 100);
      return { competencyCode: code, name: v.name, score, passed: score >= 60, gap: score < 60 };
    });

    // Tulis SkillAssessment per unit → dibaca Skill Gap Analyzer.
    await Promise.all(results.map((r) =>
      prisma.skillAssessment.upsert({
        where: { userId_competencyCode: { userId, competencyCode: r.competencyCode } },
        update: { competencyName: r.name, currentScore: r.score, gap: 100 - r.score },
        create: { userId, competencyCode: r.competencyCode, competencyName: r.name, currentScore: r.score, requiredScore: 100, gap: 100 - r.score },
      })
    ));

    // Skor ujian = % unit course yang lulus pada percobaan ini.
    const pkg = await prisma.examPackage.findUnique({ where: { docId: u.chosenSkkniId } });
    const cov = pkg ? await courseCoverage(userId, pkg)
      : { total: results.length, assessed: results.length, passed: results.filter((r) => r.passed).length };
    const readiness = results.length ? Math.round((results.filter((r) => r.passed).length / results.length) * 100) : 0;
    const status = readiness >= 80 ? "ready" : readiness >= 50 ? "in_progress" : "not_ready";

    const attempt = await prisma.examAttempt.create({
      data: {
        userId, kkniLevel: u.currentKkniLevel || 1, answers: JSON.stringify(answers),
        scorePerCompetency: JSON.stringify(Object.fromEntries(results.map((r) => [r.competencyCode, r.score]))),
        results: JSON.stringify(results), readinessScore: readiness, status, passed: readiness >= 80,
        gaps: JSON.stringify(results.filter((r) => r.gap)),
      },
    });

    // Sertifikat per unit yang lulus (idempoten per unit).
    const newCerts = [];
    try {
      for (const r of results.filter((r) => r.passed)) {
        const c = await prisma.certificate.upsert({
          where: { userId_competencyCode_source: { userId, competencyCode: r.competencyCode, source: "exam" } },
          update: { score: r.score },
          create: { userId, competencyCode: r.competencyCode, name: r.name, kkniLevel: u.currentKkniLevel || null, score: r.score, source: "exam" },
        });
        newCerts.push(c.name);
      }
    } catch (e) { console.error("skkni cert:", e.message); }

    let coin = null;
    try { coin = await awardOnce(userId, COIN.exam, "Ujian kompetensi SKKNI", { type: "skkniexam", id: attempt.id }); } catch { /* non-fatal */ }
    await prisma.notification.create({ data: { userId, type: "exam_result", message: `Ujian SKKNI selesai: skor ${readiness}% (${cov.assessed}/${cov.total} unit dinilai)` } }).catch(() => {});

    // Kompetensi terbukti → perbarui rank efektif + skor kesiapan gabungan.
    const rank = await refreshRank(userId).catch(() => null);
    const overall = await refreshReadiness(userId).catch(() => null);

    // Hapus batch → GET berikutnya menghasilkan batch unit baru (cakupan bertambah).
    await prisma.skkniExam.delete({ where: { id: exam.id } }).catch(() => {});

    res.json({ source: "skkni", results, readiness, status, gaps: results.filter((r) => r.gap), coin, certificates: newCerts, coverage: cov, courseUnits: pkg?.unitCount, retake: true, attemptId: attempt.id, overallReadiness: overall?.total, rank });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ── Ujian PER-UNIT kompetensi (granular, jumlah soal variatif) ───────────────
// Ujian 1 unit hanya terbuka bila kelasnya selesai / dibuka koin (state "ready").
function shapeUnitExam(instance, unit, competencyTitle) {
  return {
    source: "skkni-unit",
    competencyTitle,
    unitCode: unit.code,
    unitTitle: unit.title,
    // Isian & urutan butuh waktu lebih: MC ~1 mnt, isian/urutan ~4 mnt.
    timeLimit: instance.reduce((t, q) => t + ((q.type || "mc") === "mc" ? 1 : 4), 0) || 10,
    totalQuestions: instance.length,
    questions: instance.map((q, i) => ({
      id: i, type: q.type || "mc", competencyCode: unit.code, competencyName: unit.title,
      question: q.q, options: (q.type || "mc") === "mc" ? q.options : undefined, // jawaban/acuan tak dikirim
    })),
  };
}

router.get("/exam/:code", async (req, res) => {
  const userId = req.user.id;
  const code = req.params.code;
  const u = await prisma.user.findUnique({ where: { id: userId }, select: { chosenSkkniId: true, chosenSkkniTitle: true } });
  if (!u?.chosenSkkniId) return res.status(400).json({ error: "Belum memilih kompetensi SKKNI." });
  const unit = await prisma.skkniUnit.findFirst({ where: { documentId: u.chosenSkkniId, code } });
  if (!unit) return res.status(404).json({ error: "Unit tidak ditemukan." });

  // Gating: unit harus "ready" (kelas selesai / dibuka koin) atau sudah "passed" (boleh ujian ulang).
  const states = await unitStates(userId, u.chosenSkkniId);
  const st = states.find((s) => s.code === code);
  if (st && (st.state === "locked" || st.state === "learning")) {
    return res.status(403).json({ error: "Selesaikan kelas unit ini dulu untuk membuka ujiannya.", state: st });
  }

  // Instance aktif → konsisten saat refresh.
  const active = await prisma.unitExamInstance.findUnique({ where: { userId_unitCode: { userId, unitCode: code } } });
  if (active) return res.json(shapeUnitExam(JSON.parse(active.questions), unit, u.chosenSkkniTitle));

  if (!isLlmConfigured()) return res.status(503).json({ error: "Ujian butuh AI aktif. Hubungi admin." });
  let pkg;
  try { pkg = await ensureUnitExamPackage(u.chosenSkkniId, { code: unit.code, title: unit.title }); }
  catch (e) { return res.status(502).json({ error: "Gagal menyiapkan soal: " + e.message }); }
  if (!pkg) return res.status(503).json({ error: "Unit ini belum bisa dibuatkan soal." });

  const instance = buildUnitExamInstance(pkg);
  await prisma.unitExamInstance.upsert({
    where: { userId_unitCode: { userId, unitCode: code } },
    create: { userId, docId: u.chosenSkkniId, unitCode: code, unitTitle: unit.title, questions: JSON.stringify(instance) },
    update: { questions: JSON.stringify(instance) },
  });
  res.json(shapeUnitExam(instance, unit, u.chosenSkkniTitle));
});

router.post("/exam/:code/submit", async (req, res) => {
  try {
    const userId = req.user.id;
    const code = req.params.code;
    const answers = req.body?.answers ?? {};
    const u = await prisma.user.findUnique({ where: { id: userId } });
    if (!u?.chosenSkkniId) return res.status(400).json({ error: "Belum memilih kompetensi SKKNI." });

    const inst = await prisma.unitExamInstance.findUnique({ where: { userId_unitCode: { userId, unitCode: code } } });
    if (!inst) return res.status(400).json({ error: "Ambil soal ujian dulu." });
    const questions = JSON.parse(inst.questions);

    // MC dinilai otomatis; isian/urutan dinilai AI (gradeFreeText). Skor unit = rata-rata semua soal.
    const perQ = {};        // index → { score, feedback }
    const freeItems = [];
    questions.forEach((q, i) => {
      const type = q.type || "mc";
      if (type === "mc") {
        perQ[i] = { score: Number(answers[i]) === q.answerKey ? 100 : 0, feedback: null };
      } else {
        freeItems.push({ index: i, type, q: q.q, answer: typeof answers[i] === "string" ? answers[i] : "", keyPoints: q.keyPoints, idealSteps: q.idealSteps });
      }
    });
    if (freeItems.length) {
      let graded = {};
      try { graded = await gradeFreeText(inst.unitTitle, freeItems); } catch (e) { console.error("gradeFreeText:", e.message); }
      for (const it of freeItems) {
        const g = graded[it.index] || { score: (it.answer || "").trim().length >= 25 ? 50 : 0, feedback: "Belum bisa dinilai AI." };
        perQ[it.index] = g;
      }
    }
    const score = questions.length ? Math.round(Object.values(perQ).reduce((a, b) => a + (b.score || 0), 0) / questions.length) : 0;
    const passed = score >= 60;
    // Review ala Quizizz (#3): sertakan jawaban USER + jawaban BENAR (MC) agar user tahu
    // persis apa yang salah & bisa dipelajari ulang. Untuk isian/urutan: jawaban user +
    // feedback AI (rubrik keyPoints/idealSteps tetap privat — menjaga keabsahan tes ulang).
    const breakdown = questions.map((q, i) => {
      const type = q.type || "mc";
      const base = { question: q.q, type, score: perQ[i]?.score ?? 0, feedback: perQ[i]?.feedback || null };
      if (type === "mc") {
        const chosen = Number(answers[i]);
        return {
          ...base,
          options: q.options,
          userAnswer: Number.isInteger(chosen) && q.options?.[chosen] != null ? q.options[chosen] : null,
          correctAnswer: q.options?.[q.answerKey] ?? null,
          isCorrect: chosen === q.answerKey,
        };
      }
      return { ...base, userAnswer: typeof answers[i] === "string" ? answers[i] : "", isCorrect: (perQ[i]?.score ?? 0) >= 60 };
    });

    // SkillAssessment unit → dibaca Skill Gap / rank / readiness.
    await prisma.skillAssessment.upsert({
      where: { userId_competencyCode: { userId, competencyCode: code } },
      update: { competencyName: inst.unitTitle, currentScore: score, gap: 100 - score },
      create: { userId, competencyCode: code, competencyName: inst.unitTitle, currentScore: score, requiredScore: 100, gap: 100 - score },
    });

    const attempt = await prisma.examAttempt.create({
      data: {
        userId, kkniLevel: u.currentKkniLevel || 1, answers: JSON.stringify(answers),
        scorePerCompetency: JSON.stringify({ [code]: score }),
        results: JSON.stringify([{ competencyCode: code, name: inst.unitTitle, score, passed, gap: !passed }]),
        readinessScore: score, status: passed ? "ready" : "not_ready", passed,
        gaps: JSON.stringify(passed ? [] : [{ competencyCode: code, name: inst.unitTitle, score, gap: true }]),
      },
    });

    // Sertifikat unit HANYA bila lulus ujian (idempoten per unit).
    let certificate = null;
    if (passed) {
      try {
        const c = await prisma.certificate.upsert({
          where: { userId_competencyCode_source: { userId, competencyCode: code, source: "exam" } },
          update: { score },
          create: { userId, competencyCode: code, name: inst.unitTitle, kkniLevel: u.currentKkniLevel || null, score, source: "exam" },
        });
        certificate = c.name;
      } catch (e) { console.error("unit cert:", e.message); }
    }

    let coin = null;
    try { coin = await awardOnce(userId, COIN.exam, `Ujian unit: ${inst.unitTitle}`, { type: "unitexam", id: attempt.id }); } catch { /* non-fatal */ }
    await prisma.notification.create({ data: { userId, type: "exam_result", message: `Ujian unit "${inst.unitTitle}": skor ${score}%${passed ? " — LULUS, sertifikat terbit" : ""}` } }).catch(() => {});

    const rank = await refreshRank(userId).catch(() => null);
    const overall = await refreshReadiness(userId).catch(() => null);

    await prisma.unitExamInstance.delete({ where: { id: inst.id } }).catch(() => {});
    const states = await unitStates(userId, u.chosenSkkniId);

    // Simpan review ke riwayat (#3) — bisa dibuka kembali untuk dipelajari.
    let reviewId = null;
    try {
      const rev = await prisma.unitExamReview.create({
        data: { userId, unitCode: code, unitTitle: inst.unitTitle, score, passed, breakdown: JSON.stringify(breakdown) },
      });
      reviewId = rev.id;
    } catch (e) { console.error("save review:", e.message); }

    res.json({
      source: "skkni-unit", unitCode: code, unitTitle: inst.unitTitle,
      score, passed, total: questions.length, breakdown, certificate, coin,
      rank, overallReadiness: overall?.total, attemptId: attempt.id, reviewId, units: states, retake: true,
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ── Riwayat ujian unit (#3) — daftar + detail review untuk dipelajari kembali ──
router.get("/exam-history", async (req, res) => {
  const rows = await prisma.unitExamReview.findMany({
    where: { userId: req.user.id },
    orderBy: { createdAt: "desc" },
    take: 50,
    select: { id: true, unitCode: true, unitTitle: true, score: true, passed: true, createdAt: true },
  });
  res.json({ items: rows });
});

router.get("/exam-history/:id", async (req, res) => {
  const row = await prisma.unitExamReview.findUnique({ where: { id: req.params.id } });
  if (!row || row.userId !== req.user.id) return res.status(404).json({ error: "Riwayat tidak ditemukan." });
  res.json({ ...row, breakdown: JSON.parse(row.breakdown) });
});

// Trigger manual sinkron katalog (mis. dari admin) — jalan di latar belakang.
router.post("/sync-catalog", async (req, res) => {
  if (req.user.role !== "admin") return res.status(403).json({ error: "Hanya admin." });
  syncCatalog().catch((e) => console.warn("[skkni] sync:", e.message));
  res.json({ ok: true, message: "Sinkron katalog SKKNI berjalan di latar belakang." });
});

export default router;
