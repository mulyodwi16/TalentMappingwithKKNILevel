import express from "express";
import { randomBytes } from "node:crypto";
import { prisma } from "../prisma.js";
import { requireAuth } from "../middleware/auth.js";
import {
  COIN, getBalance, recentTransactions, award, awardOnce,
  getDailyStatus, claimDaily,
} from "../gamification.js";

// Gamifikasi Koin Talenta: dompet, login harian (streak), dan Toko kelas premium.
const router = express.Router();
router.use(requireAuth);

// Katalog "Kelas Premium" — dibuka/di-unlock dengan koin. Ini SINK koin (course AvatarEdu
// gratis untuk diikuti & malah memberi koin; kelas premium di sini ditebus dengan koin).
const SHOP_ITEMS = [
  { id: "kelas-uji-kompetensi", name: "Kelas Intensif: Persiapan Uji Kompetensi", desc: "Bimbingan terstruktur menghadapi ujian kompetensi SKKNI agar lulus di percobaan pertama.", cost: 300, category: "Kelas Premium", icon: "graduation" },
  { id: "kelas-naik-jenjang", name: "Kelas: Strategi Naik Skill Rank", desc: "Peta jalan langkah demi langkah menaikkan Skill Rank sesuai profesimu.", cost: 300, category: "Kelas Premium", icon: "graduation" },
  { id: "bundle-skkni-video", name: "Bundle Materi SKKNI Video Editing", desc: "Kumpulan materi & latihan lengkap 11 unit kompetensi SKKNI 2014-118.", cost: 250, category: "Materi", icon: "book" },
  { id: "ebook-portofolio", name: "E-book: Membangun Portofolio & CV Juara", desc: "Panduan menyusun CV dan portofolio yang mudah dipetakan ke Skill Rank.", cost: 120, category: "Materi", icon: "book" },
  { id: "mentoring-1on1", name: "Sesi Mentoring 1-on-1 (30 menit)", desc: "Konsultasi privat bersama mentor untuk rencana pengembangan kariermu.", cost: 400, category: "Pendampingan", icon: "bot" },
  { id: "sertifikat-showcase", name: "Sorotan Profil Talenta 14 Hari", desc: "Profil kompetensimu disorot ke HRD di jaringan talent pool selama 14 hari.", cost: 350, category: "Peluang", icon: "sparkle" },
];
function getShopItem(id) { return SHOP_ITEMS.find((s) => s.id === id); }
function voucherCode() { return "RANK-" + randomBytes(4).toString("hex").toUpperCase(); }

// ── Dompet ────────────────────────────────────────────────────────────────────
router.get("/coins", async (req, res) => {
  const userId = req.user.id;
  const [balance, transactions, daily] = await Promise.all([
    getBalance(userId), recentTransactions(userId, 25), getDailyStatus(userId),
  ]);
  res.json({ balance, transactions, daily, rules: COIN });
});

// ── Login harian ────────────────────────────────────────────────────────────
router.get("/coins/daily", async (req, res) => {
  res.json(await getDailyStatus(req.user.id));
});

router.post("/coins/daily-claim", async (req, res) => {
  const r = await claimDaily(req.user.id);
  if (r.already) return res.status(200).json({ ok: false, ...r, message: "Bonus login hari ini sudah diklaim." });
  res.json({ ok: true, ...r });
});

// ── Award saat mulai kursus / pakai mentor ──────────────────────────────────
router.post("/coins/course-start", async (req, res) => {
  const slug = String(req.body?.slug ?? "").trim().slice(0, 200);
  if (!slug) return res.status(400).json({ error: "slug kursus wajib." });
  const r = await awardOnce(req.user.id, COIN.courseStart, `Mulai kursus: ${slug}`, { type: "course", id: slug });
  res.json(r);
});

router.post("/coins/mentor-used", async (req, res) => {
  const today = new Date().toISOString().slice(0, 10);
  const r = await awardOnce(req.user.id, COIN.mentorDaily, "Konsultasi AI Mentor", { type: "mentor", id: today });
  res.json(r);
});

// ── Toko: kelas premium ─────────────────────────────────────────────────────
router.get("/shop", async (req, res) => {
  const userId = req.user.id;
  const balance = await getBalance(userId);
  let owned = [];
  try {
    const rows = await prisma.shopRedemption.findMany({ where: { userId }, select: { itemId: true } });
    owned = rows.map((r) => r.itemId);
  } catch { /* tabel belum ada */ }
  res.json({ balance, items: SHOP_ITEMS.map((s) => ({ ...s, owned: owned.includes(s.id) })) });
});

router.get("/shop/redemptions", async (req, res) => {
  try {
    const items = await prisma.shopRedemption.findMany({
      where: { userId: req.user.id }, orderBy: { createdAt: "desc" },
    });
    res.json({ items });
  } catch {
    res.json({ items: [] });
  }
});

router.post("/shop/redeem", async (req, res) => {
  const userId = req.user.id;
  const item = getShopItem(String(req.body?.itemId ?? ""));
  if (!item) return res.status(404).json({ error: "Item tidak ditemukan." });

  // Cegah tebus ganda.
  const already = await prisma.shopRedemption.findFirst({ where: { userId, itemId: item.id }, select: { id: true } });
  if (already) return res.status(400).json({ error: "Kelas ini sudah kamu miliki." });

  const balance = await getBalance(userId);
  if (balance < item.cost) return res.status(400).json({ error: "Saldo Koin belum cukup." });

  const code = voucherCode();
  await prisma.shopRedemption.create({
    data: { userId, itemId: item.id, itemName: item.name, cost: item.cost, code, status: "aktif" },
  });
  const r = await award(userId, -item.cost, `Tukar kelas: ${item.name}`, { type: "redeem", id: `${item.id}:${code}` });
  res.json({ ok: true, code, balance: r.balance, item: { id: item.id, name: item.name } });
});

export default router;
