import express from "express";
import { prisma } from "../prisma.js";
import { requireAuth } from "../middleware/auth.js";
import { chatComplete, isLlmConfigured } from "../llm.js";
import { award, awardOnce, COIN } from "../gamification.js";

// Misi Harian: 3 tugas → klaim bonus koin. Termasuk "Course Harian" (kuis soal yang
// digenerate AI dari data kompetensi, berbeda tiap hari, anti-ulang ±5 hari terakhir).
const router = express.Router();
router.use(requireAuth);

const DAILY_TASKS = [
  { key: "daily_quiz",    label: "Selesaikan Course Harian (kuis)", href: "/app/exam" },
  { key: "open_jobs",     label: "Cek Peta Posisi & kesiapanmu",    href: "/app/jobs" },
  { key: "open_skillgap", label: "Tinjau Skill Gap kamu",           href: "/app/skill-gap" },
];
const TASK_KEYS = new Set(DAILY_TASKS.map((t) => t.key));

function todayStr() { return new Date().toISOString().slice(0, 10); }

async function getMission(userId) {
  const day = todayStr();
  try {
    return await prisma.dailyMission.upsert({
      where: { userId_day: { userId, day } },
      update: {},
      create: { userId, day, tasks: "{}", claimed: false },
    });
  } catch {
    return { userId, day, tasks: "{}", claimed: false };
  }
}
function parseTasks(row) { try { return JSON.parse(row.tasks || "{}"); } catch { return {}; } }
function allDone(tasks) { return DAILY_TASKS.every((t) => !!tasks[t.key]); }
function shape(row) {
  const tasks = parseTasks(row);
  return {
    day: row.day, reward: COIN.missionClaim, claimed: !!row.claimed, allDone: allDone(tasks),
    tasks: DAILY_TASKS.map((t) => ({ ...t, done: !!tasks[t.key] })),
  };
}

// ── Status & progress ────────────────────────────────────────────────────────
router.get("/daily", async (req, res) => {
  res.json(shape(await getMission(req.user.id)));
});

router.post("/daily/progress", async (req, res) => {
  const task = String(req.body?.task ?? "");
  const row = await getMission(req.user.id);
  if (TASK_KEYS.has(task)) {
    const tasks = { ...parseTasks(row), [task]: true };
    try {
      const u = await prisma.dailyMission.update({ where: { id: row.id }, data: { tasks: JSON.stringify(tasks) } });
      return res.json(shape(u));
    } catch { /* fallthrough */ }
  }
  res.json(shape(row));
});

router.post("/daily/claim", async (req, res) => {
  const userId = req.user.id;
  const row = await getMission(userId);
  const tasks = parseTasks(row);
  if (!allDone(tasks)) return res.status(400).json({ error: "Selesaikan semua misi harian dulu." });
  if (row.claimed) return res.status(400).json({ error: "Misi harian hari ini sudah diklaim." });
  const r = await award(userId, COIN.missionClaim, "Misi harian lengkap", { type: "mission", id: row.day });
  await prisma.dailyMission.update({ where: { id: row.id }, data: { claimed: true, claimedAt: new Date() } });
  res.json({ ok: true, awarded: r.awarded, balance: r.balance });
});

// ── Course Harian (kuis AI) ──────────────────────────────────────────────────
function stripAnswers(questions) {
  return questions.map((q, i) => ({ id: i, q: q.q, options: q.options }));
}

// Judul unit/tema dari kode (untuk label "Topik hari ini") - bukan kode mentah.
async function resolveTopicName(code, docId) {
  if (!code) return null;
  if (docId) {
    const u = await prisma.skkniUnit.findFirst({ where: { documentId: docId, code }, select: { title: true } });
    if (u?.title) return u.title;
  }
  const c = await prisma.competency.findFirst({ where: { code }, select: { name: true } }).catch(() => null);
  return c?.name || code;
}

// Course Harian = SATU per hari. Ambil log hari ini: utamakan yang SUDAH selesai (completion =
// jangkar anti-farm; sekali selesai, tetap selesai), jika belum ada yang selesai pakai yang terawal.
// Toleran terhadap sisa >1 baris/hari dari data lama (sebelum aturan 1×/hari diberlakukan).
async function todaysQuizLog(userId, day) {
  const logs = await prisma.dailyQuizLog.findMany({ where: { userId, day }, orderBy: { createdAt: "asc" } });
  return logs.find((l) => l.completed) || logs[0] || null;
}

// Ambil ±5 log soal terakhir (untuk hindari pengulangan). Course Harian 1×/hari (lintas
// kompetensi) → cukup pantau seluruh log terakhir user, tak perlu di-scope per docId.
async function recentQuestionTexts(userId) {
  const logs = await prisma.dailyQuizLog.findMany({
    where: { userId }, orderBy: { createdAt: "desc" }, take: 5,
  });
  const out = [];
  for (const l of logs) { try { for (const q of JSON.parse(l.questions)) out.push(q.q); } catch { /* skip */ } }
  return out;
}

// Pilih topik kuis hari ini. Bila user punya kompetensi SKKNI aktif → pilih 1 UNIT dari
// kompetensi itu (prioritas unit yang masih gap, else rotasi tanggal) → course harian mengikuti
// kompetensi aktif & berganti saat kompetensi diganti. Tanpa kompetensi → fallback tabel legacy.
async function pickTopic(userId, day, docId) {
  if (docId) {
    const units = await prisma.skkniUnit.findMany({ where: { documentId: docId }, select: { code: true, title: true } });
    if (units.length) {
      const gaps = await prisma.skillAssessment.findMany({ where: { userId }, orderBy: { gap: "desc" } });
      const gapCodes = gaps.filter((g) => g.gap > 0).map((g) => g.competencyCode);
      const gapUnit = gapCodes.map((code) => units.find((u) => u.code === code)).find(Boolean);
      const unit = gapUnit || units[parseInt(day.replace(/-/g, ""), 10) % units.length];
      return { code: unit.code, name: unit.title, skkni: null, description: null };
    }
  }
  const comps = await prisma.competency.findMany();
  if (!comps.length) return null;
  const gaps = await prisma.skillAssessment.findMany({ where: { userId }, orderBy: { gap: "desc" } });
  const topGap = gaps.find((g) => g.gap > 0);
  if (topGap) { const c = comps.find((x) => x.code === topGap.competencyCode); if (c) return c; }
  const idx = parseInt(day.replace(/-/g, ""), 10) % comps.length;
  return comps[idx];
}

async function generateQuestionsAI(comp, avoid) {
  const prompt = `Buat 3 soal pilihan ganda SEDERHANA (level pengetahuan dasar) tentang kompetensi kerja berikut, dalam Bahasa Indonesia.
Kompetensi: ${comp.name}${comp.skkni ? ` (SKKNI ${comp.skkni})` : ""}${comp.description ? `\nDeskripsi: ${comp.description}` : ""}
Tiap soal punya 4 opsi (options) dan satu jawaban benar (answerKey = indeks 0-3).
${avoid.length ? `JANGAN membuat soal yang mirip dengan ini:\n- ${avoid.slice(0, 15).join("\n- ")}\n` : ""}
Balas HANYA JSON valid berbentuk array: [{"q":"...","options":["...","...","...","..."],"answerKey":0}]`;
  const r = await chatComplete([{ role: "user", content: prompt }], { temperature: 0.8, maxTokens: 700 });
  const text = r.content || "";
  const m = text.match(/\[[\s\S]*\]/);
  const arr = JSON.parse(m ? m[0] : text);
  return arr
    .filter((q) => q && typeof q.q === "string" && Array.isArray(q.options) && q.options.length >= 2)
    .slice(0, 3)
    .map((q) => ({ q: q.q, options: q.options.slice(0, 4), answerKey: Math.max(0, Math.min(3, Number(q.answerKey) || 0)) }));
}

// Fallback tanpa LLM: ambil dari bank soal, hindari yang baru muncul.
async function fallbackQuestions(comp, avoid) {
  let bank = await prisma.examQuestion.findMany({ where: { competencyCode: comp.code } });
  if (!bank.length) bank = await prisma.examQuestion.findMany({ take: 20 });
  const avoidSet = new Set(avoid);
  const fresh = bank.filter((q) => !avoidSet.has(q.question));
  const pick = (fresh.length ? fresh : bank).slice(0, 3);
  return pick.map((q) => ({ q: q.question, options: JSON.parse(q.options), answerKey: q.answerKey }));
}

router.get("/quiz", async (req, res) => {
  const userId = req.user.id;
  const day = todayStr();
  try {
    // Course Harian = SATU per hari (anti-farm). Bila log hari ini sudah ada - untuk kompetensi
    // MANA PUN - tampilkan itu apa adanya; ganti kompetensi TIDAK me-reset course & statusnya.
    const existing = await todaysQuizLog(userId, day);
    if (existing) {
      const qs = JSON.parse(existing.questions);
      const name = await resolveTopicName(existing.competencyCode, existing.docId);
      return res.json({ day, competency: name, competencyCode: existing.competencyCode, completed: existing.completed, score: existing.score, total: existing.total, questions: stripAnswers(qs) });
    }
    // Belum ada course hari ini → susun dari kompetensi yang SEDANG aktif.
    const u = await prisma.user.findUnique({ where: { id: userId }, select: { chosenSkkniId: true } });
    const docId = u?.chosenSkkniId || null;
    const comp = await pickTopic(userId, day, docId);
    if (!comp) return res.status(503).json({ error: "Belum ada data kompetensi." });
    const avoid = await recentQuestionTexts(userId);

    let questions = [];
    try {
      questions = isLlmConfigured() ? await generateQuestionsAI(comp, avoid) : await fallbackQuestions(comp, avoid);
    } catch {
      questions = await fallbackQuestions(comp, avoid);
    }
    if (!questions.length) questions = await fallbackQuestions(comp, avoid);
    if (!questions.length) return res.status(503).json({ error: "Gagal menyiapkan soal hari ini." });

    await prisma.dailyQuizLog.create({
      data: { userId, day, docId, competencyCode: comp.code, questions: JSON.stringify(questions), completed: false },
    });
    res.json({ day, competency: comp.name, competencyCode: comp.code, completed: false, questions: stripAnswers(questions) });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.post("/quiz/submit", async (req, res) => {
  const userId = req.user.id;
  const day = todayStr();
  const answers = req.body?.answers ?? {};
  try {
    // Satu course per hari → cari log hari ini apa pun kompetensinya (konsisten dgn GET /quiz).
    const log = await todaysQuizLog(userId, day);
    if (!log) return res.status(400).json({ error: "Ambil soal hari ini dulu." });
    const questions = JSON.parse(log.questions);
    let score = 0;
    const review = questions.map((q, i) => {
      const chosen = Number(answers[i]);
      const correct = chosen === q.answerKey;
      if (correct) score++;
      return { q: q.q, options: q.options, answerKey: q.answerKey, chosen: Number.isFinite(chosen) ? chosen : null, correct };
    });
    const total = questions.length;

    if (!log.completed) {
      await prisma.dailyQuizLog.update({ where: { id: log.id }, data: { completed: true, score, total } });
    }
    // Tandai misi harian "daily_quiz" selesai.
    const mission = await getMission(userId);
    const tasks = { ...parseTasks(mission), daily_quiz: true };
    try { await prisma.dailyMission.update({ where: { id: mission.id }, data: { tasks: JSON.stringify(tasks) } }); } catch { /* ignore */ }
    // Reward menyelesaikan kuis (sekali per hari).
    let coin = null;
    try { coin = await awardOnce(userId, COIN.quizDone, "Menyelesaikan Course Harian", { type: "quiz", id: day }); } catch { /* ignore */ }

    res.json({ score, total, pct: total ? Math.round((score / total) * 100) : 0, review, coin });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

export default router;
