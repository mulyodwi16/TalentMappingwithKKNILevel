import express from "express";
import { UNIT_MASTERY } from "../thresholds.js";

// Ambang tampilan "jawaban uraian ini dianggap benar" di layar review per soal. SENGAJA
// terpisah dari UNIT_MASTERY walau angkanya kebetulan sama: yang ini menilai SATU jawaban,
// yang itu menyatakan seseorang menguasai satu unit kompetensi. Kalau digabung, mengubah
// ambang penguasaan akan diam-diam mengubah centang hijau di lembar review.
const ANSWER_OK_SCORE = 60;
import { prisma } from "../prisma.js";
import { requireAuth } from "../middleware/auth.js";
import {
  searchLocal, ensureUnits, ingestUnits, getDocWithUnits,
  getCatalogStatus, syncCatalog, SkkniError, listCategories,
  ensureExamPackage, buildShuffledInstance, courseCoverage, COURSE_UNITS,
  ensureUnitExamPackage, buildUnitExamInstance, unitStates, ensureCompetencyWeight, gradeFreeText,
  prepareDoc, getPrepareState,
  ensurePlacementPackage, buildPlacementInstance, reviewPlacement, PLACEMENT_MINUTES_PER_UNIT,
  ensureFinalExamPackage, FINAL_PASS_SCORE, FINAL_MINUTES_PER_UNIT,
} from "../skkni.js";
import { isLlmConfigured } from "../llm.js";
import { awardOnce, COIN } from "../gamification.js";
import { refreshReadiness } from "../readiness.js";
import { refreshRank } from "../rankcalc.js";

// Kompetensi SKKNI = acuan utama semua perhitungan (skill, soal, syarat naik level).
// User memilih 1 dokumen SKKNI (profesi/bidang) sebagai target → jadi patokan fitur lain.
const router = express.Router();

// ── Endpoint KATALOG (PUBLIK, tanpa auth) ────────────────────────────────────
// Data katalog SKKNI bukan data user. WAJIB publik karena wizard Register fase 2 memakai
// picker ini SEBELUM akun dibuat (akun baru dibuat saat fase 3 lolos → belum ada token).

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

// ── Endpoint di bawah ini butuh login (data/aksi milik user + akses Kemnaker) ──
router.use(requireAuth);

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
// lalu menarik unit di LATAR BELAKANG bila belum ter-cache - agar klien tak perlu menunggu
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
    // Klien memantau lewat GET /skkni/prepare/:docId sampai siap.
    prepareDoc(doc.id);
    res.json({ ok: true, ready: false, chosen: { id: doc.id, title } });
  } catch (e) {
    const status = e instanceof SkkniError ? e.status : 502;
    res.status(status).json({ error: e.message || "Gagal menetapkan kompetensi." });
  }
});

// Status penyiapan kompetensi. Dipakai layar tunggu di klien supaya user baru tidak
// masuk dashboard sebelum unit kompetensinya benar-benar terpasang.
router.get("/prepare/:docId", async (req, res) => {
  const docId = String(req.params.docId || "").trim();
  const doc = await prisma.skkniDocument.findUnique({
    where: { id: docId },
    select: { title: true, unitsCached: true, unitCount: true },
  });
  if (!doc) return res.status(404).json({ error: "Dokumen SKKNI tidak ditemukan." });
  const st = getPrepareState(docId);
  const ready = !!doc.unitsCached;
  res.json({
    ready,
    unitCount: doc.unitCount || 0,
    // Dokumen terbitan terbaru kadang belum dirinci Kemnaker: siap, tapi tanpa unit.
    empty: ready && (doc.unitCount || 0) === 0,
    state: st?.state || (ready ? "done" : "idle"),
    error: st?.state === "error" ? st.error : null,
  });
});

// Kompetensi yang sedang dipilih user + unit-unitnya.
router.get("/chosen", async (req, res) => {
  const u = await prisma.user.findUnique({ where: { id: req.user.id }, select: { chosenSkkniId: true, chosenSkkniTitle: true } });
  if (!u?.chosenSkkniId) return res.json({ chosen: null });
  const doc = await getDocWithUnits(u.chosenSkkniId);
  res.json({ chosen: { id: u.chosenSkkniId, title: u.chosenSkkniTitle }, doc });
});

// ── Tes Penempatan ───────────────────────────────────────────────────────────
// Baseline awal: 2 soal per unit (1 pilihan ganda + 1 isian). Mengisi Skill Gap &
// memberi acuan Learning Path, serta membebaskan user dari mengulang yang sudah dikuasai.
// TIDAK menerbitkan sertifikat - sertifikat hanya dari ujian kompetensi utama.

function safeArr(s) {
  try { const v = JSON.parse(s || "[]"); return Array.isArray(v) ? v : []; } catch { return []; }
}

async function chosenDoc(userId) {
  const u = await prisma.user.findUnique({ where: { id: userId }, select: { chosenSkkniId: true, chosenSkkniTitle: true } });
  return u?.chosenSkkniId ? u : null;
}

// Status tes penempatan untuk kompetensi yang sedang dipilih.
router.get("/placement", async (req, res) => {
  const u = await chosenDoc(req.user.id);
  if (!u) return res.json({ available: false, reason: "no-competency" });
  const [attempt, inst, unitCount] = await Promise.all([
    prisma.placementAttempt.findUnique({ where: { userId_docId: { userId: req.user.id, docId: u.chosenSkkniId } } }).catch(() => null),
    prisma.placementInstance.findUnique({ where: { userId: req.user.id } }).catch(() => null),
    prisma.skkniUnit.count({ where: { documentId: u.chosenSkkniId } }),
  ]);
  res.json({
    available: unitCount > 0 && isLlmConfigured(),
    reason: unitCount === 0 ? "no-units" : !isLlmConfigured() ? "no-llm" : null,
    competencyTitle: u.chosenSkkniTitle,
    unitCount,
    inProgress: !!inst && inst.docId === u.chosenSkkniId,
    expiresAt: inst && inst.docId === u.chosenSkkniId ? inst.expiresAt : null,
    minutesPerUnit: PLACEMENT_MINUTES_PER_UNIT,
    taken: attempt
      ? { score: attempt.score, unitCount: attempt.unitCount, passedUnits: attempt.passedUnits, takenAt: attempt.takenAt, breakdown: safeArr(attempt.breakdown), review: attempt.review }
      : null,
  });
});

// Mulai / lanjutkan tes. Kunci jawaban TIDAK pernah dikirim ke klien.
router.post("/placement/start", async (req, res) => {
  const u = await chosenDoc(req.user.id);
  if (!u) return res.status(400).json({ error: "Pilih kompetensi target dulu." });
  if (!isLlmConfigured()) return res.status(503).json({ error: "Penyusun soal sedang tidak tersedia. Coba lagi nanti." });
  try {
    let inst = await prisma.placementInstance.findUnique({ where: { userId: req.user.id } });
    if (!inst || inst.docId !== u.chosenSkkniId) {
      const pkg = await ensurePlacementPackage(u.chosenSkkniId);
      if (!pkg) return res.status(503).json({ error: "Belum bisa menyusun soal untuk kompetensi ini." });
      const questions = buildPlacementInstance(pkg);
      // Waktu mengikuti jumlah unit, bukan angka tetap: kompetensi 5 unit dan 12 unit
      // jelas tak layak diberi durasi sama.
      const unitCount = new Set(questions.map((q) => q.unitCode)).size;
      const expiresAt = new Date(Date.now() + unitCount * PLACEMENT_MINUTES_PER_UNIT * 60_000);
      inst = await prisma.placementInstance.upsert({
        where: { userId: req.user.id },
        update: { docId: u.chosenSkkniId, questions: JSON.stringify(questions), expiresAt, createdAt: new Date() },
        create: { userId: req.user.id, docId: u.chosenSkkniId, questions: JSON.stringify(questions), expiresAt },
      });
    }
    res.json({
      competencyTitle: u.chosenSkkniTitle,
      // Tenggat dari server: refresh di tengah tes melanjutkan sisa waktu, bukan mengulang.
      expiresAt: inst.expiresAt,
      questions: stripPlacementKeys(safeArr(inst.questions)),
    });
  } catch (e) {
    console.warn("[placement] start gagal:", e.message);
    res.status(502).json({ error: "Gagal menyiapkan tes penempatan." });
  }
});

// Buang kunci jawaban & poin acuan sebelum dikirim ke klien (jaga keabsahan tes ulang).
function stripPlacementKeys(qs) {
  return qs.map((q, i) => ({
    index: i,
    unitCode: q.unitCode,
    unitTitle: q.unitTitle,
    type: q.type,
    q: q.q,
    ...(q.type === "mc" ? { options: q.options } : {}),
  }));
}

router.post("/placement/submit", async (req, res) => {
  const userId = req.user.id;
  const u = await chosenDoc(userId);
  if (!u) return res.status(400).json({ error: "Pilih kompetensi target dulu." });
  const inst = await prisma.placementInstance.findUnique({ where: { userId } });
  if (!inst || inst.docId !== u.chosenSkkniId) return res.status(400).json({ error: "Tes penempatan belum dimulai." });

  const questions = safeArr(inst.questions);
  const answers = req.body?.answers || {};
  const lang = String(req.headers["x-lang"] || req.body?.lang || "id").toLowerCase().startsWith("en") ? "en" : "id";
  try {
    // Pilihan ganda dinilai otomatis; isian dinilai AI terhadap poin acuan (server-side).
    const perQuestion = new Array(questions.length).fill(0);
    const feedbacks = {};
    const freeItems = [];
    questions.forEach((q, i) => {
      if (q.type === "mc") {
        perQuestion[i] = Number(answers[i]) === Number(q.answerKey) ? 100 : 0;
      } else {
        freeItems.push({ index: i, type: "situational", q: q.q, keyPoints: q.keyPoints || [], answer: String(answers[i] ?? "") });
      }
    });
    if (freeItems.length) {
      const graded = await gradeFreeText(u.chosenSkkniTitle || "Kompetensi", freeItems, lang).catch(() => ({}));
      for (const it of freeItems) {
        perQuestion[it.index] = graded[it.index]?.score ?? 0;
        if (graded[it.index]?.feedback) feedbacks[it.index] = graded[it.index].feedback;
      }
    }

    // Skor unit = rata-rata soal milik unit itu. Simpan juga catatan AI atas jawaban uraian
    // dan benar/salahnya pilihan ganda, supaya user tahu ALASAN nilainya.
    const byUnit = new Map();
    questions.forEach((q, i) => {
      const e = byUnit.get(q.unitCode) || { unitCode: q.unitCode, unitTitle: q.unitTitle, sum: 0, n: 0, mcCorrect: null, feedback: null };
      e.sum += perQuestion[i]; e.n += 1;
      if (q.type === "mc") e.mcCorrect = perQuestion[i] === 100;
      else if (feedbacks[i]) e.feedback = feedbacks[i];
      byUnit.set(q.unitCode, e);
    });
    const breakdown = [...byUnit.values()].map((e) => ({
      unitCode: e.unitCode, unitTitle: e.unitTitle, score: Math.round(e.sum / Math.max(1, e.n)),
      mcCorrect: e.mcCorrect, feedback: e.feedback,
    }));

    // Tulis baseline ke SkillAssessment (dipakai Skill Gap, tangga rank, Learning Path).
    for (const b of breakdown) {
      await prisma.skillAssessment.upsert({
        where: { userId_competencyCode: { userId, competencyCode: b.unitCode } },
        update: { currentScore: b.score, gap: Math.max(0, 100 - b.score), competencyName: b.unitTitle },
        create: { userId, competencyCode: b.unitCode, competencyName: b.unitTitle, currentScore: b.score, requiredScore: 100, gap: Math.max(0, 100 - b.score) },
      });
    }

    const passedUnits = breakdown.filter((b) => b.score >= UNIT_MASTERY).length;
    const overall = Math.round(breakdown.reduce((s, b) => s + b.score, 0) / Math.max(1, breakdown.length));
    const review = await reviewPlacement(u.chosenSkkniTitle || "Kompetensi", breakdown, lang);
    await prisma.placementAttempt.upsert({
      where: { userId_docId: { userId, docId: u.chosenSkkniId } },
      update: { score: overall, unitCount: breakdown.length, passedUnits, breakdown: JSON.stringify(breakdown), review, takenAt: new Date() },
      create: { userId, docId: u.chosenSkkniId, score: overall, unitCount: breakdown.length, passedUnits, breakdown: JSON.stringify(breakdown), review },
    });
    await prisma.placementInstance.delete({ where: { userId } }).catch(() => {});

    // Sengaja TIDAK menerbitkan sertifikat. Rank & kesiapan ikut baseline ini.
    const rank = await refreshRank(userId).catch(() => null);
    await refreshReadiness(userId).catch(() => {});
    try { await awardOnce(userId, COIN.classComplete, "Menyelesaikan Tes Penempatan", { type: "placement", id: u.chosenSkkniId }); } catch { /* non-fatal */ }

    res.json({ score: overall, passedUnits, unitCount: breakdown.length, breakdown, review, rank });
  } catch (e) {
    console.warn("[placement] submit gagal:", e.message);
    res.status(502).json({ error: "Gagal menilai tes penempatan." });
  }
});

// ── Ujian Kompetensi Utama ───────────────────────────────────────────────────
// SATU-SATUNYA penerbit sertifikat, dan sertifikatnya SATU per kompetensi.
// Boleh diambil kapan saja - user yang merasa sudah mampu tidak wajib melewati
// latihan unit satu per satu.

router.get("/final", async (req, res) => {
  const u = await chosenDoc(req.user.id);
  if (!u) return res.json({ available: false, reason: "no-competency" });
  const [cert, inst, unitCount] = await Promise.all([
    prisma.certificate.findUnique({
      where: { userId_competencyCode_source: { userId: req.user.id, competencyCode: u.chosenSkkniId, source: "competency" } },
    }).catch(() => null),
    prisma.competencyExamInstance.findUnique({ where: { userId: req.user.id } }).catch(() => null),
    prisma.skkniUnit.count({ where: { documentId: u.chosenSkkniId } }),
  ]);
  res.json({
    available: unitCount > 0 && isLlmConfigured(),
    reason: unitCount === 0 ? "no-units" : !isLlmConfigured() ? "no-llm" : null,
    competencyTitle: u.chosenSkkniTitle,
    unitCount,
    passScore: FINAL_PASS_SCORE,
    minutesPerUnit: FINAL_MINUTES_PER_UNIT,
    inProgress: !!inst && inst.docId === u.chosenSkkniId,
    expiresAt: inst && inst.docId === u.chosenSkkniId ? inst.expiresAt : null,
    certificate: cert ? { id: cert.id, name: cert.name, score: cert.score, issuedAt: cert.issuedAt } : null,
  });
});

router.post("/final/start", async (req, res) => {
  const u = await chosenDoc(req.user.id);
  if (!u) return res.status(400).json({ error: "Pilih kompetensi target dulu." });
  if (!isLlmConfigured()) return res.status(503).json({ error: "Penyusun soal sedang tidak tersedia. Coba lagi nanti." });
  try {
    let inst = await prisma.competencyExamInstance.findUnique({ where: { userId: req.user.id } });
    if (!inst || inst.docId !== u.chosenSkkniId) {
      const pkg = await ensureFinalExamPackage(u.chosenSkkniId);
      if (!pkg) return res.status(503).json({ error: "Belum bisa menyusun soal untuk kompetensi ini." });
      const questions = buildPlacementInstance(pkg);   // pengacakan opsi MC yang sama
      const unitCount = new Set(questions.map((q) => q.unitCode)).size;
      const expiresAt = new Date(Date.now() + unitCount * FINAL_MINUTES_PER_UNIT * 60_000);
      inst = await prisma.competencyExamInstance.upsert({
        where: { userId: req.user.id },
        update: { docId: u.chosenSkkniId, questions: JSON.stringify(questions), expiresAt, createdAt: new Date() },
        create: { userId: req.user.id, docId: u.chosenSkkniId, questions: JSON.stringify(questions), expiresAt },
      });
    }
    res.json({
      competencyTitle: u.chosenSkkniTitle,
      passScore: FINAL_PASS_SCORE,
      expiresAt: inst.expiresAt,
      questions: stripPlacementKeys(safeArr(inst.questions)),
    });
  } catch (e) {
    console.warn("[final] start gagal:", e.message);
    res.status(502).json({ error: "Gagal menyiapkan ujian kompetensi." });
  }
});

router.post("/final/submit", async (req, res) => {
  const userId = req.user.id;
  const u = await chosenDoc(userId);
  if (!u) return res.status(400).json({ error: "Pilih kompetensi target dulu." });
  const inst = await prisma.competencyExamInstance.findUnique({ where: { userId } });
  if (!inst || inst.docId !== u.chosenSkkniId) return res.status(400).json({ error: "Ujian belum dimulai." });

  const questions = safeArr(inst.questions);
  const answers = req.body?.answers || {};
  const lang = String(req.headers["x-lang"] || req.body?.lang || "id").toLowerCase().startsWith("en") ? "en" : "id";
  try {
    const perQuestion = new Array(questions.length).fill(0);
    const feedbacks = {};
    const freeItems = [];
    questions.forEach((q, i) => {
      if (q.type === "mc") perQuestion[i] = Number(answers[i]) === Number(q.answerKey) ? 100 : 0;
      else freeItems.push({ index: i, type: "situational", q: q.q, keyPoints: q.keyPoints || [], answer: String(answers[i] ?? "") });
    });
    if (freeItems.length) {
      const graded = await gradeFreeText(u.chosenSkkniTitle || "Kompetensi", freeItems, lang).catch(() => ({}));
      for (const it of freeItems) {
        perQuestion[it.index] = graded[it.index]?.score ?? 0;
        if (graded[it.index]?.feedback) feedbacks[it.index] = graded[it.index].feedback;
      }
    }

    const byUnit = new Map();
    questions.forEach((q, i) => {
      const e = byUnit.get(q.unitCode) || { unitCode: q.unitCode, unitTitle: q.unitTitle, sum: 0, n: 0, mcCorrect: null, feedback: null };
      e.sum += perQuestion[i]; e.n += 1;
      if (q.type === "mc") e.mcCorrect = perQuestion[i] === 100;
      else if (feedbacks[i]) e.feedback = feedbacks[i];
      byUnit.set(q.unitCode, e);
    });
    const breakdown = [...byUnit.values()].map((e) => ({
      unitCode: e.unitCode, unitTitle: e.unitTitle, score: Math.round(e.sum / Math.max(1, e.n)),
      mcCorrect: e.mcCorrect, feedback: e.feedback,
    }));

    // Skor unit tetap ditulis: ujian ini juga bukti penguasaan untuk Skill Gap & tangga rank.
    // Hanya ditulis bila LEBIH BAIK dari nilai yang sudah ada, agar hasil buruk di ujian
    // sertifikasi tidak menghapus penguasaan yang sudah terbukti sebelumnya.
    for (const b of breakdown) {
      const prev = await prisma.skillAssessment.findUnique({
        where: { userId_competencyCode: { userId, competencyCode: b.unitCode } },
      }).catch(() => null);
      if (prev && prev.currentScore >= b.score) continue;
      await prisma.skillAssessment.upsert({
        where: { userId_competencyCode: { userId, competencyCode: b.unitCode } },
        update: { currentScore: b.score, gap: Math.max(0, 100 - b.score), competencyName: b.unitTitle },
        create: { userId, competencyCode: b.unitCode, competencyName: b.unitTitle, currentScore: b.score, requiredScore: 100, gap: Math.max(0, 100 - b.score) },
      });
    }

    const score = Math.round(breakdown.reduce((s, b) => s + b.score, 0) / Math.max(1, breakdown.length));
    const passed = score >= FINAL_PASS_SCORE;

    // SATU sertifikat per kompetensi (kunci = docId + source "competency").
    let certificate = null;
    if (passed) {
      try {
        const rankNow = await prisma.user.findUnique({ where: { id: userId }, select: { currentKkniLevel: true } });
        certificate = await prisma.certificate.upsert({
          where: { userId_competencyCode_source: { userId, competencyCode: u.chosenSkkniId, source: "competency" } },
          update: { score, name: u.chosenSkkniTitle || "Kompetensi", kkniLevel: rankNow?.currentKkniLevel || null },
          create: {
            userId, competencyCode: u.chosenSkkniId, name: u.chosenSkkniTitle || "Kompetensi",
            kkniLevel: rankNow?.currentKkniLevel || null, score, source: "competency",
          },
        });
      } catch (e) { console.error("[final] sertifikat:", e.message); }
    }

    const review = await reviewPlacement(u.chosenSkkniTitle || "Kompetensi", breakdown, lang);
    await prisma.competencyExamInstance.delete({ where: { userId } }).catch(() => {});
    const rank = await refreshRank(userId).catch(() => null);
    await refreshReadiness(userId).catch(() => {});
    try { await awardOnce(userId, COIN.exam, "Ujian Kompetensi Utama", { type: "finalexam", id: u.chosenSkkniId }); } catch { /* non-fatal */ }
    await prisma.notification.create({
      data: { userId, type: "exam_result", message: `Ujian Kompetensi Utama: skor ${score}%${passed ? " - LULUS, sertifikat terbit" : ""}` },
    }).catch(() => {});

    res.json({ score, passed, passScore: FINAL_PASS_SCORE, breakdown, review, rank, certificate });
  } catch (e) {
    console.warn("[final] submit gagal:", e.message);
    res.status(502).json({ error: "Gagal menilai ujian kompetensi." });
  }
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
      return { competencyCode: code, name: v.name, score, passed: score >= UNIT_MASTERY, gap: score < 60 };
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

    // Ujian per unit = LATIHAN: memberi koin, progres, dan skor untuk Skill Gap & rank,
    // tapi TIDAK menerbitkan sertifikat. Sertifikat hanya satu per kompetensi, dari
    // Ujian Kompetensi Utama (lihat /skkni/final).
    const newCerts = [];

    let coin = null;
    // Penanda = docId kompetensi (bukan attempt.id yang selalu baru) supaya batch ini tak
    // bisa diulang untuk memanen koin. Lihat catatan yang sama di submit latihan per unit.
    try { coin = await awardOnce(userId, COIN.exam, "Ujian kompetensi SKKNI", { type: "skkniexam", id: u.chosenSkkniId }); } catch { /* non-fatal */ }
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
    const passed = score >= UNIT_MASTERY;
    // Review ala Quizizz (#3): sertakan jawaban USER + jawaban BENAR (MC) agar user tahu
    // persis apa yang salah & bisa dipelajari ulang. Untuk isian/urutan: jawaban user +
    // feedback AI (rubrik keyPoints/idealSteps tetap privat - menjaga keabsahan tes ulang).
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
      return { ...base, userAnswer: typeof answers[i] === "string" ? answers[i] : "", isCorrect: (perQ[i]?.score ?? 0) >= ANSWER_OK_SCORE };
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

    // Ujian unit = LATIHAN. Tidak menerbitkan sertifikat; nilainya tetap dipakai
    // Skill Gap & tangga rank. Sertifikat hanya dari Ujian Kompetensi Utama.
    const certificate = null;

    let coin = null;
    // Penanda = KODE UNIT, bukan attempt.id. `attempt.id` selalu baris baru tiap kirim, jadi
    // dedupe `awardOnce` tak pernah aktif dan koin bisa dipanen tanpa batas dengan mengulang
    // latihan yang sama. Satu unit = satu kali koin, selamanya.
    try { coin = await awardOnce(userId, COIN.exam, `Latihan unit: ${inst.unitTitle}`, { type: "unitexam", id: code }); } catch { /* non-fatal */ }
    await prisma.notification.create({ data: { userId, type: "exam_result", message: `Latihan unit "${inst.unitTitle}": skor ${score}%${passed ? " - unit dikuasai" : ""}` } }).catch(() => {});

    const rank = await refreshRank(userId).catch(() => null);
    const overall = await refreshReadiness(userId).catch(() => null);

    await prisma.unitExamInstance.delete({ where: { id: inst.id } }).catch(() => {});
    const states = await unitStates(userId, u.chosenSkkniId);

    // Simpan review ke riwayat (#3) - bisa dibuka kembali untuk dipelajari.
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

// ── Riwayat ujian unit (#3) - daftar + detail review untuk dipelajari kembali ──
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

// Trigger manual sinkron katalog (mis. dari admin) - jalan di latar belakang.
router.post("/sync-catalog", async (req, res) => {
  if (req.user.role !== "admin") return res.status(403).json({ error: "Hanya admin." });
  syncCatalog().catch((e) => console.warn("[skkni] sync:", e.message));
  res.json({ ok: true, message: "Sinkron katalog SKKNI berjalan di latar belakang." });
});

export default router;
