import express from "express";
import { prisma } from "../prisma.js";
import { requireAuth } from "../middleware/auth.js";
import { chatComplete, LlmError } from "../llm.js";

// AI Mentor Karier KKNI — chat konsultasi yang "grounded" (RAG-lite) ke data KKNI milik
// pengguna yang login: level saat ini vs target, hasil ujian, skill gap, dan status
// kesiapan promosi. Ditambah knowledge base statis soal 9 jenjang KKNI & fitur platform.
// LLM sama dengan analisis gap (OpenRouter / DeepSeek).
const router = express.Router();
router.use(requireAuth);

// Knowledge base statis yang diinject ke system prompt (fakta deterministik, bukan untuk
// "dilatih" — hanya grounding). Ringkas biar hemat token.
const KB = `PENGETAHUAN PLATFORM (KKNI Talent Mapping):
- KKNI = Kerangka Kualifikasi Nasional Indonesia (Perpres No. 8 Tahun 2012), 9 jenjang kualifikasi:
  Jenjang 1 (SD) Operator · 2 (SMP) Operator · 3 (SMA/SMK) Operator terampil ·
  4 (D1) Teknisi/Analis · 5 (D2/D3) Teknisi · 6 (D4/S1) Analis/Teknisi ahli ·
  7 (Profesi) Ahli · 8 (S2/Spesialis) Ahli spesialis · 9 (S3) Ahli utama.
- Alur sistem: (1) Upload CV → auto-prediksi jenjang KKNI awal dari pendidikan+sertifikat+pengalaman,
  (2) Ujian kompetensi terstandar SKKNI, (3) Skill Gap Analyzer (radar kompetensi aktual vs target),
  (4) Learning Path + kursus AvatarEdu untuk menutup gap, (5) status kesiapan promosi otomatis.
- Ambang lulus kompetensi: skor >= 60% per kompetensi. Readiness score = % kompetensi yang lulus.
  Status: >=80% "Siap Naik", >=50% "Dalam Proses", <50% "Perlu Peningkatan".
- Fitur yang bisa kamu arahkan (rute app): Dashboard (/app/dashboard), Upload CV (/app/cv-upload),
  Ujian Kompetensi (/app/exam), Skill Gap (/app/skill-gap), Learning Path (/app/learning-path).
- Kompetensi & soal diturunkan dari dokumen SKKNI (mis. Video Editing SKKNI 2014-118). Untuk naik/menyesuaikan
  jenjang, tutup gap kompetensi lalu ambil ujian ulang.`;

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
- Jenjang KKNI SAAT INI: ${u.currentKkniLevel ? `Level ${u.currentKkniLevel} (${curLevel?.title || "-"})${descOf(curLevel)}` : "belum dipetakan — sarankan Upload CV dulu"}
- Jenjang TARGET: ${u.targetKkniLevel ? `Level ${u.targetKkniLevel} (${tgtLevel?.title || "-"})${descOf(tgtLevel)}` : "belum diset"}
- Readiness score: ${u.readinessScore ?? 0}% · Status kesiapan: ${statusLabel}
- Terakhir ujian: ${lastAttempt ? `jenjang ${lastAttempt.kkniLevel}, readiness ${lastAttempt.readinessScore}%` : "belum pernah ujian — sarankan ambil Ujian Kompetensi"}
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
      `Kamu adalah "AI Mentor Karier KKNI" pada platform KKNI Talent Mapping. ` +
      `Tugasmu: membantu pekerja memahami jenjang KKNI-nya, menutup gap kompetensi, mempersiapkan ujian, ` +
      `dan menyusun langkah agar siap naik/menyesuaikan jenjang. Jawab dalam Bahasa Indonesia, ringkas, ramah, ` +
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
    content: `Ringkas percakapan konsultasi karier KKNI berikut menjadi POIN-POIN singkat (maks 8 butir): ` +
      `konteks pengguna (jenjang, target, gap), pertanyaan utama, saran yang sudah diberikan, dan hal yang masih perlu ditindaklanjuti. ` +
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
