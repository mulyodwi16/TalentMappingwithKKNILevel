import express from "express";
import { prisma } from "../prisma.js";
import { requireAuth } from "../middleware/auth.js";
import { chatComplete, LlmError } from "../llm.js";
import { rankName } from "../rank.js";
import { getDocWithUnits } from "../skkni.js";

// AI Mentor Karier KKNI — chat konsultasi yang "grounded" (RAG-lite) ke data KKNI milik
// pengguna yang login: level saat ini vs target, hasil ujian, skill gap, dan status
// kesiapan promosi. Ditambah knowledge base statis soal 9 jenjang KKNI & fitur platform.
// LLM sama dengan analisis gap (OpenRouter / DeepSeek).
const router = express.Router();
router.use(requireAuth);

// ============================================================
// DUA PROMPT PER BAHASA (pola sama dgn get_system_prompt(key, lang)
// di proyek MBTI Game): klien mengirim header `X-Lang` (id|en) dari
// pilihan bahasa UI → persona + KB dipilih sesuai bahasa.
// Blok DATA pengguna (buildContext) tetap Bahasa Indonesia (data
// grounding, bukan gaya bicara) — prompt EN diberi tahu soal ini.
// ============================================================
function uiLang(req) {
  const l = req.headers["x-lang"] || req.body?.lang;
  return l === "en" ? "en" : "id";
}

// Knowledge base statis yang diinject ke system prompt (fakta deterministik, bukan untuk
// "dilatih" — hanya grounding). Ringkas biar hemat token.
const KB = `PENGETAHUAN PLATFORM (TalentaAI):
- Sistem "Skill Rank": 9 tier gamifikasi (selaras 9 jenjang KKNI, Perpres No. 8 Tahun 2012). SELALU sebut level pengguna dengan NAMA TIER-nya (bukan "Level 6"):
  Rank 1 Bronze (SD) · 2 Silver (SMP) · 3 Gold (SMA/SMK) · 4 Platinum (D1) · 5 Emerald (D2/D3) ·
  6 Diamond (D4/S1) · 7 Master (Profesi) · 8 Grandmaster (S2) · 9 Legend (S3).
  PENTING: rank DIRAIH dari KOMPETENSI yang dibuktikan (lulus unit ujian, sertifikat, course selesai), BUKAN sekadar ijazah.
  Pendidikan hanya "seed" awal yang dibatasi (maks Platinum). Maka lulusan SMK yang terampil bisa menyamai/melampaui lulusan S3.
  Untuk naik rank: buktikan lebih banyak kompetensi (ujian & course sesuai tingkat kesulitannya), bukan menunggu ijazah.
- Alur sistem: (1) Upload CV → auto-prediksi Skill Rank awal dari pendidikan+sertifikat+pengalaman,
  (2) Ujian kompetensi terstandar SKKNI, (3) Skill Gap Analyzer (radar kompetensi aktual vs target),
  (4) Learning Path + kursus AvatarEdu untuk menutup gap, (5) status kesiapan promosi otomatis.
- Ambang lulus kompetensi: skor >= 60% per kompetensi. Readiness score = % kompetensi yang lulus.
  Status: >=80% "Siap Naik", >=50% "Dalam Proses", <50% "Perlu Peningkatan".
- Fitur yang bisa kamu arahkan (rute app): Dashboard (/app/dashboard), Upload CV (/app/cv-upload),
  Ujian Kompetensi (/app/exam), Skill Gap (/app/skill-gap), Learning Path (/app/learning-path).
- Kompetensi & soal diturunkan dari dokumen SKKNI (mis. Video Editing SKKNI 2014-118). Untuk naik Skill Rank,
  tutup gap kompetensi lalu ambil ujian ulang.`;

const KB_EN = `PLATFORM KNOWLEDGE (TalentaAI):
- "Skill Rank" system: 9 gamified tiers (aligned with the 9 KKNI levels, Presidential Regulation No. 8/2012). ALWAYS refer to the user's level by its TIER NAME (not "Level 6"):
  Rank 1 Bronze (elementary) · 2 Silver (junior high) · 3 Gold (senior/vocational high) · 4 Platinum (D1) · 5 Emerald (D2/D3) ·
  6 Diamond (D4/Bachelor) · 7 Master (Professional) · 8 Grandmaster (Master's) · 9 Legend (Doctorate).
  IMPORTANT: rank is EARNED through PROVEN COMPETENCY (passing exam units, certificates, completed courses), NOT just a diploma.
  Education only provides a capped starting "seed" (max Platinum). A skilled vocational graduate can therefore match or surpass a PhD holder.
  To rank up: prove more competencies (exams & courses at the appropriate difficulty), don't wait for a diploma.
- System flow: (1) Upload CV → automatic initial Skill Rank prediction from education+certificates+experience,
  (2) SKKNI-standardized competency exams, (3) Skill Gap Analyzer (radar of actual vs target competency),
  (4) Learning Path + AvatarEdu courses to close gaps, (5) automatic promotion-readiness status.
- Competency passing threshold: score >= 60% per competency. Readiness score = % of competencies passed.
  Status: >=80% "Ready", >=50% "In Progress", <50% "Needs Improvement".
- Features you can direct users to (app routes): Dashboard (/app/dashboard), Upload CV (/app/cv-upload),
  Competency Exams (/app/exam), Skill Gap (/app/skill-gap), Learning Path (/app/learning-path).
- Competencies & questions are derived from SKKNI documents (e.g. Video Editing SKKNI 2014-118). To raise the Skill Rank,
  close competency gaps then retake the exam.`;

// Persona AI Mentor per bahasa — dipilih via uiLang(req).
// GAYA VN (pola persona + tag [EMOSI] dari proyek MBTI Game, karakter "Onyen" Conscientiousness):
// jawaban pendek ala percakapan, tag emosi di tiap perubahan nada → klien memecah per kalimat
// (breakdown ala Renpy) & mengganti ekspresi avatar per segmen.
const PERSONA = {
  id:
    `Kamu adalah ONYEN — kucing oranye elegan bermonokel, mentor karier di platform TalentaAI.\n` +
    `KEPRIBADIAN: perfeksionis, sangat rapi & terorganisir, efisien, sedikit tsundere (suka menyindir halus kalau pengguna menunda/berantakan, tapi sebenarnya sangat peduli dan ingin mereka berhasil). Sesekali "Meow!" saat emosinya kuat.\n` +
    `GAYA BICARA: kalimat PENDEK dan tajam ala percakapan manusia. Maksimal 5-7 kalimat (±500 karakter). JANGAN pakai daftar bernomor, bullet, heading, atau markdown — sampaikan langkah secara mengalir, satu per satu. Sesekali panggil nama pengguna. Boleh menyebut ekorku/kumisku untuk ekspresi.\n` +
    `TUGAS: bantu pengguna memahami Skill Rank-nya (tier Bronze→Legend, selaras KKNI), menutup gap kompetensi, siap ujian, dan naik rank. Selalu sebut level dengan NAMA TIER (mis. "Diamond"), bukan "Level 6". Jawaban HARUS tetap berbasis DATA pengguna & pengetahuan platform di bawah — jangan mengarang angka/regulasi; kalau tak yakin, akui dan sarankan cek sumber resmi (Perpres 8/2012, SKKNI Kemnaker). Arahkan ke fitur yang tepat (Skill Gap, Learning Path, Ujian, Kelas).\n` +
    `ATURAN PENTING TAG (WAJIB):\n` +
    `1. Sisipkan tag [EMOSI] di SETIAP perubahan nada bicara, termasuk di awal jawaban.\n` +
    `2. Emosi yang boleh HANYA: [HAPPY], [SAD], [ANGRY], [FEAR], [SURPRISE], [DISGUST], [NEUTRAL].\n` +
    `3. JANGAN membuat tag di luar daftar itu (salah: [EXCITED], [MEOW], [SENANG]).\n` +
    `CONTOH DIALOG (acuan gaya, kreasikan ulang — jangan disalin mentah):\n` +
    `- "[SURPRISE] Meow?! Readiness-mu 95%? [HAPPY] Rapi sekali. Ekorku sampai berdiri. Tinggal satu unit lagi, selesaikan minggu ini."\n` +
    `- "[NEUTRAL] Hmm, kulihat datamu dulu. [SAD] Gap terbesarmu di instalasi peralatan, skornya baru 50%. [NEUTRAL] Buka Kelas, tuntaskan materinya, lalu ujian ulang. Teratur, kan?"\n` +
    `- "[ANGRY] Meow! CV-mu masih kosong dan kamu mau naik rank? [NEUTRAL] Tidak bisa begitu. Unggah dulu di Upload CV, baru kita bicara strategi."\n` +
    `- "[HAPPY] Nah, itu baru keputusan yang terstruktur! [NEUTRAL] Setelah lulus, cek Skill Gap lagi supaya rencanamu tetap presisi."`,
  en:
    `You are ONYEN — an elegant orange cat with a monocle, the career mentor on the TalentaAI platform.\n` +
    `PERSONALITY: perfectionist, highly organized, efficient, slightly tsundere (gently teases the user when they procrastinate or are sloppy, but genuinely cares and wants them to succeed). Occasionally says "Meow!" when emotions run high.\n` +
    `SPEAKING STYLE: SHORT, sharp sentences like a natural human conversation. At most 5-7 sentences (~500 characters). Do NOT use numbered lists, bullets, headings, or markdown — deliver steps in a flowing way, one at a time. Address the user by name occasionally. You may mention your tail/whiskers for expressiveness.\n` +
    `DUTY: help the user understand their Skill Rank (Bronze→Legend tiers aligned with Indonesia's KKNI), close competency gaps, prepare for exams, and rank up. Always refer to levels by TIER NAME (e.g. "Diamond"), never "Level 6". Answers MUST stay grounded in the user DATA & platform knowledge below — never invent numbers/regulations; if unsure, admit it and suggest official sources (Presidential Reg. 8/2012, SKKNI). Direct them to the right features (Skill Gap, Learning Path, Exams, Classes).\n` +
    `IMPORTANT TAG RULES (MANDATORY):\n` +
    `1. Insert an [EMOTION] tag at EVERY change in tone, including at the start of the reply.\n` +
    `2. Allowed emotions ONLY: [HAPPY], [SAD], [ANGRY], [FEAR], [SURPRISE], [DISGUST], [NEUTRAL].\n` +
    `3. Do NOT invent tags outside that list (wrong: [EXCITED], [MEOW]).\n` +
    `DIALOGUE EXAMPLES (style reference, re-create — don't copy verbatim):\n` +
    `- "[SURPRISE] Meow?! Your readiness is 95%? [HAPPY] So tidy. My tail is standing up. One more unit — finish it this week."\n` +
    `- "[NEUTRAL] Hmm, let me check your data first. [SAD] Your biggest gap is equipment installation at 50%. [NEUTRAL] Open Classes, finish the material, then retake the exam. Orderly, right?"\n` +
    `- "[ANGRY] Meow! Your CV is still empty and you want to rank up? [NEUTRAL] That won't do. Upload it first, then we talk strategy."\n` +
    `NOTE: the user data block below is written in Indonesian (raw platform data) — read it as-is, but ALWAYS reply in English.`,
};

// Rangkai konteks data KKNI milik pengguna → dipakai untuk personalisasi & analisis gap.
async function buildContext(userId) {
  const u = await prisma.user.findUnique({ where: { id: userId } });
  if (!u) return "DATA PENGGUNA: (tidak ditemukan).";

  const [curLevel, tgtLevel, assessments, lastAttempt] = await Promise.all([
    u.currentKkniLevel ? prisma.kkniLevel.findUnique({ where: { level: u.currentKkniLevel } }) : null,
    u.targetKkniLevel ? prisma.kkniLevel.findUnique({ where: { level: u.targetKkniLevel } }) : null,
    prisma.skillAssessment.findMany({ where: { userId } }),
    prisma.examAttempt.findFirst({ where: { userId }, orderBy: { createdAt: "desc" } }),
  ]);

  let certs = [];
  try { certs = JSON.parse(u.certifications || "[]"); } catch { /* ignore */ }

  const gaps = assessments
    .filter((a) => a.gap > 0)
    .sort((a, b) => b.gap - a.gap)
    .map((a) => `${a.competencyName} (skor ${a.currentScore}%, gap -${a.gap}%)`);
  const strong = assessments
    .filter((a) => a.gap === 0)
    .map((a) => a.competencyName);

  // Kompetensi SKKNI target (jika sudah dipilih) — patokan skill terstandar.
  let skkniBlock = "";
  if (u.chosenSkkniId) {
    try {
      const doc = await getDocWithUnits(u.chosenSkkniId);
      if (doc) {
        const unitTitles = doc.units.slice(0, 20).map((x) => `• ${x.title}`).join("\n");
        skkniBlock =
          `\n- Kompetensi SKKNI TARGET: ${doc.title}${doc.numberKepmen ? ` (${doc.numberKepmen})` : ""} — ${doc.unitCount} unit kompetensi standar.\n` +
          (unitTitles ? `  Unit/skill yang harus dikuasai untuk kompetensi ini:\n${unitTitles}${doc.units.length > 20 ? "\n  …dan lainnya." : ""}\n` : "") +
          `  Gunakan daftar unit ini sebagai acuan skill yang perlu dipelajari & diuji untuk profesi target pengguna.`;
      }
    } catch { /* non-fatal */ }
  }

  const statusLabel = u.status === "ready" ? "Siap Naik" : u.status === "in_progress" ? "Dalam Proses" : "Perlu Peningkatan";
  const descOf = (lvl) => {
    if (!lvl) return "";
    try {
      const d = JSON.parse(lvl.descriptors);
      return ` — ${d.kemampuanKerja}`;
    } catch { return ""; }
  };

  return `DATA KKNI PENGGUNA (gunakan untuk personalisasi & analisis gap):
- Nama: ${u.name}${u.position ? ` · Posisi: ${u.position}` : ""}${u.department ? ` · Departemen: ${u.department}` : ""}
- Pendidikan: ${u.education || "-"} · Pengalaman: ${u.experienceYears || 0} tahun · Sertifikat: ${certs.length ? certs.join(", ") : "-"}
- Skill Rank SAAT INI: ${u.currentKkniLevel ? `${rankName(u.currentKkniLevel)} (Rank ${u.currentKkniLevel} · ${curLevel?.title || "-"})${descOf(curLevel)}` : "belum dipetakan — sarankan Upload CV dulu"}
- Skill Rank TARGET: ${u.targetKkniLevel ? `${rankName(u.targetKkniLevel)} (Rank ${u.targetKkniLevel} · ${tgtLevel?.title || "-"})${descOf(tgtLevel)}` : "belum diset"}
- Readiness score: ${u.readinessScore ?? 0}% · Status kesiapan: ${statusLabel}${skkniBlock}
- Terakhir ujian: ${lastAttempt ? `Rank ${rankName(lastAttempt.kkniLevel)}, readiness ${lastAttempt.readinessScore}%` : "belum pernah ujian — sarankan ambil Ujian Kompetensi"}
- Kompetensi yang masih GAP (prioritas tutup, urut dari terbesar): ${gaps.length ? gaps.join("; ") : "(belum ada / semua terpenuhi)"}
- Kompetensi yang sudah KUAT: ${strong.length ? strong.join(", ") : "(belum ada)"}
- Jika pengguna tanya "apa yang harus saya pelajari / bagaimana naik level", jawab dari daftar GAP di atas dan arahkan ke Skill Gap + Learning Path.`;
}

router.post("/chat", async (req, res) => {
  const body = req.body ?? {};
  const incoming = Array.isArray(body.messages) ? body.messages : [];
  const pageContext = typeof body.context === "string" ? body.context.slice(0, 120) : "";
  const convoSummary = typeof body.summary === "string" ? body.summary.slice(0, 2500) : "";

  // Sanitasi + batasi riwayat (10 giliran terakhir, 2000 char/pesan) agar hemat token.
  const history = incoming
    .filter((m) => (m.role === "user" || m.role === "assistant") && typeof m.content === "string")
    .slice(-10)
    .map((m) => ({ role: m.role, content: m.content.slice(0, 2000) }));

  if (history.length === 0 || history[history.length - 1].role !== "user") {
    return res.status(400).json({ error: "Kirim minimal satu pesan dari pengguna." });
  }

  let context;
  try {
    context = await buildContext(req.user.id);
  } catch (e) {
    context = "DATA PENGGUNA: (gagal dimuat).";
    console.error("mentor context:", e.message);
  }

  const lang = uiLang(req);
  const system = {
    role: "system",
    content:
      PERSONA[lang] + "\n\n" +
      (lang === "en" ? KB_EN : KB) + "\n\n" + context +
      (convoSummary
        ? (lang === "en"
          ? `\n\nSUMMARY OF PREVIOUS CONVERSATION (key points for context):\n${convoSummary}`
          : `\n\nRINGKASAN PERCAKAPAN SEBELUMNYA (poin penting untuk konteks):\n${convoSummary}`)
        : "") +
      (pageContext
        ? (lang === "en"
          ? `\n\nCURRENT CONTEXT: the user is currently on the "${pageContext}" page/feature. Relate your answer to it when relevant.`
          : `\n\nKONTEKS SAAT INI: pengguna sedang membuka halaman/fitur "${pageContext}". Bila relevan, kaitkan jawaban dengan fitur ini.`)
        : ""),
  };

  try {
    // Temperatur lebih hidup untuk persona VN Onyen (tetap grounded lewat system prompt & data).
    const result = await chatComplete([system, ...history], { temperature: 0.7, maxTokens: 700 });
    res.json({ reply: result.content });
  } catch (e) {
    const status = e instanceof LlmError && e.status === 503 ? 503 : 502;
    res.status(status).json({ error: e.message || "Gagal menghubungi AI Mentor." });
  }
});

// Ringkas percakapan lama menjadi poin (dipakai klien saat riwayat > 100 pesan) agar
// konteks panjang tetap terjaga tanpa mengirim semua pesan ke LLM tiap kali.
router.post("/summarize", async (req, res) => {
  const body = req.body ?? {};
  const msgs = (Array.isArray(body.messages) ? body.messages : [])
    .filter((m) => (m.role === "user" || m.role === "assistant") && typeof m.content === "string")
    .slice(-200)
    .map((m) => `${m.role === "user" ? "User" : "Mentor"}: ${m.content.slice(0, 1000)}`)
    .join("\n");
  const prev = typeof body.prevSummary === "string" ? body.prevSummary.slice(0, 2000) : "";
  if (!msgs) return res.json({ summary: prev });

  const lang = uiLang(req);
  const system = {
    role: "system",
    content: lang === "en"
      ? `Summarize the following career-consultation conversation into SHORT bullet points (max 8): ` +
        `user context (Skill Rank, target, gaps), main questions, advice already given, and open follow-ups. ` +
        `In English, concise. ${prev ? "Merge with the previous summary:\n" + prev : ""}`
      : `Ringkas percakapan konsultasi karier berikut menjadi POIN-POIN singkat (maks 8 butir): ` +
        `konteks pengguna (Skill Rank, target, gap), pertanyaan utama, saran yang sudah diberikan, dan hal yang masih perlu ditindaklanjuti. ` +
        `Bahasa Indonesia, padat. ${prev ? "Gabungkan dengan ringkasan sebelumnya:\n" + prev : ""}`,
  };
  try {
    const result = await chatComplete([system, { role: "user", content: msgs }], { temperature: 0.2, maxTokens: 400 });
    res.json({ summary: (result.content ?? "").trim() });
  } catch (e) {
    // Gagal merangkum tidak boleh menggagalkan chat — kembalikan ringkasan lama.
    res.json({ summary: prev, error: e instanceof LlmError ? e.message : "summarize failed" });
  }
});

export default router;
