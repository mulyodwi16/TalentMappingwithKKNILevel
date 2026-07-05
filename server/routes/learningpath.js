import express from "express";
import { requireAuth } from "../middleware/auth.js";
import { LlmError } from "../llm.js";
import { getPlan, generatePlan } from "../learningpath.js";

// Learning Path AI (permintaan #4): rencana belajar personal dari hasil ujian +
// kompetensi SKKNI yang dipilih + profesi target, plus pengecekan kesiapan oleh AI.
const router = express.Router();
router.use(requireAuth);

const errStatus = (e) => (e instanceof LlmError && e.status ? e.status : 500);

// Rencana tersimpan + masukan (untuk render tanpa regenerasi).
router.get("/", async (req, res) => {
  try {
    res.json(await getPlan(req.user.id));
  } catch (e) {
    res.status(errStatus(e)).json({ error: e.message || "Gagal memuat rencana." });
  }
});

// Susun / perbarui rencana (memanggil AI; simpan profesi target bila dikirim).
router.post("/generate", async (req, res) => {
  try {
    const targetRole = typeof req.body?.targetRole === "string" ? req.body.targetRole : undefined;
    res.json(await generatePlan(req.user.id, targetRole));
  } catch (e) {
    res.status(errStatus(e)).json({ error: e.message || "Gagal menyusun rencana." });
  }
});

// Catatan: progres langkah TIDAK lagi diisi manual — dilacak otomatis dari aktivitas
// user (unit lulus, kelas, CV, sertifikat, bukti) di deriveStepProgress. Endpoint /step dihapus.

export default router;
