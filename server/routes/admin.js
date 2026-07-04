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

router.post("/users", async (req, res) => {
  const { password = "demo123", certifications, ...data } = req.body;
  data.email = data.email?.toLowerCase();
  if (await prisma.user.findUnique({ where: { email: data.email } }))
    return res.status(409).json({ error: "email sudah dipakai" });
  const u = await prisma.user.create({
    data: { ...data, passwordHash: await bcrypt.hash(password, 10), certifications: JSON.stringify(certifications || []) },
  });
  await audit(req, "create_user", u.email);
  res.status(201).json(safeUser(u));
});

router.put("/users/:id", async (req, res) => {
  const { password, certifications, ...data } = req.body;
  if (password) data.passwordHash = await bcrypt.hash(password, 10);
  if (certifications !== undefined) data.certifications = JSON.stringify(certifications);
  const u = await prisma.user.update({ where: { id: req.params.id }, data }).catch(() => null);
  if (!u) return res.status(404).json({ error: "user not found" });
  await audit(req, "update_user", u.email);
  res.json(safeUser(u));
});

router.delete("/users/:id", async (req, res) => {
  if (req.params.id === req.user.id) return res.status(400).json({ error: "tidak bisa hapus diri sendiri" });
  const u = await prisma.user.delete({ where: { id: req.params.id } }).catch(() => null);
  if (!u) return res.status(404).json({ error: "user not found" });
  await audit(req, "delete_user", u.email);
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

function safeUser(u) {
  const { passwordHash: _, certifications, ...rest } = u;
  return { ...rest, certifications: JSON.parse(certifications) };
}

export default router;
