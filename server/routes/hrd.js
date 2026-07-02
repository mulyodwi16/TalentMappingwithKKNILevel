import express from "express";
import xlsx from "xlsx";
import { prisma } from "../prisma.js";
import { requireAuth, requireRole } from "../middleware/auth.js";

const router = express.Router();
router.use(requireAuth, requireRole("hrd", "admin"));

router.get("/workers", async (req, res) => {
  const { status, department, level } = req.query;
  const where = { role: "user" };
  if (status) where.status = status;
  if (department) where.department = { contains: department };
  if (level) where.currentKkniLevel = parseInt(level);
  const workers = await prisma.user.findMany({
    where, orderBy: { name: "asc" },
    select: { passwordHash: false },
  });
  res.json(workers.map(safeUser));
});

router.get("/analytics", async (req, res) => {
  const users = await prisma.user.findMany({ where: { role: "user" } });
  const total = users.length;
  const statusCounts = { ready: 0, in_progress: 0, not_ready: 0 };
  const levelDistribution = {};
  let totalReadiness = 0;

  for (const u of users) {
    statusCounts[u.status || "not_ready"]++;
    if (u.currentKkniLevel)
      levelDistribution[u.currentKkniLevel] = (levelDistribution[u.currentKkniLevel] || 0) + 1;
    totalReadiness += u.readinessScore || 0;
  }

  const recentAttempts = await prisma.examAttempt.findMany({
    orderBy: { createdAt: "desc" }, take: 5,
    include: { user: { select: { name: true, email: true } } },
  });

  res.json({
    total, statusCounts, levelDistribution,
    avgReadiness: total ? Math.round(totalReadiness / total) : 0,
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

router.get("/export/excel", async (req, res) => {
  const workers = await prisma.user.findMany({ where: { role: "user" } });
  const data = workers.map((w) => ({
    Nama: w.name, Email: w.email, Departemen: w.department || "-",
    Posisi: w.position || "-", Pendidikan: w.education || "-",
    "Level KKNI": w.currentKkniLevel || "-", "Target Level": w.targetKkniLevel || "-",
    "Readiness (%)": w.readinessScore || 0, Status: w.status || "not_ready",
  }));
  const wb = xlsx.utils.book_new();
  xlsx.utils.book_append_sheet(wb, xlsx.utils.json_to_sheet(data), "Talent Mapping");
  const buf = xlsx.write(wb, { type: "buffer", bookType: "xlsx" });
  res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
  res.setHeader("Content-Disposition", `attachment; filename=talent-mapping-${Date.now()}.xlsx`);
  res.send(buf);
});

function safeUser(u) {
  const { passwordHash: _, certifications, ...rest } = u;
  return { ...rest, certifications: JSON.parse(certifications) };
}

export default router;
