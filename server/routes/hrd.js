import express from "express";
import { UNIT_MASTERY } from "../thresholds.js";
import xlsx from "xlsx";
import { prisma } from "../prisma.js";
import { requireAuth, requireRole } from "../middleware/auth.js";
import { rankName } from "../rank.js";
import { buildSkillProfile, matchJob, safeArr } from "../jobmatch.js";

// Bentuk posisi dgn kolom JSON yang sudah diurai - sama seperti di routes/jobs.js.
const shapeJob = (j) => ({ ...j, skills: safeArr(j.skills), certifications: safeArr(j.certifications), modules: safeArr(j.modules) });

const router = express.Router();
router.use(requireAuth, requireRole("hrd", "admin"));

// Ringkas data ujian/kompetensi (dari fitur ujian) untuk sekumpulan talenta - supaya HRD
// melihat data yang SINKRON dengan hasil ujian, bukan hanya profil statis (#13).
// PENTING: dihitung PER KOMPETENSI YANG DIPILIH talenta, dan penyebutnya adalah SELURUH
// unit kompetensi itu - bukan sekadar unit yang kebetulan pernah diuji.
// Sebelumnya semua nilai unit dihitung apa adanya, jadi talenta yang nilainya berasal dari
// kompetensi LAIN terbaca "6/6 lulus" padahal kesiapannya 13% - HRD bisa salah memilih orang
// hanya karena membaca angka yang tampak sempurna.
async function competencySummary(userIds) {
  if (!userIds.length) return {};
  const [users, assess, certRows, attempts] = await Promise.all([
    prisma.user.findMany({ where: { id: { in: userIds } }, select: { id: true, chosenSkkniId: true } }),
    prisma.skillAssessment.findMany({ where: { userId: { in: userIds } }, select: { userId: true, competencyCode: true, currentScore: true } }),
    prisma.certificate.findMany({ where: { userId: { in: userIds } }, select: { userId: true, competencyCode: true } }),
    prisma.examAttempt.findMany({ where: { userId: { in: userIds } }, orderBy: { createdAt: "desc" }, select: { userId: true, createdAt: true } }),
  ]);

  // Satu kueri unit untuk semua kompetensi yang dipakai, lalu dikelompokkan per dokumen.
  const docIds = [...new Set(users.map((u) => u.chosenSkkniId).filter(Boolean))];
  const units = docIds.length
    ? await prisma.skkniUnit.findMany({ where: { documentId: { in: docIds } }, select: { documentId: true, code: true } })
    : [];
  const codesOf = new Map();
  for (const d of docIds) codesOf.set(d, new Set());
  for (const u of units) codesOf.get(u.documentId)?.add(u.code);

  const docOf = new Map(users.map((u) => [u.id, u.chosenSkkniId || null]));
  const map = {};
  for (const id of userIds) {
    const doc = docOf.get(id);
    map[id] = { assessedUnits: 0, passedUnits: 0, totalUnits: doc ? (codesOf.get(doc)?.size || 0) : 0, certCount: 0, lastExamAt: null };
  }

  const inScope = (userId, code) => {
    const doc = docOf.get(userId);
    if (!doc) return false;
    const set = codesOf.get(doc);
    return !!set && (set.has(code) || code === doc); // docId = kode sertifikat kompetensi
  };

  for (const a of assess) {
    if (!inScope(a.userId, a.competencyCode)) continue;
    const m = map[a.userId];
    m.assessedUnits++;
    if (a.currentScore >= UNIT_MASTERY) m.passedUnits++;
  }
  for (const c of certRows) { if (inScope(c.userId, c.competencyCode)) map[c.userId].certCount++; }
  for (const at of attempts) { const m = map[at.userId]; if (!m.lastExamAt) m.lastExamAt = at.createdAt; }
  return map;
}

router.get("/workers", async (req, res) => {
  const { status, department, level } = req.query;
  const where = { role: "user" };
  if (status) where.status = status;
  if (department) where.department = { contains: department };
  if (level) where.currentKkniLevel = parseInt(level);
  const workers = await prisma.user.findMany({ where, orderBy: { name: "asc" } });
  const summary = await competencySummary(workers.map((w) => w.id));
  res.json(workers.map((w) => ({ ...safeUser(w), ...summary[w.id] })));
});

// Detail 1 talenta: kompetensi SKKNI target, penilaian per unit (dari ujian), sertifikat,
// dan riwayat ujian terakhir - bukti kompetensi yang tersinkron ke HRD.
router.get("/worker/:id", async (req, res) => {
  const u = await prisma.user.findFirst({ where: { id: req.params.id, role: "user" } });
  if (!u) return res.status(404).json({ error: "Talenta tidak ditemukan." });
  const [assessAll, certificates, attempts, summary] = await Promise.all([
    prisma.skillAssessment.findMany({ where: { userId: u.id }, orderBy: { competencyCode: "asc" } }),
    prisma.certificate.findMany({ where: { userId: u.id }, orderBy: { issuedAt: "desc" } }),
    prisma.examAttempt.findMany({ where: { userId: u.id }, orderBy: { createdAt: "desc" }, take: 8 }),
    competencySummary([req.params.id]),
  ]);

  // Nilai unit disaring ke kompetensi yang DIPILIH talenta, dan penyebutnya ikut ringkasan
  // yang sama dengan tabel Daftar Talenta. Dulu modal ini menghitung ulang sendiri dari
  // "unit yang kebetulan pernah dinilai", jadi baris 6/42 di tabel terbuka jadi 6/6 di modal -
  // dan modal inilah yang dipercaya perekrut karena ia yang menampilkan buktinya.
  const codes = u.chosenSkkniId
    ? new Set((await prisma.skkniUnit.findMany({ where: { documentId: u.chosenSkkniId }, select: { code: true } })).map((x) => x.code))
    : null;
  const inScope = (code) => (codes ? codes.has(code) || code === u.chosenSkkniId : false);
  const assessments = codes ? assessAll.filter((a) => inScope(a.competencyCode)) : [];
  const s = summary[req.params.id] || { totalUnits: 0, passedUnits: 0 };

  res.json({
    worker: safeUser(u),
    competency: u.chosenSkkniId ? { id: u.chosenSkkniId, title: u.chosenSkkniTitle } : null,
    totalUnits: s.totalUnits,
    passedUnits: s.passedUnits,
    assessments: assessments.map((a) => ({ code: a.competencyCode, name: a.competencyName, score: a.currentScore, passed: a.currentScore >= UNIT_MASTERY, gap: a.gap })),
    // Sertifikat ikut disaring ke kompetensi aktif supaya jumlahnya sama dengan tabel.
    certificates: certificates.filter((c) => inScope(c.competencyCode)).map((c) => ({ id: c.id, name: c.name, code: c.competencyCode, score: c.score, source: c.source, issuedAt: c.issuedAt })),
    attempts: attempts.map((a) => ({ id: a.id, score: a.readinessScore, passed: a.passed, status: a.status, createdAt: a.createdAt })),
  });
});

router.get("/analytics", async (req, res) => {
  const users = await prisma.user.findMany({ where: { role: "user" } });
  const total = users.length;
  const statusCounts = { ready: 0, in_progress: 0, not_ready: 0 };
  const levelDistribution = {};
  const competencyDistribution = {};
  let totalReadiness = 0;

  for (const u of users) {
    statusCounts[u.status || "not_ready"]++;
    if (u.currentKkniLevel)
      levelDistribution[u.currentKkniLevel] = (levelDistribution[u.currentKkniLevel] || 0) + 1;
    totalReadiness += u.readinessScore || 0;
    if (u.chosenSkkniTitle) competencyDistribution[u.chosenSkkniTitle] = (competencyDistribution[u.chosenSkkniTitle] || 0) + 1;
  }

  const [recentAttempts, totalCertificates, totalExams] = await Promise.all([
    prisma.examAttempt.findMany({
      orderBy: { createdAt: "desc" }, take: 6,
      include: { user: { select: { name: true, email: true } } },
    }),
    prisma.certificate.count(),
    prisma.examAttempt.count(),
  ]);

  res.json({
    total, statusCounts, levelDistribution, competencyDistribution,
    avgReadiness: total ? Math.round(totalReadiness / total) : 0,
    totalCertificates, totalExams,
    recentAttempts,
  });
});

router.post("/requests", async (req, res) => {
  const { type, payload } = req.body;
  const requester = await prisma.user.findUnique({ where: { id: req.user.id } });
  const r = await prisma.request.create({
    data: {
      fromId: req.user.id, fromName: requester.name, fromEmail: requester.email,
      type, payload: JSON.stringify(payload || {}),
    },
  });
  res.status(201).json(r);
});

// Pergerakan talenta 30 hari terakhir. Menjawab "apa yang berubah sejak terakhir saya
// lihat" - daftar talenta saja tidak bisa menjawab itu karena tidak menyimpan waktu.
// Acuannya `SkillAssessment.updatedAt`: setiap unit yang dinilai ulang membekas di sana.
router.get("/movement", async (req, res) => {
  const days = Math.min(180, Math.max(7, parseInt(req.query.days) || 30));
  const since = new Date(Date.now() - days * 86_400_000);

  const [workers, recent, attempts, certs] = await Promise.all([
    prisma.user.findMany({ where: { role: "user" }, orderBy: { name: "asc" } }),
    prisma.skillAssessment.findMany({ where: { updatedAt: { gte: since } }, select: { userId: true, competencyName: true, currentScore: true, updatedAt: true } }),
    prisma.examAttempt.findMany({ where: { createdAt: { gte: since } }, select: { userId: true, createdAt: true } }),
    prisma.certificate.findMany({ where: { issuedAt: { gte: since } }, select: { userId: true } }),
  ]);

  const bucket = new Map();
  const touch = (id) => {
    if (!bucket.has(id)) bucket.set(id, { units: 0, mastered: 0, exams: 0, certs: 0, lastAt: null, topUnit: null });
    return bucket.get(id);
  };
  for (const a of recent) {
    const b = touch(a.userId);
    b.units++;
    if (a.currentScore >= UNIT_MASTERY) b.mastered++;
    if (!b.lastAt || a.updatedAt > b.lastAt) { b.lastAt = a.updatedAt; b.topUnit = a.competencyName; }
  }
  for (const a of attempts) {
    const b = touch(a.userId);
    b.exams++;
    if (!b.lastAt || a.createdAt > b.lastAt) b.lastAt = a.createdAt;
  }
  for (const c of certs) touch(c.userId).certs++;

  const rows = workers.map((w) => {
    const b = bucket.get(w.id);
    return {
      id: w.id, name: w.name, email: w.email,
      rank: w.currentKkniLevel, status: w.status,
      readiness: w.readinessScore || 0,
      competency: w.chosenSkkniTitle || null,
      moving: !!b,
      unitsTouched: b?.units || 0,
      unitsMastered: b?.mastered || 0,
      exams: b?.exams || 0,
      certs: b?.certs || 0,
      lastActivityAt: b?.lastAt || null,
      lastUnit: b?.topUnit || null,
    };
  });

  const moving = rows.filter((r) => r.moving).sort((a, b) => b.unitsMastered - a.unitsMastered || new Date(b.lastActivityAt) - new Date(a.lastActivityAt));
  const idle = rows.filter((r) => !r.moving).sort((a, b) => b.readiness - a.readiness);
  res.json({ days, since, moving, idle, total: rows.length });
});

// ── Corong kandidat per posisi + kekurangan kolam talenta ────────────────────
// Dua-duanya butuh pencocokan SEMUA talenta x SEMUA posisi, jadi dihitung sekali lalu
// dipakai bersama. Skala data di sini kecil (puluhan talenta, belasan posisi).
async function poolMatrix(userScope) {
  const [jobs, workers, interests, reviews] = await Promise.all([
    prisma.job.findMany({ where: { status: "open", ...(userScope ? { postedById: userScope } : {}) }, orderBy: { createdAt: "desc" } }),
    prisma.user.findMany({ where: { role: "user" }, select: { id: true, name: true } }),
    prisma.jobApplication.findMany({ select: { jobId: true, userId: true } }),
    prisma.candidateReview.findMany({ select: { jobId: true, userId: true, status: true, invitedAt: true } }),
  ]);
  // Profil skill dihitung SEKALI per talenta, bukan per pasangan posisi-talenta.
  const profiles = new Map();
  for (const w of workers) profiles.set(w.id, await buildSkillProfile(w.id));

  const interestOf = new Set(interests.map((i) => `${i.jobId}:${i.userId}`));
  const reviewOf = new Map(reviews.map((r) => [`${r.jobId}:${r.userId}`, r]));

  const rows = jobs.map((j) => {
    const job = shapeJob(j);
    let eligible = 0, almost = 0, interested = 0, shortlisted = 0, invited = 0, best = null;
    const missingTally = new Map();
    for (const w of workers) {
      const m = matchJob(job, profiles.get(w.id));
      if (m.eligible) eligible++;
      if (m.readyToValidate) almost++;
      if (interestOf.has(`${j.id}:${w.id}`)) interested++;
      const r = reviewOf.get(`${j.id}:${w.id}`);
      if (r?.status === "shortlisted" || r?.status === "accepted") shortlisted++;
      if (r?.invitedAt) invited++;
      if (!best || m.score > best.score) best = { name: w.name, score: m.score };
      for (const s of m.missingSkills) missingTally.set(s, (missingTally.get(s) || 0) + 1);
    }
    return {
      id: j.id, title: j.title, company: j.company, kkniLevel: j.kkniLevel,
      skills: job.skills, totalTalents: workers.length,
      eligible, almost, interested, shortlisted, invited, best,
      hardestSkills: [...missingTally.entries()].sort((a, b) => b[1] - a[1]).slice(0, 3).map(([skill, n]) => ({ skill, missing: n })),
    };
  });
  return { jobs: rows, workerCount: workers.length };
}

// Corong kandidat tiap posisi milik HRD ini (admin melihat semua).
router.get("/pipeline", async (req, res) => {
  const scope = req.user.role === "admin" ? null : req.user.id;
  const { jobs, workerCount } = await poolMatrix(scope);
  res.json({ workerCount, jobs });
});

// Skill yang paling banyak diminta posisi tapi paling sedikit dikuasai talenta.
// Inilah penghubung antara seleksi dan pengembangan: hasilnya menjadi dasar kelas apa
// yang perlu dibuka, bukan sekadar daftar orang yang gagal.
router.get("/skill-shortage", async (req, res) => {
  const scope = req.user.role === "admin" ? null : req.user.id;
  const [{ jobs, workerCount }, workers] = await Promise.all([
    poolMatrix(scope),
    prisma.user.findMany({ where: { role: "user" }, select: { id: true } }),
  ]);

  const tally = new Map();
  const bump = (skill, key, n = 1) => {
    if (!tally.has(skill)) tally.set(skill, { skill, jobs: 0, missing: 0, claimed: 0, proven: 0 });
    tally.get(skill)[key] += n;
  };
  for (const j of jobs) {
    for (const s of j.skills) bump(s, "jobs");
    for (const h of j.hardestSkills) bump(h.skill, "missing", h.missing);
  }

  // Berapa talenta yang sudah membuktikan / baru mengklaim tiap skill.
  const allSkills = [...tally.keys()];
  if (allSkills.length) {
    for (const w of workers) {
      const p = await buildSkillProfile(w.id);
      const fake = { skills: allSkills, certifications: [], kkniLevel: 0, minExperience: 0 };
      const m = matchJob(fake, p);
      for (const s of m.matchedSkills) bump(s, "proven");
      for (const s of m.claimedSkills) bump(s, "claimed");
    }
  }

  const rows = [...tally.values()]
    .map((r) => ({ ...r, coverage: workerCount ? Math.round((r.proven / workerCount) * 100) : 0 }))
    // Paling mendesak: paling sering diminta posisi, paling sedikit yang menguasai.
    .sort((a, b) => (b.jobs - a.jobs) || (a.proven - b.proven))
    .slice(0, 12);

  res.json({ workerCount, jobCount: jobs.length, skills: rows });
});

router.get("/export/excel", async (req, res) => {
  const workers = await prisma.user.findMany({ where: { role: "user" } });
  const summary = await competencySummary(workers.map((w) => w.id));
  const data = workers.map((w) => {
    const s = summary[w.id] || {};
    return {
      Nama: w.name, Email: w.email, "Status Akademik": w.academicStatus || "-", Pendidikan: w.education || "-",
      "Kompetensi Target": w.chosenSkkniTitle || "-",
      "Rank": w.currentKkniLevel ? rankName(w.currentKkniLevel) : "-",
      "Unit Lulus": `${s.passedUnits || 0}/${s.totalUnits || 0}`,
      "Sertifikat": s.certCount || 0,
      "Readiness (%)": w.readinessScore || 0, Status: w.status || "not_ready",
      "Ujian Terakhir": s.lastExamAt ? new Date(s.lastExamAt).toLocaleDateString("id-ID") : "-",
    };
  });
  const wb = xlsx.utils.book_new();
  xlsx.utils.book_append_sheet(wb, xlsx.utils.json_to_sheet(data), "Talent Mapping");
  const buf = xlsx.write(wb, { type: "buffer", bookType: "xlsx" });
  res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
  res.setHeader("Content-Disposition", `attachment; filename=talent-mapping-${Date.now()}.xlsx`);
  res.send(buf);
});

// Daftar PUTIH, bukan daftar hitam. Versi lama hanya membuang `passwordHash` lalu menyebar
// sisanya - termasuk `cvMeta` (isi CV: pendidikan, sertifikasi, tautan LinkedIn/Instagram/
// portofolio), `googleId`, dan `avatarUrl` (gambar base64). Tampilan HRD tak memakai satu pun
// dari itu, jadi setiap perekrut mengunduh isi CV seluruh talenta hanya untuk membuka tabel.
const WORKER_FIELDS = [
  "id", "name", "email", "role", "department", "position", "education", "academicStatus",
  "experienceYears", "currentKkniLevel", "targetKkniLevel", "readinessScore", "status",
  "chosenSkkniId", "chosenSkkniTitle", "targetRole", "cvFileName", "cvUploadedAt", "createdAt",
];

function safeUser(u) {
  const out = {};
  for (const k of WORKER_FIELDS) if (u[k] !== undefined) out[k] = u[k];
  try { out.certifications = JSON.parse(u.certifications || "[]"); } catch { out.certifications = []; }
  return out;
}

export default router;
