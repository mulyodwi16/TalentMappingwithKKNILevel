import express from "express";
import bcrypt from "bcryptjs";
import { prisma } from "../prisma.js";
import { requireAuth, requireRole } from "../middleware/auth.js";

const router = express.Router();
router.use(requireAuth, requireRole("admin"));

const audit = (req, action, target, meta) =>
  prisma.auditLog.create({ data: { actorId: req.user.id, actorEmail: req.user.email, action, target, meta } });

// ── Dashboard ─────────────────────────────────────────────────────────────────
router.get("/dashboard", async (req, res) => {
  const [totalUsers, totalWorkers, pendingRequests, recentLogs, workers] = await Promise.all([
    prisma.user.count(),
    prisma.user.count({ where: { role: "user" } }),
    prisma.request.count({ where: { status: "pending" } }),
    prisma.auditLog.findMany({ orderBy: { createdAt: "desc" }, take: 5 }),
    prisma.user.findMany({ where: { role: "user" }, select: { status: true } }),
  ]);
  const statusCounts = workers.reduce((acc, u) => {
    acc[u.status || "not_ready"] = (acc[u.status || "not_ready"] || 0) + 1;
    return acc;
  }, {});
  res.json({ totalUsers, totalWorkers, pendingRequests, statusCounts, recentLogs });
});

// ── Users CRUD ────────────────────────────────────────────────────────────────
router.get("/users", async (req, res) => {
  const users = await prisma.user.findMany({ orderBy: [{ role: "asc" }, { name: "asc" }] });
  res.json(users.map(safeUser));
});

const ROLES = ["user", "hrd", "admin"];
// Kolom yang boleh disetel dari panel admin. Dulu SELURUH isi body disebar ke Prisma, jadi
// klien bisa menulis readinessScore, currentKkniLevel, atau googleId langsung - angka yang
// seharusnya dihitung dari bukti bisa dikarang, dan akun bisa ditautkan ke Google orang lain.
const USER_EDITABLE = ["name", "email", "role", "department", "position", "education", "academicStatus", "experienceYears"];
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function pickUserData(body) {
  const data = {};
  for (const k of USER_EDITABLE) if (body[k] !== undefined) data[k] = body[k];
  if (data.email !== undefined) data.email = String(data.email).trim().toLowerCase();
  if (data.experienceYears !== undefined) data.experienceYears = parseInt(data.experienceYears) || 0;
  return data;
}

router.post("/users", async (req, res) => {
  const { password, certifications } = req.body || {};
  const data = pickUserData(req.body || {});
  if (!data.name?.trim()) return res.status(400).json({ error: "nama wajib diisi" });
  if (!EMAIL_RE.test(data.email || "")) return res.status(400).json({ error: "format email tidak valid" });
  // Tanpa ini, body tanpa password diam-diam membuat akun berkata sandi "demo123".
  if (!password || String(password).length < 6) return res.status(400).json({ error: "kata sandi minimal 6 karakter" });
  if (data.role && !ROLES.includes(data.role)) return res.status(400).json({ error: `role harus salah satu dari: ${ROLES.join(", ")}` });
  if (await prisma.user.findUnique({ where: { email: data.email } }))
    return res.status(409).json({ error: "email sudah dipakai" });
  const u = await prisma.user.create({
    data: { ...data, role: data.role || "user", passwordHash: await bcrypt.hash(password, 10), certifications: JSON.stringify(certifications || []) },
  });
  await audit(req, "create_user", u.email, JSON.stringify({ role: u.role }));
  res.status(201).json(safeUser(u));
});

router.put("/users/:id", async (req, res) => {
  const { password, certifications } = req.body || {};
  const before = await prisma.user.findUnique({ where: { id: req.params.id } });
  if (!before) return res.status(404).json({ error: "user not found" });

  const data = pickUserData(req.body || {});
  if (data.email !== undefined && !EMAIL_RE.test(data.email)) return res.status(400).json({ error: "format email tidak valid" });
  if (data.role && !ROLES.includes(data.role)) return res.status(400).json({ error: `role harus salah satu dari: ${ROLES.join(", ")}` });
  if (before.id === req.user.id && data.role && data.role !== "admin")
    return res.status(400).json({ error: "tidak bisa menurunkan role diri sendiri" });
  if (password !== undefined) {
    if (String(password).length < 6) return res.status(400).json({ error: "kata sandi minimal 6 karakter" });
    data.passwordHash = await bcrypt.hash(password, 10);
  }
  if (certifications !== undefined) data.certifications = JSON.stringify(certifications);

  const u = await prisma.user.update({ where: { id: before.id }, data }).catch(() => null);
  if (!u) return res.status(409).json({ error: "gagal menyimpan perubahan (email mungkin sudah dipakai)" });

  // Catat APA yang berubah. Entri "update_user someone@x.com" tanpa isi tak bisa dipakai
  // menelusuri siapa yang menaikkan role seseorang jadi admin.
  const changed = {};
  for (const k of USER_EDITABLE) if (data[k] !== undefined && data[k] !== before[k]) changed[k] = { dari: before[k], jadi: data[k] };
  if (data.passwordHash) changed.password = "diubah";
  await audit(req, "update_user", u.email, JSON.stringify(changed));
  res.json(safeUser(u));
});

// Baris anak yang harus ikut terhapus. Skema ini hanya punya dua relasi onDelete: Cascade,
// dan tak satu pun di User - jadi `user.delete` melempar P2003 begitu orangnya punya SATU
// notifikasi, dompet koin, atau percobaan ujian. Versi lama menangkap error itu lalu
// membalas "user not found", sehingga operator melihat pesan yang jelas-jelas salah untuk
// orang yang jelas terlihat di tabel. Urutannya dari daun ke akar.
const USER_CHILDREN = [
  "placementInstance", "competencyExamInstance", "placementAttempt", "placementAccess", "externalEvidence",
  "unitExamReview", "skillClaim", "learningPlan", "dailyMission", "dailyQuizLog",
  "certificate", "jobApplication", "candidateReview", "coinTransaction", "coinWallet",
  "shopRedemption", "skkniExam", "unitProgress", "unitExamInstance", "examAttempt",
  "skillAssessment", "recommendation", "notification",
];

router.delete("/users/:id", async (req, res) => {
  if (req.params.id === req.user.id) return res.status(400).json({ error: "tidak bisa hapus diri sendiri" });
  const u = await prisma.user.findUnique({ where: { id: req.params.id } });
  if (!u) return res.status(404).json({ error: "user not found" });

  // Posisi yang pernah dibuka HRD dipegang orang lain (kandidat, minat) - menghapusnya diam-diam
  // akan menghilangkan pekerjaan orang lain. Minta posisinya diberesi dulu.
  const jobCount = await prisma.job.count({ where: { postedById: u.id } });
  if (jobCount) return res.status(409).json({ error: `Akun ini masih memegang ${jobCount} posisi. Hapus atau pindahkan posisinya dulu.` });

  // `AuditLog.actorId` relasi WAJIB ke User, jadi barisnya harus ikut terhapus - tak bisa
  // dikosongkan tanpa mengubah skema. Jumlahnya dicatat di entri audit penghapusan ini
  // supaya jejak yang hilang tetap terlihat, bukan lenyap tanpa keterangan.
  const logCount = await prisma.auditLog.count({ where: { actorId: u.id } });

  try {
    await prisma.$transaction([
      ...USER_CHILDREN.map((m) => prisma[m].deleteMany({ where: { userId: u.id } })),
      prisma.request.deleteMany({ where: { fromId: u.id } }),
      prisma.auditLog.deleteMany({ where: { actorId: u.id } }),
      prisma.user.delete({ where: { id: u.id } }),
    ]);
  } catch (e) {
    console.error("delete_user:", e.message);
    return res.status(409).json({ error: "Akun tidak bisa dihapus karena masih terkait data lain. Periksa log server." });
  }

  await audit(req, "delete_user", u.email, JSON.stringify({ role: u.role, name: u.name, auditLogsRemoved: logCount }));
  res.json({ ok: true });
});

// ── KKNI Levels CRUD ──────────────────────────────────────────────────────────
router.get("/kkni-levels", async (req, res) => {
  const rows = await prisma.kkniLevel.findMany({ orderBy: { level: "asc" } });
  res.json(rows.map((r) => ({ ...r, descriptors: JSON.parse(r.descriptors) })));
});

router.post("/kkni-levels", async (req, res) => {
  const { descriptors, ...data } = req.body;
  const kl = await prisma.kkniLevel.create({ data: { ...data, descriptors: JSON.stringify(descriptors || {}) } });
  await audit(req, "create_kkni_level", String(kl.level));
  res.status(201).json({ ...kl, descriptors: JSON.parse(kl.descriptors) });
});

router.put("/kkni-levels/:id", async (req, res) => {
  const { descriptors, ...data } = req.body;
  if (descriptors !== undefined) data.descriptors = JSON.stringify(descriptors);
  const kl = await prisma.kkniLevel.update({ where: { id: req.params.id }, data });
  await audit(req, "update_kkni_level", String(kl.level));
  res.json({ ...kl, descriptors: JSON.parse(kl.descriptors) });
});

router.delete("/kkni-levels/:id", async (req, res) => {
  await prisma.kkniLevel.delete({ where: { id: req.params.id } });
  await audit(req, "delete_kkni_level", req.params.id);
  res.json({ ok: true });
});

// ── Competencies CRUD ─────────────────────────────────────────────────────────
router.get("/competencies", async (req, res) => {
  const rows = await prisma.competency.findMany({ orderBy: { code: "asc" } });
  res.json(rows.map((r) => ({ ...r, requiredForLevels: JSON.parse(r.requiredForLevels) })));
});

router.post("/competencies", async (req, res) => {
  const { requiredForLevels, ...data } = req.body;
  const c = await prisma.competency.create({ data: { ...data, requiredForLevels: JSON.stringify(requiredForLevels || []) } });
  await audit(req, "create_competency", c.code);
  res.status(201).json({ ...c, requiredForLevels: JSON.parse(c.requiredForLevels) });
});

router.put("/competencies/:id", async (req, res) => {
  const { requiredForLevels, ...data } = req.body;
  if (requiredForLevels !== undefined) data.requiredForLevels = JSON.stringify(requiredForLevels);
  const c = await prisma.competency.update({ where: { id: req.params.id }, data });
  await audit(req, "update_competency", c.code);
  res.json({ ...c, requiredForLevels: JSON.parse(c.requiredForLevels) });
});

router.delete("/competencies/:id", async (req, res) => {
  await prisma.competency.delete({ where: { id: req.params.id } });
  await audit(req, "delete_competency", req.params.id);
  res.json({ ok: true });
});

// ── Mapping Rules CRUD ────────────────────────────────────────────────────────
router.get("/rules", async (req, res) => {
  const rows = await prisma.mappingRule.findMany({ orderBy: { order: "asc" } });
  res.json(rows.map((r) => ({ ...r, conditions: JSON.parse(r.conditions) })));
});

router.post("/rules", async (req, res) => {
  const { conditions, ...data } = req.body;
  const r = await prisma.mappingRule.create({ data: { ...data, conditions: JSON.stringify(conditions || {}) } });
  await audit(req, "create_rule", `order ${r.order}`);
  res.status(201).json({ ...r, conditions: JSON.parse(r.conditions) });
});

router.put("/rules/:id", async (req, res) => {
  const { conditions, ...data } = req.body;
  if (conditions !== undefined) data.conditions = JSON.stringify(conditions);
  const r = await prisma.mappingRule.update({ where: { id: req.params.id }, data });
  await audit(req, "update_rule", req.params.id);
  res.json({ ...r, conditions: JSON.parse(r.conditions) });
});

router.delete("/rules/:id", async (req, res) => {
  await prisma.mappingRule.delete({ where: { id: req.params.id } });
  await audit(req, "delete_rule", req.params.id);
  res.json({ ok: true });
});

// ── Exam Questions CRUD ───────────────────────────────────────────────────────
router.get("/questions", async (req, res) => {
  const where = {};
  if (req.query.level) where.kkniLevel = parseInt(req.query.level);
  if (req.query.competency) where.competencyCode = req.query.competency;
  const rows = await prisma.examQuestion.findMany({ where, orderBy: { competencyCode: "asc" } });
  res.json(rows.map((r) => ({ ...r, options: JSON.parse(r.options) })));
});

router.post("/questions", async (req, res) => {
  const { options, ...data } = req.body;
  const q = await prisma.examQuestion.create({ data: { ...data, options: JSON.stringify(options || []) } });
  await audit(req, "create_question", q.competencyCode);
  res.status(201).json({ ...q, options: JSON.parse(q.options) });
});

router.put("/questions/:id", async (req, res) => {
  const { options, ...data } = req.body;
  if (options !== undefined) data.options = JSON.stringify(options);
  const q = await prisma.examQuestion.update({ where: { id: req.params.id }, data });
  await audit(req, "update_question", req.params.id);
  res.json({ ...q, options: JSON.parse(q.options) });
});

router.delete("/questions/:id", async (req, res) => {
  await prisma.examQuestion.delete({ where: { id: req.params.id } });
  await audit(req, "delete_question", req.params.id);
  res.json({ ok: true });
});

// ── Learning Resources CRUD ───────────────────────────────────────────────────
router.get("/resources", async (req, res) =>
  res.json(await prisma.learningResource.findMany({ orderBy: { competencyCode: "asc" } })));

router.post("/resources", async (req, res) => {
  const r = await prisma.learningResource.create({ data: req.body });
  await audit(req, "create_resource", r.title);
  res.status(201).json(r);
});

router.put("/resources/:id", async (req, res) => {
  const r = await prisma.learningResource.update({ where: { id: req.params.id }, data: req.body });
  await audit(req, "update_resource", r.title);
  res.json(r);
});

router.delete("/resources/:id", async (req, res) => {
  await prisma.learningResource.delete({ where: { id: req.params.id } });
  await audit(req, "delete_resource", req.params.id);
  res.json({ ok: true });
});

// ── Requests inbox ────────────────────────────────────────────────────────────
router.get("/requests", async (req, res) => {
  const where = req.query.status ? { status: req.query.status } : {};
  res.json(await prisma.request.findMany({ where, orderBy: { createdAt: "desc" } }));
});

router.put("/requests/:id", async (req, res) => {
  const { status, notes } = req.body;
  const r = await prisma.request.update({
    where: { id: req.params.id },
    data: { status, notes, handledByAdminId: req.user.id },
  }).catch(() => null);
  if (!r) return res.status(404).json({ error: "request not found" });
  if (r.fromId) {
    await prisma.notification.create({
      data: {
        userId: r.fromId, type: "request_update",
        message: `Request "${r.type}" telah di-${status} oleh admin${notes ? `: ${notes}` : ""}`,
      },
    });
  }
  await audit(req, `${status}_request`, `${r.type} from ${r.fromEmail}`);
  res.json(r);
});

// ── Audit log ─────────────────────────────────────────────────────────────────
router.get("/audit-log", async (req, res) => {
  const { limit = 50, page = 1 } = req.query;
  const take = parseInt(limit);
  const skip = (parseInt(page) - 1) * take;
  const [logs, total] = await Promise.all([
    prisma.auditLog.findMany({ orderBy: { createdAt: "desc" }, skip, take }),
    prisma.auditLog.count(),
  ]);
  res.json({ logs, total, page: parseInt(page) });
});

// ── Send notification ─────────────────────────────────────────────────────────
router.post("/notifications", async (req, res) => {
  const { userId, type, message } = req.body;
  const n = await prisma.notification.create({ data: { userId, type, message } });
  await audit(req, "send_notification", userId);
  res.status(201).json(n);
});

// ── Pengaturan AvatarEdu (kurasi course yang tampil ke pekerja) ────────────────
const AVATAREDU_DEFAULT = { enabled: true, featuredQuery: "kompetensi kerja", featuredSlugs: [] };

router.get("/avataredu", async (req, res) => {
  const row = await prisma.appSetting.findUnique({ where: { key: "avataredu" } });
  let cfg = AVATAREDU_DEFAULT;
  if (row) { try { cfg = { ...AVATAREDU_DEFAULT, ...JSON.parse(row.value) }; } catch { /* default */ } }
  res.json(cfg);
});

router.put("/avataredu", async (req, res) => {
  const b = req.body || {};
  const cfg = {
    enabled: b.enabled !== false,
    featuredQuery: String(b.featuredQuery ?? AVATAREDU_DEFAULT.featuredQuery).slice(0, 120),
    featuredSlugs: Array.isArray(b.featuredSlugs) ? b.featuredSlugs.map((s) => String(s).trim()).filter(Boolean).slice(0, 20) : [],
  };
  await prisma.appSetting.upsert({
    where: { key: "avataredu" },
    update: { value: JSON.stringify(cfg) },
    create: { key: "avataredu", value: JSON.stringify(cfg) },
  });
  await audit(req, "update_avataredu_settings", "avataredu", JSON.stringify(cfg));
  res.json(cfg);
});

// ── Katalog AvatarEdu: cermin lokal + kurasi per course ───────────────────────
// Sebelum ini admin hanya bisa mengatur katalog dengan menebak slug. Sekarang katalog
// partner disalin ke basis data lalu tiap course punya sakelar tampil/sembunyi.

router.get("/avataredu/courses", async (_req, res) => {
  const courses = await prisma.avatarEduCourse.findMany({
    orderBy: [{ displayOrder: "asc" }, { title: "asc" }],
  });
  const lastSyncAt = courses.reduce((a, c) => (!a || c.syncedAt > a ? c.syncedAt : a), null);
  res.json({
    total: courses.length,
    published: courses.filter((c) => c.published).length,
    lastSyncAt,
    hasKey: !!process.env.AVATAREDU_API_KEY,
    courses,
  });
});

// Ambil seluruh katalog partner lalu simpan. Katalognya kecil (~10 course), jadi cukup
// ditarik langsung; jeda antar halaman menjaga jarak dari batas laju partner.
router.post("/avataredu/sync", async (req, res) => {
  const key = process.env.AVATAREDU_API_KEY;
  if (!key) return res.status(503).json({ error: "API key AvatarEdu belum diatur di server." });

  const headers = { "X-API-Key": key, Accept: "application/json" };
  const collected = [];
  const errors = [];
  try {
    for (let page = 1; page <= 20; page++) {
      if (page > 1) await new Promise((r) => setTimeout(r, 600));
      const r = await fetch(`https://avataredu.ai/api/v1/courses?per_page=50&page=${page}`, { headers });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) { errors.push(d?.message || `HTTP ${r.status}`); break; }
      const rows = Array.isArray(d?.data) ? d.data : [];
      collected.push(...rows);
      const total = d?.meta?.total ?? rows.length;
      const perPage = d?.meta?.per_page ?? 50;
      if (page >= Math.ceil(total / perPage) || rows.length === 0) break;
    }
  } catch (e) {
    errors.push(e.message);
  }
  if (!collected.length) {
    return res.status(502).json({ error: errors[0] || "Katalog AvatarEdu kosong atau tidak bisa dihubungi." });
  }

  const num = (v) => (typeof v === "number" && Number.isFinite(v) ? v : null);
  for (const c of collected) {
    // published & displayOrder sengaja TIDAK ikut diperbarui - itu keputusan admin.
    const data = {
      remoteId: c.id != null ? String(c.id) : null,
      title: String(c.title || c.slug || "Course"),
      description: c.description ?? null,
      thumbnailUrl: c.thumbnail_url ?? null,
      level: c.level ?? null,
      price: num(c.price),
      formattedPrice: c.formatted_price ?? null,
      durationHours: num(c.duration_hours),
      totalChapters: num(c.total_chapters),
      totalLessons: num(c.total_lessons),
      categoryName: c.category?.name ?? null,
      categorySlug: c.category?.slug ?? null,
      creatorName: c.creator?.name ?? null,
      syncedAt: new Date(),
    };
    await prisma.avatarEduCourse.upsert({
      where: { slug: String(c.slug) },
      update: data,
      create: { slug: String(c.slug), ...data },
    });
  }

  await audit(req, "sync_avataredu_catalog", "avataredu", `${collected.length} course`);
  const total = await prisma.avatarEduCourse.count();
  const published = await prisma.avatarEduCourse.count({ where: { published: true } });
  res.json({ synced: collected.length, total, published, errors });
});

router.patch("/avataredu/courses/:id", async (req, res) => {
  const b = req.body || {};
  const data = {};
  if (typeof b.published === "boolean") data.published = b.published;
  if (b.displayOrder != null && Number.isFinite(Number(b.displayOrder))) {
    data.displayOrder = Math.max(0, Math.min(9999, Math.round(Number(b.displayOrder))));
  }
  if (!Object.keys(data).length) return res.status(400).json({ error: "Tidak ada perubahan." });
  try {
    const course = await prisma.avatarEduCourse.update({ where: { id: req.params.id }, data });
    res.json(course);
  } catch {
    res.status(404).json({ error: "Course tidak ditemukan." });
  }
});

router.post("/avataredu/courses/publish-all", async (req, res) => {
  const published = req.body?.published !== false;
  const r = await prisma.avatarEduCourse.updateMany({ data: { published } });
  await audit(req, published ? "publish_all_avataredu" : "hide_all_avataredu", "avataredu", `${r.count} course`);
  res.json({ affected: r.count, published });
});

function safeUser(u) {
  const { passwordHash: _, certifications, ...rest } = u;
  return { ...rest, certifications: JSON.parse(certifications) };
}

export default router;
