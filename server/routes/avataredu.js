import express from "express";
import { requireAuth } from "../middleware/auth.js";
import { prisma } from "../prisma.js";

const router = express.Router();
router.use(requireAuth);

const BASE = "https://avataredu.ai/api/v1";
const avHeaders = () => ({ "X-API-Key": process.env.AVATAREDU_API_KEY });

const AVATAREDU_DEFAULT = { enabled: true, featuredQuery: "kompetensi kerja", featuredSlugs: [] };
async function getConfig() {
  const row = await prisma.appSetting.findUnique({ where: { key: "avataredu" } });
  if (row) { try { return { ...AVATAREDU_DEFAULT, ...JSON.parse(row.value) }; } catch { /* default */ } }
  return AVATAREDU_DEFAULT;
}

// Konfigurasi kurasi course (diatur admin) — dipakai frontend untuk course unggulan.
router.get("/config", async (_req, res) => {
  res.json(await getConfig());
});

// Course unggulan sesuai kurasi admin (daftar slug tertentu, atau hasil pencarian query).
router.get("/featured", async (_req, res) => {
  if (!process.env.AVATAREDU_API_KEY) return res.status(503).json({ error: "AVATAREDU_API_KEY not set" });
  const cfg = await getConfig();
  if (!cfg.enabled) return res.json({ data: [], enabled: false });
  try {
    if (cfg.featuredSlugs?.length) {
      const results = await Promise.all(cfg.featuredSlugs.map(async (slug) => {
        try { const r = await fetch(`${BASE}/courses/${encodeURIComponent(slug)}`, { headers: avHeaders() }); return r.ok ? (await r.json()).data : null; } catch { return null; }
      }));
      return res.json({ data: results.filter(Boolean), enabled: true });
    }
    const params = new URLSearchParams({ per_page: "9", q: cfg.featuredQuery || "" });
    const r = await fetch(`${BASE}/courses?${params}`, { headers: avHeaders() });
    const d = await r.json();
    res.status(r.status).json({ ...d, enabled: true });
  } catch (e) {
    res.status(502).json({ error: e.message });
  }
});

router.get("/courses", async (req, res) => {
  if (!process.env.AVATAREDU_API_KEY) return res.status(503).json({ error: "AVATAREDU_API_KEY not set" });
  const { q, level, category, per_page = 9, page = 1 } = req.query;
  const params = new URLSearchParams({ per_page, page });
  if (q) params.set("q", q);
  if (level) params.set("level", level);
  if (category) params.set("category", category);
  const r = await fetch(`${BASE}/courses?${params}`, { headers: avHeaders() });
  res.status(r.status).json(await r.json());
});

router.get("/courses/:slug", async (req, res) => {
  if (!process.env.AVATAREDU_API_KEY) return res.status(503).json({ error: "AVATAREDU_API_KEY not set" });
  const r = await fetch(`${BASE}/courses/${req.params.slug}`, { headers: avHeaders() });
  res.status(r.status).json(await r.json());
});

// Returns embed URL with key injected server-side — key never exposed in JS bundle
router.get("/embed-url/:slug", (req, res) => {
  const key = process.env.AVATAREDU_API_KEY;
  if (!key) return res.status(503).json({ error: "AVATAREDU_API_KEY not set" });
  res.json({ url: `https://avataredu.ai/embed/course/${encodeURIComponent(req.params.slug)}?key=${encodeURIComponent(key)}` });
});

export default router;
