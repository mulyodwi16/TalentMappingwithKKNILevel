import express from "express";
import { requireAuth } from "../middleware/auth.js";
import { prisma } from "../prisma.js";

// Integrasi AvatarEdu.ai (partner API). Base + header sesuai dokumentasi partner.
// CATATAN: katalog AvatarEdu saat ini kecil (~10 course bertema AI/data). Param `q` MEMANG
// memfilter berdasar judul — jadi query spesifik (mis. "video editing") bisa 0 hasil.
// Karena itu kita FALLBACK ke seluruh katalog bila query tak menemukan apa pun, agar course
// selalu tampil. Validasi key & akses via `/me`.
const router = express.Router();
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
  try {
    if (cfg.featuredSlugs?.length) {
      const results = await Promise.all(cfg.featuredSlugs.map(async (slug) => {
        try { const r = await fetch(`${BASE}/courses/${encodeURIComponent(slug)}`, { headers: avHeaders() }); return r.ok ? (await r.json()).data : null; } catch { return null; }
      }));
      return res.json({ data: results.filter(Boolean), enabled: true });
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

// Embed URL dengan key diinject server-side — key tak pernah bocor ke bundle JS.
router.get("/embed-url/:slug", (req, res) => {
  const key = process.env.AVATAREDU_API_KEY;
  if (!key) return res.status(503).json({ error: "AVATAREDU_API_KEY not set" });
  res.json({ url: `https://avataredu.ai/embed/course/${encodeURIComponent(req.params.slug)}?key=${encodeURIComponent(key)}` });
});

export default router;
