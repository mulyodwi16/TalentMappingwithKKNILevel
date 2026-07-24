import { prisma } from "./prisma.js";
import { chatComplete, isLlmConfigured, LlmError } from "./llm.js";
import { rankName } from "./rank.js";
import { computeRank } from "./rankcalc.js";
import { UNIT_MASTERY, PLAN_MASTERY } from "./thresholds.js";
import { computeReadiness } from "./readiness.js";
import { getDocWithUnits, cleanTitle } from "./skkni.js";
import { chosenUnitCodeSet } from "./competencyScope.js";
import { rankChapter } from "./unitrank.js";

// ── Learning Path AI ──────────────────────────────────────────────────────────
// Menyusun rencana belajar personal & terurut dari 3 masukan (permintaan #4):
//   1. Hasil tes  - SkillAssessment (gap kompetensi, skor per unit).
//   2. Kompetensi yang dipilih - dokumen SKKNI + daftar unit standar.
//   3. Profesi yang ditargetkan - user.targetRole.
// AI juga memberi "pengecekan" kesiapan (readiness vs target) + verdict.
// Tingkat kesulitan tiap langkah menyesuaikan jenjang (rank) pengguna.
// Fallback deterministik dipakai bila LLM tak terkonfigurasi / gagal.

const DIFFICULTY = ["beginner", "intermediate", "advanced"];

// Rank efektif → tingkat kesulitan course yang pas untuk "naik level" (permintaan user:
// tingkat kesulitan course sesuai jenjangnya). Gold/Platinum→pemula, Emerald/Diamond→menengah, Master+→mahir.
function difficultyForRank(level) {
  if (level >= 7) return "advanced";
  if (level >= 5) return "intermediate";
  return "beginner";
}

const safe = (j, fb) => { try { return typeof j === "string" ? JSON.parse(j) : (j ?? fb); } catch { return fb; } };

// Kumpulkan SELURUH masukan pertimbangan AI (permintaan #4): CV (pendidikan, keahlian,
// sertifikasi, pengalaman), kelas yang diikuti, ujian yang diambil, unit yang lulus,
// bukti eksternal, gap, kompetensi target. Data selengkap mungkin agar rencana personal.
export async function buildInputs(userId) {
  const [u, assessments, rank, readiness, certs, unitProg, classesRedeem, courseTx, evidence, attempts] = await Promise.all([
    prisma.user.findUnique({ where: { id: userId } }),
    prisma.skillAssessment.findMany({ where: { userId } }),
    computeRank(userId),
    computeReadiness(userId),
    prisma.certificate.findMany({ where: { userId }, orderBy: { issuedAt: "desc" } }).catch(() => []),
    prisma.unitProgress.findMany({ where: { userId } }).catch(() => []),
    prisma.shopRedemption.findMany({ where: { userId } }).catch(() => []),
    prisma.coinTransaction.findMany({ where: { userId, refType: "course" }, orderBy: { createdAt: "desc" } }).catch(() => []),
    prisma.externalEvidence.findMany({ where: { userId, status: "verified" } }).catch(() => []),
    prisma.examAttempt.count({ where: { userId } }).catch(() => 0),
  ]);
  if (!u) return null;

  // Isolasi per kompetensi: analisa (gap/unit lulus/sertifikat) HANYA dari kompetensi yang
  // SEDANG dipilih → ganti kompetensi = rencana ikut berganti, kompetensi baru mulai dari 0.
  // (CV & bukti eksternal tetap global, konsisten dengan rankcalc/readiness.)
  const codes = await chosenUnitCodeSet(userId, u.chosenSkkniId || null);
  const inScope = (code) => (codes ? codes.has(code) : false);
  const scopedAssess = codes ? assessments.filter((a) => inScope(a.competencyCode)) : [];
  const scopedCerts = codes ? certs.filter((c) => inScope(c.competencyCode)) : [];

  const gaps = scopedAssess
    .filter((a) => a.gap > 0)
    .sort((a, b) => b.gap - a.gap)
    .map((a) => ({ name: a.competencyName, code: a.competencyCode, score: a.currentScore, gap: a.gap }));
  const strong = scopedAssess
    .filter((a) => a.gap === 0 && a.currentScore >= UNIT_MASTERY)
    .map((a) => a.competencyName);
  const passedUnits = scopedAssess
    .filter((a) => a.currentScore >= UNIT_MASTERY)
    .map((a) => ({ name: a.competencyName, code: a.competencyCode, score: a.currentScore }));

  // Unit kompetensi standar dari dokumen SKKNI yang dipilih (patokan skill yang harus dikuasai).
  let competency = null;
  if (u.chosenSkkniId) {
    try {
      const doc = await getDocWithUnits(u.chosenSkkniId);
      if (doc) {
        competency = {
          id: doc.id,
          title: cleanTitle(doc.title),
          number: doc.numberKepmen || null,
          unitCount: doc.unitCount,
          units: doc.units.map((x) => ({ code: x.code, title: x.title })),
        };
      }
    } catch { /* non-fatal */ }
  }

  const cv = safe(u.cvMeta, {});
  const cvSkills = [...new Set([...(cv.skills || []), ...(cv.certifications || [])])];
  const classes = [
    ...classesRedeem.map((r) => ({ kind: "premium", name: r.itemName })),
    ...courseTx.map((t) => ({ kind: "avataredu", name: (t.reason || "Kursus").replace(/^Mulai kursus:\s*/i, "") })),
  ];

  return {
    user: {
      name: u.name,
      education: u.education || cv.education || null,
      academicStatus: u.academicStatus || null,
      // Profesi target DITURUNKAN OTOMATIS dari kompetensi SKKNI (bukan input manual lagi).
      targetRole: competency?.title || u.targetRole || null,
      experienceYears: u.experienceYears ?? cv.experienceYears ?? 0,
    },
    cv: {
      hasCv: !!(cv.parsedAt || cv.education),
      skills: cvSkills,
      certifications: cv.certifications || [],
      experienceYears: cv.experienceYears ?? u.experienceYears ?? 0,
      education: cv.education || u.education || null,
    },
    rank: {
      current: rank.effective,
      currentName: rankName(rank.effective),
      target: u.targetKkniLevel || Math.min(9, rank.effective + 1),
      targetName: rankName(u.targetKkniLevel || Math.min(9, rank.effective + 1)),
      masteryScore: rank.masteryScore,
      next: rank.next,
      // Tangga & rank efektif dibawa mentah supaya "babak" Learning Path (rankChapter) memakai
      // angka yang SAMA PERSIS dengan tangga rank - tak ada perhitungan tandingan.
      effective: rank.effective,
      earned: rank.earned,
      ladder: rank.ladder,
      weightCap: rank.weightCap, cappedByWeight: rank.cappedByWeight,
    },
    readiness: { total: readiness.total, cv: readiness.cv, exam: readiness.exam, cert: readiness.cert, status: readiness.status },
    competency,
    gaps,
    strong,
    passedUnits,
    classes,
    certificates: scopedCerts.map((c) => ({ name: c.name, score: c.score })),
    evidence: evidence.map((e) => ({ title: e.title, type: e.type, rankImplied: e.rankImplied })),
    activity: {
      examAttempts: attempts,
      classesTaken: classes.length,
      certCount: scopedCerts.length,
      unitsLearned: unitProg.filter((p) => p.learned).length,
      evidenceCount: evidence.length,
    },
    baseDifficulty: difficultyForRank(rank.effective),
  };
}

// ── Pelacakan progres OTOMATIS (permintaan #4: tracker langsung dideteksi AI, bukan manual) ──
// Progres tiap langkah DITURUNKAN dari aktivitas nyata user, bukan diisi tangan:
//   unit lulus (skor≥60) → done · sedang dipelajari/diuji (<60 / kelas dibuka) → doing · lainnya → todo.
function normalizeTitle(s) { return String(s || "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim(); }


// AI kadang salah memberi trackType (mis. langkah "Verifikasi Bukti Eksternal" diberi
// trackType "cv"), sehingga langkahnya dinyatakan selesai hanya karena CV sudah diunggah.
// Isi langkah lebih dipercaya daripada labelnya.
const EVIDENCE_RE = /bukti eksternal|external evidence|verifikasi bukti|portofolio terverifikasi/i;
const CERT_RE = /sertifikat|certificate/i;
function realTrackType(step) {
  const text = `${step?.title || ""} ${step?.objective || ""} ${step?.why || ""}`;
  if (EVIDENCE_RE.test(text)) return "evidence";
  if (step?.trackType === "cv" && CERT_RE.test(text)) return "certificate";
  return step?.trackType || "unit";
}

export async function deriveStepProgress(userId, steps) {
  if (!Array.isArray(steps) || !steps.length) return steps || [];
  const [assessments, unitProgAll, u, certRows, classesRedeem, courseTx, evidence, attempts] = await Promise.all([
    prisma.skillAssessment.findMany({ where: { userId } }),
    prisma.unitProgress.findMany({ where: { userId } }).catch(() => []),
    prisma.user.findUnique({ where: { id: userId }, select: { cvMeta: true, chosenSkkniId: true } }),
    prisma.certificate.findMany({ where: { userId }, select: { competencyCode: true } }).catch(() => []),
    prisma.shopRedemption.count({ where: { userId } }).catch(() => 0),
    prisma.coinTransaction.count({ where: { userId, refType: "course" } }).catch(() => 0),
    prisma.externalEvidence.count({ where: { userId, status: "verified" } }).catch(() => 0),
    prisma.examAttempt.count({ where: { userId } }).catch(() => 0),
  ]);
  // Isolasi per kompetensi (sama seperti buildInputs): unit lulus, sertifikat & materi kelas
  // yang dihitung hanya milik kompetensi aktif → progres langkah ikut berganti saat kompetensi diganti.
  const codes = await chosenUnitCodeSet(userId, u?.chosenSkkniId || null);
  const scoped = codes ? assessments.filter((a) => codes.has(a.competencyCode)) : [];
  const unitProg = u?.chosenSkkniId ? unitProgAll.filter((p) => p.docId === u.chosenSkkniId) : [];
  const certs = codes ? certRows.filter((c) => codes.has(c.competencyCode)).length : 0;
  const byCode = new Map(scoped.map((a) => [a.competencyCode, a]));
  const byTitle = new Map(scoped.map((a) => [normalizeTitle(a.competencyName), a]));
  const learnedCodes = new Set(unitProg.filter((p) => p.learned).map((p) => p.unitCode));
  const learningCodes = new Set(unitProg.map((p) => p.unitCode));
  const hasCv = !!safe(u?.cvMeta, {}).parsedAt || !!safe(u?.cvMeta, {}).education;
  const classesTaken = classesRedeem + courseTx;

  const mark = (progress, note) => ({ progress, progressNote: note || null, autoTracked: true });

  const resolveUnit = (step) => {
    let a = step.unitCode ? byCode.get(step.unitCode) : null;
    if (!a && step.competencyRef) a = byTitle.get(normalizeTitle(step.competencyRef));
    if (!a && step.title) a = byTitle.get(normalizeTitle(step.title));
    const code = step.unitCode || a?.competencyCode;
    // Langkah Learning Path ADA untuk menutup gap, jadi "selesai" tidak boleh berarti
    // sekadar lulus. Unit dengan skor 75% masih menyisakan gap -25%, dan menandainya
    // selesai membuat rencana terlihat beres padahal gap-nya masih terpampang.
    if (a && a.currentScore >= PLAN_MASTERY) return mark("done", `Dikuasai ${a.currentScore}%`);
    if (a && a.currentScore >= UNIT_MASTERY) return mark("doing", `Dikuasai ${a.currentScore}% - tutup sisa gap ke ${PLAN_MASTERY}%`);
    if (a && a.currentScore > 0) return mark("doing", `Ujian ${a.currentScore}% - belum lulus (min 60%)`);
    if (code && learnedCodes.has(code)) return mark("doing", "Materi kelas selesai - tinggal lulus ujiannya");
    if (code && learningCodes.has(code)) return mark("doing", "Kelas sedang berjalan");
    return mark("todo");
  };

  return steps.map((s) => {
    const t = realTrackType(s);
    let r;
    switch (t) {
      case "cv":          r = hasCv ? mark("done", "CV sudah diunggah") : mark("todo"); break;
      case "class":       r = classesTaken > 0 ? mark("done", `${classesTaken} kelas diikuti`) : mark("todo"); break;
      case "certificate": r = certs > 0 ? mark("done", `${certs} sertifikat terbit`) : mark("todo"); break;
      case "evidence":    r = evidence > 0 ? mark("done", `${evidence} bukti terverifikasi`) : mark("todo"); break;
      case "exam":
        // Ujian yang menyasar unit tertentu → lacak kelulusan unit itu (lebih akurat).
        if (s.unitCode || s.competencyRef) r = resolveUnit(s);
        else r = attempts > 0 ? mark("doing", `${attempts} percobaan ujian`) : mark("todo");
        break;
      case "unit":
      default:            r = resolveUnit(s); break;
    }
    return { ...s, ...r };
  });
}

// Ambil blok JSON pertama yang valid dari teks LLM (toleran terhadap ```json fences / prosa).
function extractJson(text) {
  if (!text) return null;
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const raw = fenced ? fenced[1] : text;
  const start = raw.indexOf("{");
  const end = raw.lastIndexOf("}");
  if (start === -1 || end === -1 || end <= start) return null;
  try { return JSON.parse(raw.slice(start, end + 1)); } catch { return null; }
}

const TRACK_TYPES = ["unit", "cv", "class", "certificate", "evidence", "exam"];
const FEATURES = ["kelas", "ujian", "cv", "evidence", "peta", "mentor"];

function normStep(s, i) {
  const difficulty = DIFFICULTY.includes(s?.difficulty) ? s.difficulty : "beginner";
  const trackType = TRACK_TYPES.includes(s?.trackType) ? s.trackType : "unit";
  const feature = FEATURES.includes(s?.feature) ? s.feature : (trackType === "cv" ? "cv" : trackType === "evidence" ? "evidence" : trackType === "class" ? "kelas" : "ujian");
  return {
    id: `s${i + 1}`,
    order: i + 1,
    title: String(s?.title || `Langkah ${i + 1}`).slice(0, 140),
    objective: String(s?.objective || "").slice(0, 400),
    why: String(s?.why || "").slice(0, 400),
    difficulty,
    competencyRef: String(s?.competencyRef || s?.competency || "").slice(0, 160) || null,
    unitCode: String(s?.unitCode || "").slice(0, 40) || null,
    trackType,
    feature,
    estEffort: String(s?.estEffort || s?.effort || "").slice(0, 40) || null,
    courseQuery: String(s?.courseQuery || s?.query || "").slice(0, 60) || null,
    // progress diisi otomatis oleh deriveStepProgress (bukan manual).
    progress: "todo",
  };
}

// Susun prompt & panggil LLM → rencana terstruktur (JSON). Lempar LlmError bila gagal.
async function generateWithLlm(inputs) {
  const comp = inputs.competency;
  // Unit DENGAN KODE agar AI bisa menautkan langkah ke unit tertentu (untuk pelacakan otomatis).
  const unitLines = comp?.units?.length
    ? comp.units.slice(0, 26).map((x) => `• [${x.code}] ${x.title}`).join("\n")
    : "(belum ada - user belum memilih kompetensi SKKNI)";
  const gapLines = inputs.gaps.length
    ? inputs.gaps.map((g) => `• [${g.code}] ${g.name} - skor ${g.score}%, gap -${g.gap}%`).join("\n")
    : "(belum ada hasil ujian; gunakan unit kompetensi di atas sebagai basis)";
  const passedLines = inputs.passedUnits.length
    ? inputs.passedUnits.map((p) => `• [${p.code}] ${p.name} (${p.score}%)`).join("\n")
    : "(belum ada unit yang lulus)";

  const context =
    `PROFIL PENGGUNA:\n` +
    `- Nama: ${inputs.user.name} · Pendidikan: ${inputs.user.education || inputs.user.academicStatus || "-"} · Pengalaman: ${inputs.user.experienceYears} tahun\n` +
    `- Skill Rank SAAT INI: ${inputs.rank.currentName} (setara level KKNI ${inputs.rank.current}) → TARGET: ${inputs.rank.targetName} (setara level KKNI ${inputs.rank.target})\n` +
    `- Skor Kesiapan: ${inputs.readiness.total}/100 (CV ${inputs.readiness.cv}, Ujian ${inputs.readiness.exam}, Sertifikat ${inputs.readiness.cert}) · status ${inputs.readiness.status}\n` +
    `- PROFESI DITARGETKAN: ${inputs.user.targetRole || "(belum diisi - simpulkan dari kompetensi)"}\n` +
    `- Tingkat kesulitan dasar yang pas: ${inputs.baseDifficulty}\n\n` +
    `DATA CV: ${inputs.cv.hasCv ? "ADA" : "BELUM diunggah"}` +
    (inputs.cv.hasCv ? ` · Keahlian terdeteksi: ${inputs.cv.skills.length ? inputs.cv.skills.join(", ") : "-"} · Sertifikasi: ${inputs.cv.certifications.length ? inputs.cv.certifications.join(", ") : "-"}` : "") + `\n` +
    `AKTIVITAS BELAJAR: ${inputs.activity.classesTaken} kelas diikuti (${inputs.classes.map((c) => c.name).slice(0, 6).join(", ") || "-"}) · ${inputs.activity.unitsLearned} materi unit dipelajari · ${inputs.activity.examAttempts} percobaan ujian · ${inputs.activity.certCount} sertifikat · ${inputs.activity.evidenceCount} bukti eksternal terverifikasi\n` +
    `BUKTI EKSTERNAL TERVERIFIKASI: ${inputs.evidence.length ? inputs.evidence.map((e) => e.title).join(", ") : "(belum ada)"}\n\n` +
    `KOMPETENSI SKKNI YANG DIPILIH: ${comp ? `${comp.title}${comp.number ? ` (${comp.number})` : ""} - ${comp.unitCount} unit` : "(belum dipilih)"}\n` +
    `UNIT/SKILL STANDAR (pakai KODE dalam [] untuk field unitCode):\n${unitLines}\n\n` +
    `GAP dari hasil ujian (prioritas tutup):\n${gapLines}\n\n` +
    `UNIT YANG SUDAH LULUS (JANGAN diulang; anggap dikuasai):\n${passedLines}\n\n` +
    `KOMPETENSI YANG SUDAH KUAT: ${inputs.strong.length ? inputs.strong.join(", ") : "(belum ada)"}`;

  const system = {
    role: "system",
    content:
      `Kamu perancang "Learning Path" pada platform karier TalentaAI (selaras SKKNI/KKNI Indonesia). ` +
      `Susun rencana belajar PERSONAL, TERURUT, dan REALISTIS dari kondisi NYATA pengguna (CV, kelas yang sudah diikuti, ujian yang diambil, unit yang lulus, keahlian) menuju profesi & rank target, ` +
      `dengan PRIORITAS menutup gap kompetensi dan menguasai unit SKKNI yang belum lulus. JANGAN menyuruh mengulang unit yang sudah lulus. ` +
      `Tingkat kesulitan tiap langkah menyesuaikan jenjang pengguna (mulai "${inputs.baseDifficulty}", naik bertahap). ` +
      `Progres tiap langkah akan DILACAK OTOMATIS oleh sistem dari aktivitas user - maka setiap langkah HARUS bisa dilacak: ` +
      `beri "trackType" & jika terkait unit tertentu isi "unitCode" PERSIS dari daftar (dalam []). ` +
      `Balas HANYA JSON valid (tanpa prosa/markdown) dengan bentuk PERSIS:\n` +
      `{"aiCheck":{"verdict":"on_track|needs_work|not_ready","headline":"1 kalimat kondisi","message":"2-4 kalimat analisis kesiapan vs target + saran fokus, sebut data yang dipertimbangkan","focus":["area fokus","..."]},` +
      `"steps":[{"title":"judul singkat","objective":"hasil setelah langkah ini","why":"kaitkan ke gap/unit/CV/target","difficulty":"beginner|intermediate|advanced","competencyRef":"nama unit terkait","unitCode":"kode unit jika ada, mis. J.591200.001.01","trackType":"unit|cv|class|certificate|evidence|exam","feature":"kelas|ujian|cv|evidence|peta|mentor","estEffort":"mis. 1-2 minggu","courseQuery":"kata kunci cari kursus 1-3 kata"}]}\n` +
      `"feature" = fitur aplikasi untuk mengerjakan langkah: "kelas" (belajar materi), "ujian" (buktikan kompetensi), "cv" (unggah CV), "evidence" (tambah bukti/sertifikasi eksternal), "peta" (cek peta posisi), "mentor" (tanya AI). ` +
      `Buat 4-7 langkah urut fondasi→lanjutan. Bahasa Indonesia. Jangan mengarang unit di luar konteks. Untuk semua teks (headline/message/objective/why): gunakan tanda hubung biasa "-", JANGAN pakai em dash.`,
  };

  const result = await chatComplete([system, { role: "user", content: context }], { temperature: 0.5, maxTokens: 1700 });
  const parsed = extractJson(result.content);
  if (!parsed || !Array.isArray(parsed.steps) || parsed.steps.length === 0) {
    throw new LlmError("Respons AI tidak dalam format rencana yang valid.", 502);
  }
  const ai = parsed.aiCheck || {};
  const validVerdict = ["on_track", "needs_work", "not_ready"].includes(ai.verdict) ? ai.verdict : "needs_work";
  return {
    aiCheck: {
      verdict: validVerdict,
      headline: String(ai.headline || "").slice(0, 200),
      message: String(ai.message || "").slice(0, 800),
      focus: Array.isArray(ai.focus) ? ai.focus.slice(0, 5).map((x) => String(x).slice(0, 120)) : [],
    },
    steps: parsed.steps.slice(0, 8).map(normStep),
  };
}

// Rencana deterministik bila LLM tak tersedia - tetap berguna: dari gap & unit SKKNI.
function generateFallback(inputs) {
  const steps = [];
  const base = inputs.baseDifficulty;
  const bump = (d) => DIFFICULTY[Math.min(2, DIFFICULTY.indexOf(d) + 1)];

  // 0) Jika belum ada CV, langkah pertama unggah CV (dilacak otomatis).
  if (!inputs.cv?.hasCv) {
    steps.push({
      title: "Lengkapi & unggah CV",
      objective: "Unggah CV agar keahlian & pendidikanmu terbaca dan dibandingkan dengan standar SKKNI.",
      why: "CV menyumbang skor kesiapan dan membuat rencana ini makin personal.",
      difficulty: "beginner", competencyRef: null, unitCode: null,
      trackType: "cv", feature: "cv", estEffort: "10 menit", courseQuery: null,
    });
  }

  // 1) Tutup gap terbesar dulu (dari hasil ujian).
  inputs.gaps.slice(0, 4).forEach((g) => {
    steps.push({
      title: `Kuasai: ${g.name}`,
      objective: `Naikkan skor "${g.name}" dari ${g.score}% ke minimal 60% (lulus).`,
      why: `Gap terbesar dari hasil ujian (-${g.gap}%). Menutup ini paling cepat menaikkan kesiapan & Skill Rank.`,
      difficulty: g.gap >= 40 ? base : bump(base),
      competencyRef: g.name, unitCode: g.code || null,
      trackType: "unit", feature: "kelas",
      estEffort: g.gap >= 40 ? "2-3 minggu" : "1-2 minggu",
      courseQuery: g.name?.split(/\s+/).slice(0, 2).join(" "),
    });
  });

  // 2) Jika gap sedikit, lanjut ke unit SKKNI yang belum lulus (skip yang sudah lulus).
  if (steps.length < 5 && inputs.competency?.units?.length) {
    const passedCodes = new Set((inputs.passedUnits || []).map((p) => p.code));
    const covered = new Set(inputs.gaps.map((g) => g.name).concat(inputs.strong));
    inputs.competency.units
      .filter((x) => !covered.has(x.title) && !passedCodes.has(x.code))
      .slice(0, 6 - steps.length)
      .forEach((x, i) => {
        steps.push({
          title: `Pelajari unit: ${x.title}`,
          objective: `Kuasai unit standar SKKNI "${x.title}" lalu ambil ujiannya.`,
          why: `Bagian dari kompetensi target "${inputs.competency.title}" yang belum kamu buktikan.`,
          difficulty: i === 0 ? base : bump(base),
          competencyRef: x.title, unitCode: x.code || null,
          trackType: "unit", feature: "kelas",
          estEffort: "1-2 minggu",
          courseQuery: x.title?.split(/\s+/).slice(0, 2).join(" "),
        });
      });
  }

  // 3) Langkah penutup: ambil ujian ulang untuk mengunci kenaikan rank.
  steps.push({
    title: "Ambil Ujian Kompetensi Utama",
    objective: `Buktikan kompetensimu secara menyeluruh (lulus 70%) untuk meraih sertifikat dan naik menuju ${inputs.rank.targetName}.`,
    why: "Rank & kesiapan naik dari BUKTI kompetensi, bukan sekadar belajar. Ujian utama ini satu-satunya yang menerbitkan sertifikat - satu untuk seluruh kompetensi.",
    difficulty: bump(base),
    competencyRef: inputs.competency?.title || null, unitCode: null,
    trackType: "exam", feature: "ujian",
    estEffort: "1 minggu", courseQuery: null,
  });

  // 4) Jika rank tercapai batas bobot, dorong bukti eksternal menuju ahli.
  if (inputs.rank?.cappedByWeight) {
    steps.push({
      title: "Tambahkan bukti kompetensi eksternal",
      objective: "Lampirkan sertifikasi resmi (BNSP/nasional), portofolio, atau pengalaman untuk menembus batas rank ujian.",
      why: "Rank ujianmu sudah mencapai batas bobot kompetensi ini - bukti eksternal yang membuka jalan ke tingkat ahli.",
      difficulty: "advanced", competencyRef: null, unitCode: null,
      trackType: "evidence", feature: "evidence", estEffort: "fleksibel", courseQuery: null,
    });
  }

  const passedShare = inputs.readiness.exam;
  const verdict = inputs.readiness.total >= 80 ? "on_track" : inputs.readiness.total >= 50 ? "needs_work" : "not_ready";
  return {
    aiCheck: {
      verdict,
      headline:
        verdict === "on_track"
          ? `Kamu sudah dekat dengan ${inputs.rank.targetName}.`
          : `Ada ${inputs.gaps.length} kompetensi yang perlu ditutup menuju ${inputs.rank.targetName}.`,
      message:
        `Skor kesiapan ${inputs.readiness.total}/100 (Ujian ${passedShare}). ` +
        (inputs.gaps.length
          ? `Fokus pada ${Math.min(3, inputs.gaps.length)} gap teratas, lalu ambil ujian ulang untuk mengunci kenaikan rank.`
          : `Perbanyak bukti kompetensi (unit lulus & sertifikat) untuk naik ke ${inputs.rank.targetName}.`),
      focus: inputs.gaps.slice(0, 3).map((g) => g.name),
    },
    steps: steps.slice(0, 7).map(normStep),
  };
}

// Susun rencana baru & simpan. Rencana dibedakan PER KOMPETENSI (docId): ganti kompetensi =
// rencana baru. Profesi target DITURUNKAN OTOMATIS dari kompetensi (tanpa input manual, permintaan #6).
export async function generatePlan(userId) {
  const inputs = await buildInputs(userId);
  if (!inputs) throw new LlmError("Pengguna tidak ditemukan.", 404);
  const docId = inputs.competency?.id || null;
  // Simpan targetRole turunan (nama kompetensi) ke user agar konsisten dengan tampilan lain.
  if (inputs.user.targetRole) {
    await prisma.user.update({ where: { id: userId }, data: { targetRole: inputs.user.targetRole.slice(0, 120) } }).catch(() => {});
  }

  let plan, source;
  if (isLlmConfigured()) {
    try { plan = await generateWithLlm(inputs); source = "ai"; }
    catch (e) { console.error("learning-path LLM:", e.message); plan = generateFallback(inputs); source = "fallback"; }
  } else {
    plan = generateFallback(inputs); source = "fallback";
  }

  // Roadmap UTUH & anti-mundur: sertakan unit yang SUDAH LULUS sebagai langkah (akan otomatis
  // ditandai "Selesai" oleh deriveStepProgress). Efeknya progres TAK PERNAH menyusut saat rencana
  // disusun ulang - daftar langkah selalu sinkron dengan data utama user (unit lulus), bukan
  // menghapus pencapaian. Hanya unit lulus yang belum tercakup langkah baru yang ditambahkan.
  const covered = new Set(plan.steps.map((s) => s.unitCode).filter(Boolean));
  const doneSteps = (inputs.passedUnits || [])
    .filter((p) => p.code && !covered.has(p.code))
    .map((p, i) => normStep({
      title: `Kuasai: ${p.name}`,
      objective: `Unit "${p.name}" sudah kamu buktikan lewat ujian (${p.score}%).`,
      why: `Fondasi kompetensi "${inputs.competency?.title || inputs.user.targetRole || ""}" yang sudah tervalidasi.`,
      difficulty: "beginner", competencyRef: p.name, unitCode: p.code,
      trackType: "unit", feature: "ujian",
    }, i));
  if (doneSteps.length) {
    plan.steps = [...doneSteps, ...plan.steps].slice(0, 12).map((s, i) => ({ ...s, id: `s${i + 1}`, order: i + 1 }));
  }

  // Upsert manual per (userId, docId) - findFirst aman untuk docId null di unique majemuk.
  const existing = await prisma.learningPlan.findFirst({ where: { userId, docId } });
  const data = { targetRole: inputs.user.targetRole, plan: JSON.stringify(plan), source };
  const saved = existing
    ? await prisma.learningPlan.update({ where: { id: existing.id }, data: { ...data, generatedAt: new Date() } })
    : await prisma.learningPlan.create({ data: { userId, docId, ...data } });
  // Progres dilacak OTOMATIS dari aktivitas nyata (bukan manual).
  const steps = await deriveStepProgress(userId, plan.steps);
  return { plan: { ...plan, steps }, source, targetRole: inputs.user.targetRole, generatedAt: saved.generatedAt, inputs, chapter: rankChapter(inputs.rank) };
}

// Ambil rencana tersimpan untuk kompetensi AKTIF (tanpa regenerasi). Progres selalu dihitung
// ULANG dari aktivitas terbaru. Kompetensi tanpa rencana → plan null (belum disusun).
export async function getPlan(userId) {
  const inputs = await buildInputs(userId);
  const docId = inputs?.competency?.id || null;
  const row = await prisma.learningPlan.findFirst({ where: { userId, docId } });
  const chapter = inputs?.rank ? rankChapter(inputs.rank) : null;
  if (!row) return { plan: null, targetRole: inputs?.user.targetRole || null, inputs, chapter, llmAvailable: isLlmConfigured() };
  let plan = null;
  try { plan = JSON.parse(row.plan); } catch { /* corrupt */ }
  if (plan?.steps) plan = { ...plan, steps: await deriveStepProgress(userId, plan.steps) };

  // Progres tiap langkah memang dihitung ulang tiap kali, TAPI isi rencananya beku sejak
  // disusun. Setelah tes penempatan (atau ujian) mengubah baseline, rencana lama bisa
  // menyuruh mengulang unit yang sudah dikuasai - jadi ditandai supaya pengguna tahu
  // rencananya perlu disusun ulang.
  const newest = await prisma.skillAssessment.findFirst({
    where: { userId }, orderBy: { updatedAt: "desc" }, select: { updatedAt: true },
  }).catch(() => null);
  const stale = !!newest && newest.updatedAt > row.generatedAt;

  return { plan, source: row.source, targetRole: row.targetRole, generatedAt: row.generatedAt, stale, inputs, chapter, llmAvailable: isLlmConfigured() };
}

// (DIHAPUS) Progres langkah tidak lagi diisi manual - dilacak otomatis oleh deriveStepProgress.
