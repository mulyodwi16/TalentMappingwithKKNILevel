import express from "express";
import { requireAuth } from "../middleware/auth.js";

const router = express.Router();
router.use(requireAuth);

const BASE = "https://avataredu.ai/api/v1";
const avHeaders = () => ({ "X-API-Key": process.env.AVATAREDU_API_KEY });

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
