import express from "express";
import { prisma } from "../prisma.js";
import { requireAuth } from "../middleware/auth.js";
import { isLlmConfigured } from "../llm.js";
import { unitStates, ensureUnitCourse, ensureUnitLessons } from "../skkni.js";
import { award, awardOnce, getBalance, COIN } from "../gamification.js";

// Fitur "Kelas": materi belajar per unit kompetensi (sumber SKKNI, di-generate AI) sebagai
// SYARAT membuka ujian unit. Kursus AvatarEdu ditampilkan sebagai pelengkap di FE.
// Gating berjenjang: selesaikan kelas unit → ujian unit terbuka → lulus → unit berikutnya.
// Koin bisa membuka unit lebih cepat (bypass urutan/kelas → langsung ujian), TAPI sertifikat
// tetap HANYA dari lulus ujian (koin beli akses, bukan bukti).
const router = express.Router();
router.use(requireAuth);

async function chosenDoc(userId) {
  const u = await prisma.user.findUnique({ where: { id: userId }, select: { chosenSkkniId: true, chosenSkkniTitle: true } });
  return u?.chosenSkkniId ? { id: u.chosenSkkniId, title: u.chosenSkkniTitle } : null;
}

function summarize(units) {
  return {
    total: units.length,
    passed: units.filter((u) => u.state === "passed").length,
    ready: units.filter((u) => u.state === "ready").length,
    learning: units.filter((u) => u.state === "learning").length,
    locked: units.filter((u) => u.state === "locked").length,
  };
}

// Daftar unit + status belajar/ujian berjenjang.
router.get("/units", async (req, res) => {
  const chosen = await chosenDoc(req.user.id);
  if (!chosen) return res.json({ chosen: null, units: [] });
  const units = await unitStates(req.user.id, chosen.id);
  res.json({ chosen, units, summary: summarize(units), balance: await getBalance(req.user.id) });
});

// Materi kelas 1 unit (generate lazy via AI bila belum ada) + status unit itu.
router.get("/unit/:code", async (req, res) => {
  const code = req.params.code;
  const chosen = await chosenDoc(req.user.id);
  if (!chosen) return res.status(400).json({ error: "Belum memilih kompetensi SKKNI." });
  const unit = await prisma.skkniUnit.findFirst({ where: { documentId: chosen.id, code } });
  if (!unit) return res.status(404).json({ error: "Unit tidak ditemukan." });

  const states = await unitStates(req.user.id, chosen.id);
  const state = states.find((s) => s.code === code) || null;

  let course = await prisma.unitCourse.findUnique({ where: { docId_unitCode: { docId: chosen.id, unitCode: code } } });
  if (!course) {
    if (!isLlmConfigured()) return res.status(503).json({ error: "Materi kelas butuh AI aktif. Hubungi admin.", state });
    try { course = await ensureUnitCourse(chosen.id, { code: unit.code, title: unit.title }); }
    catch (e) { return res.status(502).json({ error: "Gagal menyiapkan materi: " + e.message, state }); }
  }
  let content = {};
  try { content = JSON.parse(course.content); } catch { /* corrupt */ }
  res.json({ chosen, unit: { code: unit.code, title: unit.title }, content, state });
});

// Pelajaran MENDALAM bertahap (course player). Digenerate SEKALI per unit lalu
// di-cache permanen (UnitCourse.content.lessons) - request berikutnya instan.
router.get("/unit/:code/lessons", async (req, res) => {
  const code = req.params.code;
  const chosen = await chosenDoc(req.user.id);
  if (!chosen) return res.status(400).json({ error: "Belum memilih kompetensi SKKNI." });
  const unit = await prisma.skkniUnit.findFirst({ where: { documentId: chosen.id, code } });
  if (!unit) return res.status(404).json({ error: "Unit tidak ditemukan." });

  const states = await unitStates(req.user.id, chosen.id);
  const st = states.find((s) => s.code === code);
  if (st && st.state === "locked") return res.status(403).json({ error: "Unit ini di tier rank yang belum terbuka. Kuasai tier di bawahnya (atau ambil Tes Penempatan), atau buka unit ini dengan Koin.", state: st });

  if (!isLlmConfigured()) return res.status(503).json({ error: "Materi kelas butuh AI aktif. Hubungi admin." });
  try {
    const lessons = await ensureUnitLessons(chosen.id, { code: unit.code, title: unit.title });
    res.json({ unit: { code: unit.code, title: unit.title }, lessons, state: st || null });
  } catch (e) {
    res.status(502).json({ error: "Gagal menyusun pelajaran: " + e.message });
  }
});

// Tandai kelas unit SELESAI dipelajari → membuka ujian unit + beri Koin (sekali/unit).
router.post("/unit/:code/complete", async (req, res) => {
  const code = req.params.code;
  const chosen = await chosenDoc(req.user.id);
  if (!chosen) return res.status(400).json({ error: "Belum memilih kompetensi SKKNI." });
  const unit = await prisma.skkniUnit.findFirst({ where: { documentId: chosen.id, code } });
  if (!unit) return res.status(404).json({ error: "Unit tidak ditemukan." });

  // Hanya boleh menandai selesai bila unit memang sudah bisa diakses (urutan/koin).
  const states = await unitStates(req.user.id, chosen.id);
  const st = states.find((s) => s.code === code);
  if (st && st.state === "locked") return res.status(403).json({ error: "Tier rank unit ini belum terbuka. Kuasai tier di bawahnya (atau ambil Tes Penempatan), atau buka dengan Koin." });

  await prisma.unitProgress.upsert({
    where: { userId_unitCode: { userId: req.user.id, unitCode: code } },
    update: { learned: true, learnedAt: new Date() },
    create: { userId: req.user.id, docId: chosen.id, unitCode: code, learned: true, learnedAt: new Date() },
  });
  let coin = null;
  try { coin = await awardOnce(req.user.id, COIN.classComplete, `Selesai kelas: ${unit.title}`, { type: "class", id: code }); } catch { /* non-fatal */ }
  const after = await unitStates(req.user.id, chosen.id);
  res.json({ ok: true, coin, units: after, summary: summarize(after) });
});

// Buka unit lebih cepat dengan Koin: bypass urutan & kewajiban belajar → ujian terbuka.
// Sertifikat TETAP hanya dari lulus ujian. Idempoten (tak charge dua kali).
router.post("/unit/:code/unlock", async (req, res) => {
  const code = req.params.code;
  const chosen = await chosenDoc(req.user.id);
  if (!chosen) return res.status(400).json({ error: "Belum memilih kompetensi SKKNI." });
  const unit = await prisma.skkniUnit.findFirst({ where: { documentId: chosen.id, code } });
  if (!unit) return res.status(404).json({ error: "Unit tidak ditemukan." });

  const existing = await prisma.unitProgress.findUnique({ where: { userId_unitCode: { userId: req.user.id, unitCode: code } } });
  if (existing?.unlockedByCoin || existing?.learned) {
    const after = await unitStates(req.user.id, chosen.id);
    return res.json({ ok: true, already: true, balance: await getBalance(req.user.id), units: after, summary: summarize(after) });
  }
  const cost = COIN.unlockUnitCost;
  const balance = await getBalance(req.user.id);
  if (balance < cost) return res.status(402).json({ error: `Koin tidak cukup. Butuh ${cost}, saldo ${balance}.`, cost, balance });

  const spent = await award(req.user.id, -cost, `Buka unit lebih cepat: ${unit.title}`, { type: "unlock", id: code });
  await prisma.unitProgress.upsert({
    where: { userId_unitCode: { userId: req.user.id, unitCode: code } },
    update: { unlockedByCoin: true },
    create: { userId: req.user.id, docId: chosen.id, unitCode: code, unlockedByCoin: true },
  });
  const after = await unitStates(req.user.id, chosen.id);
  res.json({ ok: true, spent: cost, balance: spent.balance, units: after, summary: summarize(after) });
});

export default router;
