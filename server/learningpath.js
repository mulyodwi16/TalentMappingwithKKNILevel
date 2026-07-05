import { prisma } from "./prisma.js";
import { chatComplete, isLlmConfigured, LlmError } from "./llm.js";
import { rankName } from "./rank.js";
import { computeRank } from "./rankcalc.js";
import { computeReadiness } from "./readiness.js";
import { getDocWithUnits } from "./skkni.js";

// ── Learning Path AI ──────────────────────────────────────────────────────────
// Menyusun rencana belajar personal & terurut dari 3 masukan (permintaan #4):
//   1. Hasil tes  — SkillAssessment (gap kompetensi, skor per unit).
//   2. Kompetensi yang dipilih — dokumen SKKNI + daftar unit standar.
//   3. Profesi yang ditargetkan — user.targetRole.
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

// Kumpulkan seluruh masukan yang dipakai untuk menyusun & menjelaskan rencana.
export async function buildInputs(userId) {
  const [u, assessments, rank, readiness] = await Promise.all([
    prisma.user.findUnique({ where: { id: userId } }),
    prisma.skillAssessment.findMany({ where: { userId } }),
    computeRank(userId),
    computeReadiness(userId),
  ]);
  if (!u) return null;

  const gaps = assessments
    .filter((a) => a.gap > 0)
    .sort((a, b) => b.gap - a.gap)
    .map((a) => ({ name: a.competencyName, code: a.competencyCode, score: a.currentScore, gap: a.gap }));
  const strong = assessments
    .filter((a) => a.gap === 0 && a.currentScore >= 60)
    .map((a) => a.competencyName);

  // Unit kompetensi standar dari dokumen SKKNI yang dipilih (patokan skill yang harus dikuasai).
  let competency = null;
  if (u.chosenSkkniId) {
    try {
      const doc = await getDocWithUnits(u.chosenSkkniId);
      if (doc) {
        competency = {
          id: doc.id,
          title: doc.title,
          number: doc.numberKepmen || null,
          unitCount: doc.unitCount,
          units: doc.units.map((x) => ({ code: x.code, title: x.title })),
        };
      }
    } catch { /* non-fatal */ }
  }

  return {
    user: {
      name: u.name,
      education: u.education || null,
      academicStatus: u.academicStatus || null,
      targetRole: u.targetRole || null,
    },
    rank: {
      current: rank.effective,
      currentName: rankName(rank.effective),
      target: u.targetKkniLevel || Math.min(9, rank.effective + 1),
      targetName: rankName(u.targetKkniLevel || Math.min(9, rank.effective + 1)),
      masteryScore: rank.masteryScore,
      next: rank.next,
    },
    readiness: { total: readiness.total, cv: readiness.cv, exam: readiness.exam, cert: readiness.cert, status: readiness.status },
    competency,
    gaps,
    strong,
    baseDifficulty: difficultyForRank(rank.effective),
  };
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

function normStep(s, i) {
  const difficulty = DIFFICULTY.includes(s?.difficulty) ? s.difficulty : "beginner";
  return {
    id: `s${i + 1}`,
    order: i + 1,
    title: String(s?.title || `Langkah ${i + 1}`).slice(0, 140),
    objective: String(s?.objective || "").slice(0, 400),
    why: String(s?.why || "").slice(0, 400),
    difficulty,
    competencyRef: String(s?.competencyRef || s?.competency || "").slice(0, 160) || null,
    estEffort: String(s?.estEffort || s?.effort || "").slice(0, 40) || null,
    courseQuery: String(s?.courseQuery || s?.query || "").slice(0, 60) || null,
    progress: "todo",
  };
}

// Susun prompt & panggil LLM → rencana terstruktur (JSON). Lempar LlmError bila gagal.
async function generateWithLlm(inputs) {
  const comp = inputs.competency;
  const unitLines = comp?.units?.length
    ? comp.units.slice(0, 24).map((x) => `• ${x.title}`).join("\n")
    : "(belum ada — user belum memilih kompetensi SKKNI)";
  const gapLines = inputs.gaps.length
    ? inputs.gaps.map((g) => `• ${g.name} — skor ${g.score}%, gap -${g.gap}%`).join("\n")
    : "(belum ada hasil ujian; gunakan unit kompetensi di atas sebagai basis)";

  const context =
    `PROFIL PENGGUNA:\n` +
    `- Nama: ${inputs.user.name} · Pendidikan/status: ${inputs.user.education || inputs.user.academicStatus || "-"}\n` +
    `- Skill Rank SAAT INI: ${inputs.rank.currentName} (Rank ${inputs.rank.current}) → TARGET: ${inputs.rank.targetName} (Rank ${inputs.rank.target})\n` +
    `- Skor Kesiapan: ${inputs.readiness.total}/100 (CV ${inputs.readiness.cv}, Ujian ${inputs.readiness.exam}, Sertifikat ${inputs.readiness.cert}) · status ${inputs.readiness.status}\n` +
    `- PROFESI DITARGETKAN: ${inputs.user.targetRole || "(belum diisi — simpulkan dari kompetensi)"}\n` +
    `- Tingkat kesulitan dasar yang pas untuk jenjangnya: ${inputs.baseDifficulty}\n\n` +
    `KOMPETENSI SKKNI YANG DIPILIH: ${comp ? `${comp.title}${comp.number ? ` (${comp.number})` : ""} — ${comp.unitCount} unit` : "(belum dipilih)"}\n` +
    `UNIT/SKILL STANDAR YANG HARUS DIKUASAI:\n${unitLines}\n\n` +
    `KOMPETENSI YANG MASIH GAP (prioritas tutup, dari hasil ujian):\n${gapLines}\n\n` +
    `KOMPETENSI YANG SUDAH KUAT: ${inputs.strong.length ? inputs.strong.join(", ") : "(belum ada)"}`;

  const system = {
    role: "system",
    content:
      `Kamu perancang "Learning Path" pada platform karier TalentaAI (selaras SKKNI/KKNI Indonesia). ` +
      `Susun rencana belajar PERSONAL, TERURUT, dan REALISTIS untuk membawa pengguna dari rank saat ini menuju profesi & rank target, ` +
      `dengan PRIORITAS menutup gap kompetensi dari hasil ujian dan menguasai unit SKKNI yang dipilih. ` +
      `Tingkat kesulitan tiap langkah HARUS menyesuaikan jenjang pengguna (mulai dari "${inputs.baseDifficulty}", naik bertahap). ` +
      `Balas HANYA JSON valid (tanpa prosa, tanpa markdown) dengan bentuk PERSIS:\n` +
      `{"aiCheck":{"verdict":"on_track|needs_work|not_ready","headline":"1 kalimat ringkas kondisi","message":"2-4 kalimat analisis kesiapan vs target + saran fokus","focus":["area fokus utama","..."]},` +
      `"steps":[{"title":"judul langkah singkat","objective":"apa yang dikuasai setelah langkah ini","why":"kaitkan ke gap/unit/target","difficulty":"beginner|intermediate|advanced","competencyRef":"nama unit/kompetensi terkait","estEffort":"mis. 1-2 minggu","courseQuery":"kata kunci singkat cari kursus (1-3 kata, Indonesia/Inggris)"}]}\n` +
      `Buat 4-7 langkah, urut dari fondasi ke lanjutan. Bahasa Indonesia. Jangan mengarang unit di luar konteks.`,
  };

  const result = await chatComplete([system, { role: "user", content: context }], { temperature: 0.5, maxTokens: 1400 });
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

// Rencana deterministik bila LLM tak tersedia — tetap berguna: dari gap & unit SKKNI.
function generateFallback(inputs) {
  const steps = [];
  const base = inputs.baseDifficulty;
  const bump = (d) => DIFFICULTY[Math.min(2, DIFFICULTY.indexOf(d) + 1)];

  // 1) Tutup gap terbesar dulu (dari hasil ujian).
  inputs.gaps.slice(0, 4).forEach((g) => {
    steps.push({
      title: `Kuasai: ${g.name}`,
      objective: `Naikkan skor "${g.name}" dari ${g.score}% ke minimal 60% (lulus).`,
      why: `Gap terbesar dari hasil ujian (-${g.gap}%). Menutup ini paling cepat menaikkan kesiapan & Skill Rank.`,
      difficulty: g.gap >= 40 ? base : bump(base),
      competencyRef: g.name,
      estEffort: g.gap >= 40 ? "2-3 minggu" : "1-2 minggu",
      courseQuery: g.name?.split(/\s+/).slice(0, 2).join(" "),
    });
  });

  // 2) Jika gap sedikit, lanjut ke unit SKKNI yang belum diuji.
  if (steps.length < 4 && inputs.competency?.units?.length) {
    const covered = new Set(inputs.gaps.map((g) => g.name).concat(inputs.strong));
    inputs.competency.units
      .filter((x) => !covered.has(x.title))
      .slice(0, 5 - steps.length)
      .forEach((x, i) => {
        steps.push({
          title: `Pelajari unit: ${x.title}`,
          objective: `Kuasai unit standar SKKNI "${x.title}" lalu ambil ujiannya.`,
          why: `Bagian dari kompetensi target "${inputs.competency.title}" yang belum kamu buktikan.`,
          difficulty: i === 0 ? base : bump(base),
          competencyRef: x.title,
          estEffort: "1-2 minggu",
          courseQuery: x.title?.split(/\s+/).slice(0, 2).join(" "),
        });
      });
  }

  // 3) Langkah penutup: ambil ujian ulang untuk mengunci kenaikan rank.
  steps.push({
    title: "Ambil ujian ulang & raih sertifikat",
    objective: `Buktikan kompetensi lewat ujian (soal diacak) untuk naik menuju ${inputs.rank.targetName}.`,
    why: "Rank & kesiapan naik dari BUKTI kompetensi (unit lulus + sertifikat), bukan sekadar belajar.",
    difficulty: bump(base),
    competencyRef: inputs.competency?.title || null,
    estEffort: "1 minggu",
    courseQuery: null,
  });

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

// Susun rencana baru & simpan (upsert satu rencana aktif per user).
export async function generatePlan(userId, targetRole) {
  if (typeof targetRole === "string") {
    await prisma.user.update({ where: { id: userId }, data: { targetRole: targetRole.trim().slice(0, 120) || null } });
  }
  const inputs = await buildInputs(userId);
  if (!inputs) throw new LlmError("Pengguna tidak ditemukan.", 404);

  let plan, source;
  if (isLlmConfigured()) {
    try { plan = await generateWithLlm(inputs); source = "ai"; }
    catch (e) { console.error("learning-path LLM:", e.message); plan = generateFallback(inputs); source = "fallback"; }
  } else {
    plan = generateFallback(inputs); source = "fallback";
  }

  const saved = await prisma.learningPlan.upsert({
    where: { userId },
    create: { userId, targetRole: inputs.user.targetRole, plan: JSON.stringify(plan), source },
    update: { targetRole: inputs.user.targetRole, plan: JSON.stringify(plan), source, generatedAt: new Date() },
  });
  return { plan, source, targetRole: inputs.user.targetRole, generatedAt: saved.generatedAt, inputs };
}

// Ambil rencana tersimpan (tanpa regenerasi). Kembalikan null bila belum ada.
export async function getPlan(userId) {
  const row = await prisma.learningPlan.findUnique({ where: { userId } });
  const inputs = await buildInputs(userId);
  if (!row) return { plan: null, targetRole: inputs?.user.targetRole || null, inputs, llmAvailable: isLlmConfigured() };
  let plan = null;
  try { plan = JSON.parse(row.plan); } catch { /* corrupt */ }
  return { plan, source: row.source, targetRole: row.targetRole, generatedAt: row.generatedAt, inputs, llmAvailable: isLlmConfigured() };
}

// Perbarui progress satu langkah (todo|doing|done) di rencana tersimpan.
export async function setStepProgress(userId, stepId, progress) {
  const valid = ["todo", "doing", "done"];
  if (!valid.includes(progress)) throw new LlmError("Progress tidak valid.", 400);
  const row = await prisma.learningPlan.findUnique({ where: { userId } });
  if (!row) throw new LlmError("Belum ada rencana.", 404);
  let plan;
  try { plan = JSON.parse(row.plan); } catch { throw new LlmError("Rencana rusak.", 500); }
  const step = (plan.steps || []).find((s) => s.id === stepId);
  if (!step) throw new LlmError("Langkah tidak ditemukan.", 404);
  step.progress = progress;
  await prisma.learningPlan.update({ where: { userId }, data: { plan: JSON.stringify(plan) } });
  return { ok: true, stepId, progress };
}
