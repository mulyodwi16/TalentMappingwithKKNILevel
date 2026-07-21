import express from "express";
import crypto from "node:crypto";
import { requireAuth } from "../middleware/auth.js";
import { prisma } from "../prisma.js";

// Integrasi AvatarEdu.ai (partner API). Base + header sesuai dokumentasi partner.
// CATATAN: katalog AvatarEdu saat ini kecil (~10 course bertema AI/data). Param `q` MEMANG
// memfilter berdasar judul - jadi query spesifik (mis. "video editing") bisa 0 hasil.
// Karena itu kita FALLBACK ke seluruh katalog bila query tak menemukan apa pun, agar course
// selalu tampil. Validasi key & akses via `/me`.
const router = express.Router();

// ── Pemutar course: tiket sekali pakai, kunci partner TIDAK pernah ke peramban ──────────
// Dulu `/embed-url/:slug` membalas URL LENGKAP berisi `?key=<AVATAREDU_API_KEY>`. Komentar
// lamanya bilang kuncinya "tak bocor ke bundle" - itu benar, tapi kuncinya tetap sampai ke
// setiap pengguna yang login: ada di badan respons API, tersimpan di state React, dan
// terpasang sebagai atribut src iframe. Satu klik "periksa elemen" sudah cukup.
// Sekarang klien hanya menerima alamat SERVER KITA berisi tiket bertanda tangan & berumur
// pendek; kunci aslinya baru dipasang di sini saat mengalihkan.
const TICKET_TTL_MS = 5 * 60 * 1000;
const ticketSecret = () => process.env.JWT_SECRET || "avataredu-ticket";

function signTicket(payload) {
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const sig = crypto.createHmac("sha256", ticketSecret()).update(body).digest("base64url");
  return `${body}.${sig}`;
}

function readTicket(raw) {
  const [body, sig] = String(raw || "").split(".");
  if (!body || !sig) return null;
  const expect = crypto.createHmac("sha256", ticketSecret()).update(body).digest("base64url");
  // Perbandingan waktu-tetap: pembandingan biasa membocorkan panjang awalan yang cocok.
  const a = Buffer.from(sig), b = Buffer.from(expect);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
  try {
    const p = JSON.parse(Buffer.from(body, "base64url").toString());
    return p.exp > Date.now() ? p : null;
  } catch { return null; }
}

// TANPA requireAuth - iframe tak bisa mengirim header Authorization. Penjaganya tiket.
// Harus didaftarkan SEBELUM router.use(requireAuth) di bawah.
router.get("/player/:slug", (req, res) => {
  const key = process.env.AVATAREDU_API_KEY;
  if (!key) return res.status(503).send("AVATAREDU_API_KEY not set");
  const t = readTicket(req.query.t);
  if (!t || t.slug !== req.params.slug) return res.status(403).send("Tautan pemutar sudah kedaluwarsa. Muat ulang halaman.");
  const chapter = t.chapter ? `&chapter=${encodeURIComponent(t.chapter)}` : "";
  res.redirect(302, `https://avataredu.ai/embed/scorm/${encodeURIComponent(t.slug)}?key=${encodeURIComponent(key)}&partner_user_id=${encodeURIComponent(t.uid)}${chapter}`);
});

router.use(requireAuth);

const BASE = "https://avataredu.ai/api/v1";
const avHeaders = () => ({ "X-API-Key": process.env.AVATAREDU_API_KEY, Accept: "application/json" });
const hasKey = () => !!process.env.AVATAREDU_API_KEY;

const AVATAREDU_DEFAULT = { enabled: true, featuredQuery: "", featuredSlugs: [] };
async function getConfig() {
  const row = await prisma.appSetting.findUnique({ where: { key: "avataredu" } });
  if (row) { try { return { ...AVATAREDU_DEFAULT, ...JSON.parse(row.value) }; } catch { /* default */ } }
  return AVATAREDU_DEFAULT;
}

async function fetchCourses({ q, level, category, per_page = 12, page = 1 } = {}) {
  const build = (withQ) => {
    const p = new URLSearchParams({ per_page: String(per_page), page: String(page) });
    if (withQ && q) p.set("q", q);
    if (level) p.set("level", level);
    if (category) p.set("category", category);
    return p;
  };
  let r = await fetch(`${BASE}/courses?${build(true)}`, { headers: avHeaders() });
  let d = await r.json().catch(() => ({}));
  let fallback = false;
  // Query tak menemukan course di katalog kecil → tampilkan semua yang tersedia.
  if (q && (!d.data || d.data.length === 0)) {
    r = await fetch(`${BASE}/courses?${build(false)}`, { headers: avHeaders() });
    d = await r.json().catch(() => ({}));
    fallback = true;
  }
  return { status: r.status, data: d, fallback };
}

// Validasi partner key + info akses (allow_all_courses, accessible_courses_count).
router.get("/me", async (_req, res) => {
  if (!hasKey()) return res.status(503).json({ error: "AVATAREDU_API_KEY not set" });
  try {
    const r = await fetch(`${BASE}/me`, { headers: avHeaders() });
    res.status(r.status).json(await r.json());
  } catch (e) { res.status(502).json({ error: e.message }); }
});

// Konfigurasi kurasi course (diatur admin).
router.get("/config", async (_req, res) => res.json(await getConfig()));

// Course unggulan: slug kurasi admin, atau (default) seluruh katalog yang tersedia.
router.get("/featured", async (_req, res) => {
  if (!hasKey()) return res.status(503).json({ error: "AVATAREDU_API_KEY not set" });
  const cfg = await getConfig();
  if (!cfg.enabled) return res.json({ data: [], enabled: false });

  const bySlug = async (slugs) => {
    const results = await Promise.all(slugs.map(async (slug) => {
      try { const r = await fetch(`${BASE}/courses/${encodeURIComponent(slug)}`, { headers: avHeaders() }); return r.ok ? (await r.json()).data : null; } catch { return null; }
    }));
    return results.filter(Boolean);
  };

  try {
    // Urutan penentu: kurasi katalog (sakelar per course di admin) → daftar slug manual →
    // kata kunci pencarian. Kurasi katalog didahulukan karena itu yang paling eksplisit.
    const curated = await prisma.avatarEduCourse.findMany({
      where: { published: true },
      orderBy: [{ displayOrder: "asc" }, { title: "asc" }],
      select: { slug: true },
    }).catch(() => []);
    if (curated.length) {
      return res.json({ data: await bySlug(curated.map((c) => c.slug)), enabled: true, source: "curated" });
    }
    if (cfg.featuredSlugs?.length) {
      return res.json({ data: await bySlug(cfg.featuredSlugs), enabled: true, source: "slugs" });
    }
    const { data, fallback } = await fetchCourses({ q: cfg.featuredQuery, per_page: 9 });
    res.json({ ...data, enabled: true, fallback });
  } catch (e) {
    res.status(502).json({ error: e.message });
  }
});

router.get("/courses", async (req, res) => {
  if (!hasKey()) return res.status(503).json({ error: "AVATAREDU_API_KEY not set" });
  const { q, level, category, per_page = 12, page = 1 } = req.query;
  try {
    const { status, data, fallback } = await fetchCourses({ q, level, category, per_page, page });
    res.status(status).json({ ...data, fallback, query: q || "" });
  } catch (e) { res.status(502).json({ error: e.message }); }
});

router.get("/courses/:slug", async (req, res) => {
  if (!hasKey()) return res.status(503).json({ error: "AVATAREDU_API_KEY not set" });
  try {
    const r = await fetch(`${BASE}/courses/${encodeURIComponent(req.params.slug)}`, { headers: avHeaders() });
    res.status(r.status).json(await r.json());
  } catch (e) { res.status(502).json({ error: e.message }); }
});

// Player SCORM: /embed/scorm/{slug} (BUKAN /embed/course/{slug} yang cuma kartu preview).
// Wajib partner_user_id agar AvatarEdu melacak progres per pengguna. Yang dikembalikan ke
// klien HANYA alamat /player di server kita berisi tiket berumur 5 menit - kunci partner
// dipasang di sisi server saat pengalihan (lihat catatan di rute /player di atas).
router.get("/embed-url/:slug", (req, res) => {
  if (!process.env.AVATAREDU_API_KEY) return res.status(503).json({ error: "AVATAREDU_API_KEY not set" });
  const ticket = signTicket({
    uid: String(req.user?.id ?? req.user?.email ?? "guest"),
    slug: req.params.slug,
    // ?chapter={id} memilih bab tertentu (course multi-chapter); tanpa itu → bab pertama.
    chapter: req.query.chapter ? String(req.query.chapter) : null,
    exp: Date.now() + TICKET_TTL_MS,
  });
  const base = `${req.protocol}://${req.get("host")}`;
  res.json({ url: `${base}/api/avataredu/player/${encodeURIComponent(req.params.slug)}?t=${ticket}` });
});

export default router;
