import express from "express";
import { prisma } from "../prisma.js";
import { requireAuth, requireRole } from "../middleware/auth.js";
import { buildSkillProfile, matchJob, safeArr, detectSkillEvidence } from "../jobmatch.js";

// Peta Posisi & Kesiapan (talent mapping internal - BUKAN rekrutmen eksternal):
// HRD memposting profil posisi berkriteria (level KKNI, skill, pengalaman, sertifikasi) + modul
// belajar. Pekerja melihat KESIAPAN skill-nya (acuan) & bisa "Jadikan Target" (minat lunak).
// HRD mendapat TALENT POOL: semua pekerja terurut kecocokan + penanda yang berminat. Admin lihat semua.
const router = express.Router();
router.use(requireAuth);

const shapeJob = (j) => ({
  ...j,
  skills: safeArr(j.skills),
  certifications: safeArr(j.certifications),
  modules: safeArr(j.modules),
});
const cleanModules = (arr) =>
  (Array.isArray(arr) ? arr : [])
    .map((m) => (typeof m === "string" ? { title: m } : { title: String(m?.title || "").trim(), url: m?.url ? String(m.url).trim() : undefined }))
    .filter((m) => m.title)
    .slice(0, 20);

// ── Manajemen (HRD/Admin) - didefinisikan sebelum "/:id" ─────────────────────
router.post("/", requireRole("hrd", "admin"), async (req, res) => {
  const b = req.body || {};
  const me = await prisma.user.findUnique({ where: { id: req.user.id } });
  const job = await prisma.job.create({
    data: {
      postedById: req.user.id, postedByName: me?.name || "HRD",
      company: b.company || null, title: String(b.title || "Posisi"),
      description: b.description || null, department: b.department || null, location: b.location || null,
      kkniLevel: parseInt(b.kkniLevel) || 1,
      skills: JSON.stringify(Array.isArray(b.skills) ? b.skills : []),
      minExperience: parseInt(b.minExperience) || 0,
      certifications: JSON.stringify(Array.isArray(b.certifications) ? b.certifications : []),
      modules: JSON.stringify(cleanModules(b.modules)),
      status: b.status === "closed" ? "closed" : "open",
    },
  });
  res.status(201).json(shapeJob(job));
});

// Posisi milik HRD ini (atau semua untuk admin) + jumlah peminat.
router.get("/mine", requireRole("hrd", "admin"), async (req, res) => {
  const where = req.user.role === "admin" ? {} : { postedById: req.user.id };
  const jobs = await prisma.job.findMany({ where, orderBy: { createdAt: "desc" }, include: { _count: { select: { applications: true } } } });
  res.json(jobs.map((j) => ({ ...shapeJob(j), interestedCount: j._count.applications })));
});

router.get("/all", requireRole("admin"), async (req, res) => {
  const jobs = await prisma.job.findMany({ orderBy: { createdAt: "desc" }, include: { _count: { select: { applications: true } } } });
  res.json(jobs.map((j) => ({ ...shapeJob(j), interestedCount: j._count.applications })));
});

// Posisi yang dijadikan target oleh pekerja yang login.
router.get("/targets/me", requireRole("user"), async (req, res) => {
  const rows = await prisma.jobApplication.findMany({ where: { userId: req.user.id }, select: { jobId: true } });
  res.json({ jobIds: rows.map((r) => r.jobId) });
});

// ── Telusuri (semua role; kesiapan hanya untuk pekerja) ──────────────────────
router.get("/", async (req, res) => {
  const jobs = await prisma.job.findMany({ where: { status: "open" }, orderBy: { createdAt: "desc" } });
  let profile = null, targetSet = new Set();
  if (req.user.role === "user") {
    profile = await buildSkillProfile(req.user.id);
    const rows = await prisma.jobApplication.findMany({ where: { userId: req.user.id }, select: { jobId: true } });
    targetSet = new Set(rows.map((r) => r.jobId));
  }
  res.json(jobs.map((j) => {
    const job = shapeJob(j);
    return profile ? { ...job, match: matchJob(job, profile), targeted: targetSet.has(j.id) } : job;
  }));
});

router.get("/:id", async (req, res) => {
  const j = await prisma.job.findUnique({ where: { id: req.params.id } });
  if (!j) return res.status(404).json({ error: "Posisi tidak ditemukan." });
  const job = shapeJob(j);
  let match = null, targeted = false, claims = [];
  if (req.user.role === "user") {
    match = matchJob(job, await buildSkillProfile(req.user.id));
    targeted = !!(await prisma.jobApplication.findUnique({ where: { jobId_userId: { jobId: j.id, userId: req.user.id } } }));
    claims = await prisma.skillClaim.findMany({ where: { userId: req.user.id, jobId: j.id }, orderBy: { createdAt: "desc" } }).catch(() => []);
  }
  res.json({ ...job, match, targeted, claims });
});

// Kirim CV/portofolio untuk MENGKLAIM sebuah skill posisi (#5). AI mendeteksi indikasi
// bukti - tapi klaim ini TIDAK memvalidasi kompetensi; validasi hanya dari lulus ujian.
router.post("/:id/detect-skill", requireRole("user"), async (req, res) => {
  const j = await prisma.job.findUnique({ where: { id: req.params.id } });
  if (!j) return res.status(404).json({ error: "Posisi tidak ditemukan." });
  const skill = String(req.body?.skill || "").trim().slice(0, 160);
  const detail = String(req.body?.detail || "").trim().slice(0, 1200);
  if (!skill) return res.status(400).json({ error: "Skill wajib diisi." });

  const u = await prisma.user.findUnique({ where: { id: req.user.id }, select: { cvMeta: true } });
  let cvMeta = {}; try { cvMeta = JSON.parse(u?.cvMeta || "{}"); } catch { /* ignore */ }
  const result = await detectSkillEvidence({ skill, cvMeta, detail });

  const claim = await prisma.skillClaim.upsert({
    where: { userId_jobId_skill: { userId: req.user.id, jobId: j.id, skill } },
    create: { userId: req.user.id, jobId: j.id, skill, source: detail ? "portfolio" : "cv", detail: detail || null, aiDetected: result.detected, aiNote: result.note },
    update: { source: detail ? "portfolio" : "cv", detail: detail || null, aiDetected: result.detected, aiNote: result.note, createdAt: new Date() },
  });
  res.json({ claim, detected: result.detected, note: result.note });
});

// Hapus sebuah klaim skill.
router.delete("/claim/:claimId", requireRole("user"), async (req, res) => {
  const c = await prisma.skillClaim.findUnique({ where: { id: req.params.claimId } });
  if (!c || c.userId !== req.user.id) return res.status(404).json({ error: "Klaim tidak ditemukan." });
  await prisma.skillClaim.delete({ where: { id: c.id } });
  res.json({ ok: true });
});

router.put("/:id", requireRole("hrd", "admin"), async (req, res) => {
  const j = await prisma.job.findUnique({ where: { id: req.params.id } });
  if (!j) return res.status(404).json({ error: "Tidak ditemukan." });
  if (req.user.role !== "admin" && j.postedById !== req.user.id) return res.status(403).json({ error: "Bukan posisi Anda." });
  const b = req.body || {};
  const data = {};
  for (const k of ["company", "title", "description", "department", "location", "status"]) if (b[k] !== undefined) data[k] = b[k];
  if (b.kkniLevel !== undefined) data.kkniLevel = parseInt(b.kkniLevel) || 1;
  if (b.minExperience !== undefined) data.minExperience = parseInt(b.minExperience) || 0;
  if (b.skills !== undefined) data.skills = JSON.stringify(Array.isArray(b.skills) ? b.skills : []);
  if (b.certifications !== undefined) data.certifications = JSON.stringify(Array.isArray(b.certifications) ? b.certifications : []);
  if (b.modules !== undefined) data.modules = JSON.stringify(cleanModules(b.modules));
  const updated = await prisma.job.update({ where: { id: j.id }, data });
  res.json(shapeJob(updated));
});

router.delete("/:id", requireRole("hrd", "admin"), async (req, res) => {
  const j = await prisma.job.findUnique({ where: { id: req.params.id } });
  if (!j) return res.status(404).json({ error: "Tidak ditemukan." });
  if (req.user.role !== "admin" && j.postedById !== req.user.id) return res.status(403).json({ error: "Bukan posisi Anda." });
  await prisma.jobApplication.deleteMany({ where: { jobId: j.id } });
  await prisma.job.delete({ where: { id: j.id } });
  res.json({ ok: true });
});

// Pekerja menyatakan/mencabut MINAT ("Jadikan Target") - sinyal lunak, bukan lamaran.
router.post("/:id/interest", requireRole("user"), async (req, res) => {
  const j = await prisma.job.findUnique({ where: { id: req.params.id } });
  if (!j || j.status !== "open") return res.status(404).json({ error: "Posisi tidak tersedia." });
  const existing = await prisma.jobApplication.findUnique({ where: { jobId_userId: { jobId: j.id, userId: req.user.id } } });
  if (existing) {
    await prisma.jobApplication.delete({ where: { id: existing.id } });
    return res.json({ targeted: false });
  }
  const match = matchJob(shapeJob(j), await buildSkillProfile(req.user.id));
  await prisma.jobApplication.create({ data: { jobId: j.id, userId: req.user.id, matchScore: match.score, status: "interested" } });
  res.json({ targeted: true, match });
});

// Talent Pool sebuah posisi (HRD pemilik / admin): SEMUA pekerja terurut kecocokan,
// ditandai siapa yang menyatakan minat. Ini benefit HRD: kandidat siap + yang termotivasi.
router.get("/:id/candidates", requireRole("hrd", "admin"), async (req, res) => {
  const j = await prisma.job.findUnique({ where: { id: req.params.id } });
  if (!j) return res.status(404).json({ error: "Tidak ditemukan." });
  if (req.user.role !== "admin" && j.postedById !== req.user.id) return res.status(403).json({ error: "Bukan posisi Anda." });
  const job = shapeJob(j);

  const [workers, interests] = await Promise.all([
    prisma.user.findMany({ where: { role: "user" }, select: { id: true, name: true, email: true, currentKkniLevel: true, experienceYears: true, department: true, position: true, status: true } }),
    prisma.jobApplication.findMany({ where: { jobId: j.id }, select: { userId: true } }),
  ]);
  const interestedSet = new Set(interests.map((i) => i.userId));

  const candidates = await Promise.all(workers.map(async (w) => {
    const m = matchJob(job, await buildSkillProfile(w.id));
    return { user: w, matchScore: m.score, eligible: m.eligible, missingSkills: m.missingSkills, interested: interestedSet.has(w.id) };
  }));
  candidates.sort((a, b) => (b.interested - a.interested) || (b.matchScore - a.matchScore));
  res.json({ job, candidates, interestedCount: interestedSet.size });
});

export default router;
