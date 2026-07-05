import express from "express";
import xlsx from "xlsx";
import { prisma } from "../prisma.js";
import { requireAuth, requireRole } from "../middleware/auth.js";
import { rankName } from "../rank.js";

const router = express.Router();
router.use(requireAuth, requireRole("hrd", "admin"));

// Ringkas data ujian/kompetensi (dari fitur ujian) untuk sekumpulan talenta — supaya HRD
// melihat data yang SINKRON dengan hasil ujian, bukan hanya profil statis (#13).
async function competencySummary(userIds) {
  if (!userIds.length) return {};
  const [assess, certGroups, attempts] = await Promise.all([
    prisma.skillAssessment.findMany({ where: { userId: { in: userIds } }, select: { userId: true, currentScore: true } }),
    prisma.certificate.groupBy({ by: ["userId"], where: { userId: { in: userIds } }, _count: { _all: true } }),
    prisma.examAttempt.findMany({ where: { userId: { in: userIds } }, orderBy: { createdAt: "desc" }, select: { userId: true, createdAt: true } }),
  ]);
  const map = {};
  for (const id of userIds) map[id] = { assessedUnits: 0, passedUnits: 0, certCount: 0, lastExamAt: null };
  for (const a of assess) { const m = map[a.userId]; m.assessedUnits++; if (a.currentScore >= 60) m.passedUnits++; }
  for (const g of certGroups) map[g.userId].certCount = g._count._all;
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
// dan riwayat ujian terakhir — bukti kompetensi yang tersinkron ke HRD.
router.get("/worker/:id", async (req, res) => {
  const u = await prisma.user.findFirst({ where: { id: req.params.id, role: "user" } });
  if (!u) return res.status(404).json({ error: "Talenta tidak ditemukan." });
  const [assessments, certificates, attempts] = await Promise.all([
    prisma.skillAssessment.findMany({ where: { userId: u.id }, orderBy: { competencyCode: "asc" } }),
    prisma.certificate.findMany({ where: { userId: u.id }, orderBy: { issuedAt: "desc" } }),
    prisma.examAttempt.findMany({ where: { userId: u.id }, orderBy: { createdAt: "desc" }, take: 8 }),
  ]);
  res.json({
    worker: safeUser(u),
    competency: u.chosenSkkniId ? { id: u.chosenSkkniId, title: u.chosenSkkniTitle } : null,
    assessments: assessments.map((a) => ({ code: a.competencyCode, name: a.competencyName, score: a.currentScore, passed: a.currentScore >= 60, gap: a.gap })),
    certificates: certificates.map((c) => ({ id: c.id, name: c.name, code: c.competencyCode, score: c.score, source: c.source, issuedAt: c.issuedAt })),
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

router.get("/export/excel", async (req, res) => {
  const workers = await prisma.user.findMany({ where: { role: "user" } });
  const summary = await competencySummary(workers.map((w) => w.id));
  const data = workers.map((w) => {
    const s = summary[w.id] || {};
    return {
      Nama: w.name, Email: w.email, "Status Akademik": w.academicStatus || "-", Pendidikan: w.education || "-",
      "Kompetensi Target": w.chosenSkkniTitle || "-",
      "Rank": w.currentKkniLevel ? rankName(w.currentKkniLevel) : "-",
      "Unit Lulus": `${s.passedUnits || 0}/${s.assessedUnits || 0}`,
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

function safeUser(u) {
  const { passwordHash: _, certifications, ...rest } = u;
  return { ...rest, certifications: JSON.parse(certifications) };
}

export default router;
