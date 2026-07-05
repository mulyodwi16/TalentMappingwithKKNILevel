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

  const system = {
    role: "system",
    content:
      `Kamu adalah "AI Mentor Karier" pada platform TalentaAI. ` +
      `Tugasmu: membantu pengguna memahami Skill Rank-nya (sistem tier gamifikasi Bronze→Legend, selaras KKNI), menutup gap kompetensi, mempersiapkan ujian, ` +
      `dan menyusun langkah agar naik Skill Rank. Selalu sebut level dengan NAMA TIER-nya (mis. "Diamond"), bukan "Level 6". Jawab dalam Bahasa Indonesia, ringkas, ramah, ` +
      `dan actionable (pakai poin/langkah bila perlu). Prioritaskan menutup GAP kompetensi pengguna dan arahkan ke ` +
      `fitur platform yang tepat (Skill Gap, Learning Path, Ujian). Jangan mengarang angka/regulasi di luar pengetahuan ` +
      `yang diberikan; jika tidak yakin, katakan dan sarankan verifikasi ke sumber resmi (Perpres 8/2012, SKKNI Kemnaker).\n\n` +
      KB + "\n\n" + context +
      (convoSummary ? `\n\nRINGKASAN PERCAKAPAN SEBELUMNYA (poin penting untuk konteks):\n${convoSummary}` : "") +
      (pageContext ? `\n\nKONTEKS SAAT INI: pengguna sedang membuka halaman/fitur "${pageContext}". Bila relevan, kaitkan jawaban dengan fitur ini.` : ""),
  };

  try {
    const result = await chatComplete([system, ...history], { temperature: 0.4, maxTokens: 700 });
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

  const system = {
    role: "system",
    content: `Ringkas percakapan konsultasi karier berikut menjadi POIN-POIN singkat (maks 8 butir): ` +
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
