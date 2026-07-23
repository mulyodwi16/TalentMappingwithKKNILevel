import express from "express";
import xlsx from "xlsx";
import { prisma } from "../prisma.js";
import { requireAuth, requireRole } from "../middleware/auth.js";
import { rankName } from "../rank.js";
import { buildSkillProfile, matchJob, matchJobDeep, safeArr, detectSkillEvidence } from "../jobmatch.js";
import { uiLang } from "../uilang.js";

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
// Daftar skill WAJIB. Tanpa itu tak ada yang bisa dicocokkan, dan seluruh kolam talenta
// akan terbaca "memenuhi syarat" - angka yang paling mahal salahnya di produk ini.
function cleanSkills(v) {
  return (Array.isArray(v) ? v : []).map((s) => String(s || "").trim()).filter(Boolean).slice(0, 30);
}

router.post("/", requireRole("hrd", "admin"), async (req, res) => {
  const b = req.body || {};
  const skills = cleanSkills(b.skills);
  if (!skills.length) return res.status(400).json({ error: "Isi minimal satu kemampuan yang dibutuhkan posisi ini." });
  const me = await prisma.user.findUnique({ where: { id: req.user.id } });
  const job = await prisma.job.create({
    data: {
      postedById: req.user.id, postedByName: me?.name || "HRD",
      company: b.company || null, title: String(b.title || "Posisi"),
      description: b.description || null, department: b.department || null, location: b.location || null,
      kkniLevel: parseInt(b.kkniLevel) || 1,
      skills: JSON.stringify(skills),
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

// Undangan yang diterima talenta + jawabannya. Tanpa ini undangan cuma satu arah:
// HRD mengirim lalu menebak-nebak apakah orangnya benar-benar mau.
router.get("/invites/me", requireRole("user"), async (req, res) => {
  const rows = await prisma.candidateReview.findMany({
    where: { userId: req.user.id, invitedAt: { not: null } },
    orderBy: { invitedAt: "desc" },
    include: { job: { select: { id: true, title: true, company: true, location: true, status: true } } },
  });
  res.json(rows.map((r) => ({
    jobId: r.jobId, job: r.job, invitedAt: r.invitedAt,
    reply: r.reply, replyNote: r.replyNote, repliedAt: r.repliedAt,
  })));
});

const REPLIES = new Set(["tertarik", "belum_siap"]);
router.post("/:id/invite/reply", requireRole("user"), async (req, res) => {
  const reply = String(req.body?.reply || "");
  if (!REPLIES.has(reply)) return res.status(400).json({ error: "Jawaban tidak dikenal." });
  const existing = await prisma.candidateReview.findUnique({
    where: { jobId_userId: { jobId: req.params.id, userId: req.user.id } },
  });
  if (!existing?.invitedAt) return res.status(404).json({ error: "Undangan tidak ditemukan." });

  const note = String(req.body?.note || "").slice(0, 300).trim() || null;
  const updated = await prisma.candidateReview.update({
    where: { jobId_userId: { jobId: req.params.id, userId: req.user.id } },
    data: { reply, replyNote: note, repliedAt: new Date() },
  });

  // Perekrut yang mengundang ikut diberi tahu - kalau tidak, jawabannya cuma mengendap.
  const job = await prisma.job.findUnique({ where: { id: req.params.id }, select: { title: true, postedById: true } });
  const me = await prisma.user.findUnique({ where: { id: req.user.id }, select: { name: true } });
  if (job?.postedById) {
    const label = reply === "tertarik" ? "tertarik" : "belum siap";
    await prisma.notification.create({
      data: {
        userId: job.postedById, type: "jawaban_undangan",
        message: `${me?.name || "Talenta"} menjawab undangan posisi "${job.title}": ${label}.${note ? ` Catatan: ${note}` : ""}`,
      },
    }).catch(() => {});
  }
  res.json(updated);
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
    // Detail posisi = satu pengguna x satu posisi, jadi di SINILAH jembatan AI dipakai untuk
    // syarat yang tak tertangkap pencocokan kata. Daftar posisi (`GET /`) & kolam talenta HRD
    // TETAP memakai matchJob biasa - di sana pencocokan terjadi N x M dan AI akan meledak.
    match = await matchJobDeep(job, await buildSkillProfile(req.user.id), uiLang(req));
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
  if (b.skills !== undefined) {
    const skills = cleanSkills(b.skills);
    if (!skills.length) return res.status(400).json({ error: "Isi minimal satu kemampuan yang dibutuhkan posisi ini." });
    data.skills = JSON.stringify(skills);
  }
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

  const [workers, interests, reviews] = await Promise.all([
    prisma.user.findMany({ where: { role: "user" }, select: { id: true, name: true, email: true, currentKkniLevel: true, experienceYears: true, department: true, position: true, status: true } }),
    prisma.jobApplication.findMany({ where: { jobId: j.id }, select: { userId: true } }),
    prisma.candidateReview.findMany({ where: { jobId: j.id } }),
  ]);
  const interestedSet = new Set(interests.map((i) => i.userId));
  const reviewOf = new Map(reviews.map((r) => [r.userId, r]));

  const candidates = await Promise.all(workers.map(async (w) => {
    const m = matchJob(job, await buildSkillProfile(w.id));
    const r = reviewOf.get(w.id);
    return {
      user: w, matchScore: m.score, eligible: m.eligible,
      missingSkills: m.missingSkills,
      // Skill yang sudah DIKLAIM di CV tapi belum dibuktikan lewat ujian. Ini yang dicari
      // HRD: orang yang sebenarnya mampu dan tinggal selangkah dari memenuhi syarat.
      claimedSkills: m.claimedSkills,
      readyToValidate: m.readyToValidate,
      levelGap: m.levelGap, expGap: m.expGap,
      interested: interestedSet.has(w.id),
      review: r ? { status: r.status, note: r.note, invitedAt: r.invitedAt, reply: r.reply, replyNote: r.replyNote, repliedAt: r.repliedAt, updatedAt: r.updatedAt } : null,
    };
  }));
  candidates.sort((a, b) => (b.interested - a.interested) || (b.matchScore - a.matchScore));
  res.json({ job, candidates, interestedCount: interestedSet.size });
});

// ── Seleksi kandidat (HRD pemilik / admin) ───────────────────────────────────
const REVIEW_STATUS = new Set(["new", "reviewed", "shortlisted", "rejected", "accepted"]);

async function ownedJob(req, res) {
  const j = await prisma.job.findUnique({ where: { id: req.params.id } });
  if (!j) { res.status(404).json({ error: "Tidak ditemukan." }); return null; }
  if (req.user.role !== "admin" && j.postedById !== req.user.id) { res.status(403).json({ error: "Bukan posisi Anda." }); return null; }
  return j;
}

// Tandai kandidat. Baris dibuat saat dibutuhkan - talenta yang belum pernah dinilai
// tidak punya baris sama sekali, jadi "belum dinilai" tetap bisa dibedakan dari "dilewati".
router.put("/:id/candidates/:userId", requireRole("hrd", "admin"), async (req, res) => {
  const j = await ownedJob(req, res);
  if (!j) return;
  const b = req.body || {};
  const data = {};
  if (b.status != null) {
    if (!REVIEW_STATUS.has(b.status)) return res.status(400).json({ error: "Status tidak dikenal." });
    data.status = b.status;
  }
  if (b.note !== undefined) data.note = String(b.note || "").slice(0, 500) || null;
  if (!Object.keys(data).length) return res.status(400).json({ error: "Tidak ada perubahan." });
  data.reviewerId = req.user.id;

  const review = await prisma.candidateReview.upsert({
    where: { jobId_userId: { jobId: j.id, userId: req.params.userId } },
    update: data,
    create: { jobId: j.id, userId: req.params.userId, status: data.status || "reviewed", note: data.note ?? null, reviewerId: req.user.id },
  });
  res.json(review);
});

// Undang talenta ke posisi: notifikasi ke talenta + tercatat di seleksi.
// Pesannya menyebut apa yang masih kurang - inilah jembatan balik ke belajar, bukan
// sekadar pemberitahuan "kamu terpilih".
router.post("/:id/candidates/:userId/invite", requireRole("hrd", "admin"), async (req, res) => {
  const j = await ownedJob(req, res);
  if (!j) return;
  const w = await prisma.user.findFirst({ where: { id: req.params.userId, role: "user" } });
  if (!w) return res.status(404).json({ error: "Talenta tidak ditemukan." });

  const job = shapeJob(j);
  const m = matchJob(job, await buildSkillProfile(w.id));
  const custom = String(req.body?.message || "").slice(0, 300).trim();

  const where = j.company ? ` di ${j.company}` : "";
  let msg = `Kamu diundang melihat posisi "${j.title}"${where}. Kecocokanmu ${m.score}%.`;
  if (m.missingSkills.length) msg += ` Yang masih perlu dikuasai: ${m.missingSkills.slice(0, 3).join(", ")}.`;
  else if (m.claimedSkills.length) msg += ` Keahlianmu sudah sesuai - tinggal dibuktikan lewat ujian: ${m.claimedSkills.slice(0, 3).join(", ")}.`;
  else msg += " Kamu sudah memenuhi syaratnya.";
  if (custom) msg += ` Pesan dari perekrut: ${custom}`;

  await prisma.notification.create({ data: { userId: w.id, type: "undangan_posisi", message: msg } });
  const review = await prisma.candidateReview.upsert({
    where: { jobId_userId: { jobId: j.id, userId: w.id } },
    update: { invitedAt: new Date(), reviewerId: req.user.id },
    create: { jobId: j.id, userId: w.id, status: "reviewed", invitedAt: new Date(), reviewerId: req.user.id },
  });
  res.json({ invited: true, review, message: msg });
});

// Ekspor kandidat sebuah posisi (skor, status seleksi, bukti, yang masih kurang).
router.get("/:id/candidates/export", requireRole("hrd", "admin"), async (req, res) => {
  const j = await ownedJob(req, res);
  if (!j) return;
  const job = shapeJob(j);

  const [workers, interests, reviews] = await Promise.all([
    prisma.user.findMany({ where: { role: "user" }, orderBy: { name: "asc" } }),
    prisma.jobApplication.findMany({ where: { jobId: j.id }, select: { userId: true } }),
    prisma.candidateReview.findMany({ where: { jobId: j.id } }),
  ]);
  const interestedSet = new Set(interests.map((i) => i.userId));
  const reviewOf = new Map(reviews.map((r) => [r.userId, r]));
  const LABEL = { new: "Belum dinilai", reviewed: "Sudah dilihat", shortlisted: "Daftar pendek", rejected: "Tidak cocok", accepted: "Diterima" };

  const rows = [];
  for (const w of workers) {
    const m = matchJob(job, await buildSkillProfile(w.id));
    const r = reviewOf.get(w.id);
    rows.push({
      Nama: w.name, Email: w.email,
      "Rank": w.currentKkniLevel ? rankName(w.currentKkniLevel) : "-",
      "Kompetensi Target": w.chosenSkkniTitle || "-",
      "Kecocokan (%)": m.score,
      "Memenuhi Syarat": m.eligible ? "Ya" : "Tidak",
      "Skill Terbukti": m.matchedSkills.join("; ") || "-",
      "Baru Diklaim": m.claimedSkills.join("; ") || "-",
      "Masih Kurang": m.missingSkills.join("; ") || "-",
      "Pengalaman (th)": w.experienceYears || 0,
      "Menyatakan Minat": interestedSet.has(w.id) ? "Ya" : "Tidak",
      "Status Seleksi": LABEL[r?.status] || LABEL.new,
      "Diundang": r?.invitedAt ? new Date(r.invitedAt).toLocaleDateString("id-ID") : "-",
      "Jawaban Talenta": r?.reply === "tertarik" ? "Tertarik" : r?.reply === "belum_siap" ? "Belum siap" : "-",
      "Catatan": r?.note || "-",
    });
  }
  rows.sort((a, b) => b["Kecocokan (%)"] - a["Kecocokan (%)"]);

  const wb = xlsx.utils.book_new();
  xlsx.utils.book_append_sheet(wb, xlsx.utils.json_to_sheet(rows), "Kandidat");
  const buf = xlsx.write(wb, { type: "buffer", bookType: "xlsx" });
  const safeName = String(j.title).replace(/[^a-zA-Z0-9]+/g, "-").toLowerCase();
  res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
  res.setHeader("Content-Disposition", `attachment; filename=kandidat-${safeName}-${Date.now()}.xlsx`);
  res.send(buf);
});

export default router;
