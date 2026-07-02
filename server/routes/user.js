import express from "express";
import { prisma } from "../prisma.js";
import { requireAuth } from "../middleware/auth.js";
import { extractProfile, pdfToText } from "../cv.js";

const router = express.Router();
router.use(requireAuth);

// ── Profile ───────────────────────────────────────────────────────────────────
router.get("/profile", async (req, res) => {
  const u = await prisma.user.findUnique({ where: { id: req.user.id } });
  const { passwordHash: _, certifications, ...rest } = u;
  res.json({ ...rest, certifications: JSON.parse(certifications) });
});

router.put("/profile", async (req, res) => {
  const allowed = ["name", "department", "position", "education", "certifications", "experienceYears", "targetKkniLevel"];
  const raw = Object.fromEntries(Object.entries(req.body).filter(([k]) => allowed.includes(k)));
  if (raw.certifications) raw.certifications = JSON.stringify(raw.certifications);
  const u = await prisma.user.update({ where: { id: req.user.id }, data: raw });
  const { passwordHash: _, certifications, ...rest } = u;
  res.json({ ...rest, certifications: JSON.parse(certifications) });
});

// ── CV Parse ──────────────────────────────────────────────────────────────────
router.post("/cv-parse", async (req, res) => {
  try {
    const { pdfBase64 } = req.body || {};
    if (!pdfBase64) return res.status(400).json({ error: "pdfBase64 kosong" });
    const buf = Buffer.from(pdfBase64.replace(/^data:.*;base64,/, ""), "base64");
    const text = await pdfToText(buf);
    const profile = extractProfile(text);
    const level = await applyRules(profile);
    await prisma.user.update({
      where: { id: req.user.id },
      data: {
        education: profile.education,
        certifications: JSON.stringify(profile.certifications),
        experienceYears: profile.experienceYears,
        currentKkniLevel: level,
      },
    });
    const levelInfo = await prisma.kkniLevel.findUnique({ where: { level } });
    res.json({ profile, predictedLevel: level, levelInfo: levelInfo ? { ...levelInfo, descriptors: JSON.parse(levelInfo.descriptors) } : null, textChars: text.length });
  } catch (e) {
    res.status(400).json({ error: "gagal membaca CV: " + e.message });
  }
});

// ── Manual map ────────────────────────────────────────────────────────────────
router.post("/map", async (req, res) => {
  const profile = req.body || {};
  const level = await applyRules(profile);
  await prisma.user.update({
    where: { id: req.user.id },
    data: {
      education: profile.education,
      certifications: JSON.stringify(profile.certifications || []),
      experienceYears: profile.experienceYears || 0,
      currentKkniLevel: level,
    },
  });
  const levelInfo = await prisma.kkniLevel.findUnique({ where: { level } });
  res.json({ predictedLevel: level, levelInfo: levelInfo ? { ...levelInfo, descriptors: JSON.parse(levelInfo.descriptors) } : null });
});

// ── Exam ──────────────────────────────────────────────────────────────────────
router.get("/exam", async (req, res) => {
  const user = await prisma.user.findUnique({ where: { id: req.user.id } });
  const targetLevel = user?.currentKkniLevel || 6;

  let questions = await prisma.examQuestion.findMany({
    where: { kkniLevel: targetLevel }, orderBy: { competencyCode: "asc" },
  });

  let effectiveLevel = targetLevel;
  if (!questions.length) {
    const rows = await prisma.examQuestion.findMany({ distinct: ["kkniLevel"], select: { kkniLevel: true } });
    const available = rows.map((r) => r.kkniLevel);
    if (available.length) {
      const higher = available.filter((l) => l >= targetLevel).sort((a, b) => a - b);
      effectiveLevel = higher.length ? higher[0] : Math.max(...available);
      questions = await prisma.examQuestion.findMany({ where: { kkniLevel: effectiveLevel }, orderBy: { competencyCode: "asc" } });
    }
  }

  const safeQ = questions.map(({ answerKey: _, options, ...q }) => ({ ...q, options: JSON.parse(options) }));
  res.json({ questions: safeQ, totalQuestions: safeQ.length, timeLimit: 30, kkniLevel: effectiveLevel, requestedLevel: targetLevel });
});

router.post("/exam/submit", async (req, res) => {
  try {
    const { answers = {}, kkniLevel: submittedLevel } = req.body;
    const user = await prisma.user.findUnique({ where: { id: req.user.id } });
    const targetLevel = user?.currentKkniLevel || 6;

    let effectiveLevel = submittedLevel || targetLevel;
    let questions = await prisma.examQuestion.findMany({ where: { kkniLevel: effectiveLevel } });
    if (!questions.length) {
      const rows = await prisma.examQuestion.findMany({ distinct: ["kkniLevel"], select: { kkniLevel: true } });
      const available = rows.map((r) => r.kkniLevel);
      if (available.length) {
        const higher = available.filter((l) => l >= targetLevel).sort((a, b) => a - b);
        effectiveLevel = higher.length ? higher[0] : Math.max(...available);
        questions = await prisma.examQuestion.findMany({ where: { kkniLevel: effectiveLevel } });
      }
    }

    const competencies = await prisma.competency.findMany();
    const threshold = 0.6;

    const byComp = {};
    for (const q of questions) {
      if (!byComp[q.competencyCode]) byComp[q.competencyCode] = { correct: 0, total: 0 };
      byComp[q.competencyCode].total++;
      if (parseInt(answers[q.id]) === q.answerKey) byComp[q.competencyCode].correct++;
    }

    const results = competencies
      .filter((c) => byComp[c.code])
      .map((c) => {
        const { correct, total } = byComp[c.code];
        const ratio = correct / total;
        return { competencyCode: c.code, name: c.name, skkni: c.skkni, score: Math.round(ratio * 100), passed: ratio >= threshold, gap: ratio < threshold };
      });

    const passedCount = results.filter((r) => r.passed).length;
    const readiness = results.length ? Math.round((passedCount / results.length) * 100) : 0;
    const status = readiness >= 80 ? "ready" : readiness >= 50 ? "in_progress" : "not_ready";
    const gaps = results.filter((r) => r.gap);

    const attempt = await prisma.examAttempt.create({
      data: {
        userId: req.user.id, kkniLevel: effectiveLevel,
        answers: JSON.stringify(answers),
        scorePerCompetency: JSON.stringify(Object.fromEntries(results.map((r) => [r.competencyCode, r.score]))),
        results: JSON.stringify(results),
        readinessScore: readiness, status, passed: readiness >= 80,
        gaps: JSON.stringify(gaps),
      },
    });

    await prisma.user.update({ where: { id: req.user.id }, data: { readinessScore: readiness, status } });

    await Promise.all(results.map((r) =>
      prisma.skillAssessment.upsert({
        where: { userId_competencyCode: { userId: req.user.id, competencyCode: r.competencyCode } },
        update: { competencyName: r.name, currentScore: r.score, gap: 100 - r.score },
        create: { userId: req.user.id, competencyCode: r.competencyCode, competencyName: r.name, currentScore: r.score, requiredScore: 100, gap: 100 - r.score },
      })
    ));

    const gapCodes = gaps.map((g) => g.competencyCode);
    const resources = gapCodes.length
      ? await prisma.learningResource.findMany({ where: { competencyCode: { in: gapCodes } }, take: 8 })
      : [];

    let aiAnalysis = null;
    if (gaps.length && process.env.OPENROUTER_API_KEY) {
      try {
        const { analyze, detectProfesi } = await import("../../kkni/analyze.js");
        const profesi = detectProfesi(user.position || "", user.department || "");
        if (profesi) {
          const query = gaps.map((g) => g.name).join(", ");
          const profile = [user.name, user.position, user.education, `${user.experienceYears || 0} tahun pengalaman`].filter(Boolean).join(", ");
          const r = await analyze({ profile, query, profesi });
          aiAnalysis = r.analysis;
        }
      } catch (e) {
        console.error("AI rec:", e.message);
      }
    }

    if (gaps.length) {
      await prisma.recommendation.create({
        data: {
          userId: req.user.id,
          resources: JSON.stringify(resources.map((r) => r.id)),
          reason: `Gap: ${gapCodes.join(", ")}`,
          aiAnalysis,
        },
      });
    }

    await prisma.notification.create({
      data: {
        userId: req.user.id, type: "exam_result",
        message: `Ujian selesai: readiness ${readiness}% — ${status === "ready" ? "Siap Naik ✓" : status === "in_progress" ? "Dalam Proses" : "Perlu Peningkatan"}`,
      },
    });

    res.json({ results, readiness, status, gaps, attemptId: attempt.id, resources: resources.slice(0, 4) });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ── Attempt history ───────────────────────────────────────────────────────────
router.get("/attempts", async (req, res) => {
  const attempts = await prisma.examAttempt.findMany({
    where: { userId: req.user.id }, orderBy: { createdAt: "desc" }, take: 10,
  });
  res.json(attempts.map((a) => ({ ...a, results: JSON.parse(a.results), gaps: JSON.parse(a.gaps) })));
});

// ── Skill assessments ─────────────────────────────────────────────────────────
router.get("/skill-assessments", async (req, res) => {
  const assessments = await prisma.skillAssessment.findMany({ where: { userId: req.user.id } });
  res.json(assessments);
});

// ── Recommendations ───────────────────────────────────────────────────────────
router.get("/recommendations", async (req, res) => {
  const recs = await prisma.recommendation.findMany({
    where: { userId: req.user.id }, orderBy: { createdAt: "desc" }, take: 5,
  });
  // resolve resource IDs → full records
  const result = await Promise.all(recs.map(async (rec) => {
    const ids = JSON.parse(rec.resources);
    const resources = ids.length ? await prisma.learningResource.findMany({ where: { id: { in: ids } } }) : [];
    return { ...rec, resources };
  }));
  res.json(result);
});

router.put("/recommendations/:id", async (req, res) => {
  const rec = await prisma.recommendation.updateMany({
    where: { id: req.params.id, userId: req.user.id },
    data: { progress: req.body.progress },
  });
  res.json(rec);
});

// ── Notifications ─────────────────────────────────────────────────────────────
router.get("/notifications", async (req, res) => {
  const notifs = await prisma.notification.findMany({
    where: { userId: req.user.id }, orderBy: { createdAt: "desc" }, take: 20,
  });
  res.json(notifs);
});

router.put("/notifications/:id/read", async (req, res) => {
  await prisma.notification.updateMany({ where: { id: req.params.id, userId: req.user.id }, data: { read: true } });
  res.json({ ok: true });
});

router.put("/notifications/read-all", async (req, res) => {
  await prisma.notification.updateMany({ where: { userId: req.user.id, read: false }, data: { read: true } });
  res.json({ ok: true });
});

// ── helper ────────────────────────────────────────────────────────────────────
async function applyRules({ education, certifications = [] }) {
  const rules = await prisma.mappingRule.findMany({ orderBy: { order: "asc" } });
  const has = (kw) => certifications.some((c) => c.toLowerCase().includes(kw));
  for (const r of rules) {
    const c = JSON.parse(r.conditions);
    if (c.education !== education) continue;
    if (c.cert && !has(c.cert)) continue;
    return r.predictedLevel;
  }
  return 3;
}

export default router;
