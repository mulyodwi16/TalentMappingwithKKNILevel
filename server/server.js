import "./env.js";
import express from "express";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import cors from "cors";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import { prisma } from "./prisma.js";
import authRoutes from "./routes/auth.js";
import userRoutes from "./routes/user.js";
import hrdRoutes from "./routes/hrd.js";
import adminRoutes from "./routes/admin.js";
import avatareduRoutes from "./routes/avataredu.js";
import mentorRoutes from "./routes/mentor.js";
import gamificationRoutes from "./routes/gamification.js";
import missionRoutes from "./routes/missions.js";
import jobRoutes from "./routes/jobs.js";
import skkniRoutes from "./routes/skkni.js";
import learningPathRoutes from "./routes/learningpath.js";
import kelasRoutes from "./routes/kelas.js";
import evidenceRoutes from "./routes/evidence.js";
import { kickCatalogSyncIfEmpty } from "./skkni.js";

const HERE = dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = process.env.PORT || 5000;

app.use(helmet({ contentSecurityPolicy: false }));
app.use(cors({
  origin: ["http://localhost:5173", `http://localhost:${PORT}`, process.env.CLIENT_URL].filter(Boolean),
  credentials: true,
}));
app.use(rateLimit({ windowMs: 15 * 60 * 1000, max: 500, standardHeaders: true, legacyHeaders: false }));
app.use(express.json({ limit: "12mb" }));

app.use("/api/auth",  authRoutes);
app.use("/api/user",  userRoutes);
app.use("/api/hrd",   hrdRoutes);
app.use("/api/admin",     adminRoutes);
app.use("/api/avataredu", avatareduRoutes);
app.use("/api/mentor",    mentorRoutes);
app.use("/api/missions",  missionRoutes);
app.use("/api/jobs",      jobRoutes);
app.use("/api/skkni",     skkniRoutes);
app.use("/api/learning-path", learningPathRoutes);
app.use("/api/kelas",     kelasRoutes);
app.use("/api/evidence",  evidenceRoutes);

app.get("/api/health", (_req, res) => res.json({ ok: true, ts: new Date().toISOString() }));

// Gamifikasi mounted di "/api" (requireAuth global) — HARUS setelah rute publik seperti /api/health.
app.use("/api",           gamificationRoutes);

if (process.env.NODE_ENV === "production") {
  const dist = join(HERE, "../client/dist");
  app.use(express.static(dist));
  app.use((_req, res) => res.sendFile(join(dist, "index.html")));
}

// eslint-disable-next-line no-unused-vars
app.use((err, _req, res, _next) => {
  console.error(err.message);
  res.status(500).json({ error: err.message });
});

process.on("SIGTERM", () => prisma.$disconnect());

app.listen(PORT, () => {
  console.log(`API on http://localhost:${PORT}`);
  // Warm-up katalog SKKNI di latar belakang (throttled, tak menghambat startup).
  kickCatalogSyncIfEmpty();
});
