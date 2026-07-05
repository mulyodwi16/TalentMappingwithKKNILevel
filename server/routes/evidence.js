import express from "express";
import { prisma } from "../prisma.js";
import { requireAuth } from "../middleware/auth.js";
import { chatComplete, isLlmConfigured, LlmError } from "../llm.js";
import { refreshRank } from "../rankcalc.js";
import { refreshReadiness } from "../readiness.js";

// Bukti kompetensi EKSTERNAL (#2b): sertifikasi resmi, portofolio, pengalaman, pelatihan.
// AI menilai plausibilitas + relevansi + level yang diimplikasikan. Bukti terverifikasi
// bisa menembus cap bobot kompetensi (menuju "ahli"), tapi tetap butuh koroborasi ujian.
const router = express.Router();
router.use(requireAuth);

const TYPES = ["certification", "portfolio", "experience", "training"];
const TYPE_LABEL = {
  certification: "Sertifikasi resmi", portfolio: "Portofolio",
  experience: "Pengalaman kerja", training: "Pelatihan/Webinar",
};

// Penilaian AI atas satu bukti. Tanpa LLM → heuristik konservatif (butuh detail cukup).
async function verifyEvidence({ type, title, issuer, description, url }, competencyTitle) {
  if (!isLlmConfigured()) {
    // Heuristik: sertifikasi dgn penerbit + deskripsi memadai → terima level menengah.
    const detailed = (description || "").length >= 40;
    const hasIssuer = !!(issuer && issuer.length >= 2);
    const accepted = detailed && (type !== "certification" || hasIssuer);
    return {
      status: accepted ? "verified" : "pending",
      credibility: accepted ? 60 : 30,
      rankImplied: accepted ? (type === "certification" ? 6 : 5) : 0,
      verdict: accepted ? "Diterima sementara (verifikasi otomatis tanpa AI). Perlu tinjauan lanjutan." : "Detail kurang untuk diverifikasi — lengkapi penerbit & deskripsi.",
    };
  }
  const prompt =
    `Kamu verifikator bukti kompetensi pada platform karier. Kompetensi/profesi TARGET pengguna: "${competencyTitle || "(belum dipilih)"}".\n` +
    `Nilai BUKTI EKSTERNAL yang diajukan pengguna (bukan dari ujian platform ini):\n` +
    `- Jenis: ${TYPE_LABEL[type] || type}\n- Judul: ${title}\n- Penerbit/Institusi: ${issuer || "-"}\n- Deskripsi: ${description || "-"}\n- Tautan: ${url || "-"}\n\n` +
    `Tugas: (a) nilai PLAUSIBILITAS & kredibilitas bukti (0-100; klaim kabur/tak terverifikasi = rendah), ` +
    `(b) RELEVANSI ke kompetensi target, (c) LEVEL keahlian yang diimplikasikan pada skala 9-tier ` +
    `(3 Gold, 4 Platinum, 5 Emerald, 6 Diamond, 7 Master, 8 Grandmaster, 9 Legend). ` +
    `Pedoman level: sertifikasi lembaga NASIONAL resmi (mis. BNSP) ~7; sertifikasi INTERNASIONAL lanjutan ~8-9; ` +
    `kursus online umum ~5; portofolio/pengalaman kuat & spesifik ~6-7; klaim tanpa detail = tolak.\n` +
    `Balas HANYA JSON: {"accepted":true|false,"credibility":0-100,"rankImplied":3-9,"verdict":"<=1 kalimat"}`;
  try {
    const r = await chatComplete([{ role: "user", content: prompt }], { temperature: 0.2, maxTokens: 220 });
    const m = (r.content || "").match(/\{[\s\S]*\}/);
    const o = JSON.parse(m ? m[0] : r.content);
    const accepted = !!o.accepted && Number(o.credibility) >= 50;
    return {
      status: accepted ? "verified" : "rejected",
      credibility: Math.max(0, Math.min(100, Number(o.credibility) || 0)),
      rankImplied: accepted ? Math.max(3, Math.min(9, Number(o.rankImplied) || 5)) : 0,
      verdict: String(o.verdict || "").slice(0, 240),
    };
  } catch (e) {
    return { status: "pending", credibility: 0, rankImplied: 0, verdict: "Gagal verifikasi otomatis: " + e.message };
  }
}

router.get("/", async (req, res) => {
  const items = await prisma.externalEvidence.findMany({ where: { userId: req.user.id }, orderBy: { createdAt: "desc" } });
  res.json({ items, types: TYPES.map((t) => ({ key: t, label: TYPE_LABEL[t] })) });
});

router.post("/", async (req, res) => {
  try {
    const b = req.body || {};
    const type = TYPES.includes(b.type) ? b.type : "certification";
    const title = String(b.title || "").trim().slice(0, 160);
    if (!title) return res.status(400).json({ error: "Judul bukti wajib diisi." });
    const issuer = String(b.issuer || "").trim().slice(0, 120) || null;
    const description = String(b.description || "").trim().slice(0, 1000) || null;
    const url = String(b.url || "").trim().slice(0, 400) || null;

    const u = await prisma.user.findUnique({ where: { id: req.user.id }, select: { chosenSkkniTitle: true } });
    const v = await verifyEvidence({ type, title, issuer, description, url }, u?.chosenSkkniTitle);

    const item = await prisma.externalEvidence.create({
      data: { userId: req.user.id, type, title, issuer, description, url, relatedCompetency: u?.chosenSkkniTitle || null, ...v },
    });
    // Bukti terverifikasi memengaruhi rank & kesiapan.
    const rank = await refreshRank(req.user.id).catch(() => null);
    const readiness = await refreshReadiness(req.user.id).catch(() => null);
    res.json({ item, rank, readiness });
  } catch (e) {
    res.status(e instanceof LlmError ? (e.status || 500) : 500).json({ error: e.message });
  }
});

router.delete("/:id", async (req, res) => {
  await prisma.externalEvidence.deleteMany({ where: { id: req.params.id, userId: req.user.id } });
  const rank = await refreshRank(req.user.id).catch(() => null);
  const readiness = await refreshReadiness(req.user.id).catch(() => null);
  res.json({ ok: true, rank, readiness });
});

export default router;
