import express from "express";
import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import { randomUUID } from "node:crypto";
import { prisma } from "../prisma.js";
import { requireAuth } from "../middleware/auth.js";
import { statusInfo, educationSeed } from "../onboarding.js";

const router = express.Router();
const SECRET = process.env.JWT_SECRET || "dev-secret-change-me";

const makeToken = (u) =>
  jwt.sign({ id: u.id, email: u.email, role: u.role, name: u.name }, SECRET, { expiresIn: "8h" });

router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body || {};
    if (!email || !password)
      return res.status(400).json({ error: "email dan password wajib diisi" });
    const u = await prisma.user.findUnique({ where: { email: email.toLowerCase() } });
    const ok = u && await bcrypt.compare(password, u.passwordHash);
    if (!ok) return res.status(401).json({ error: "email atau password salah" });
    res.json({ token: makeToken(u), user: { id: u.id, email: u.email, role: u.role, name: u.name } });
  } catch (e) {
    console.error("[login]", e.message);
    res.status(500).json({ error: "Terjadi kesalahan server: " + e.message });
  }
});

router.post("/register", async (req, res) => {
  try {
    const { name, email, password, academicStatus } = req.body || {};
    if (!name || !email || !password)
      return res.status(400).json({ error: "name, email, password wajib diisi" });
    const exists = await prisma.user.findUnique({ where: { email: email.toLowerCase() } });
    if (exists) return res.status(409).json({ error: "email sudah terdaftar" });
    // Status akademik → isi pendidikan & rank AWAL (seed). Rank sebenarnya diraih dari kompetensi.
    const info = statusInfo(academicStatus);
    const seed = info ? educationSeed({ academicStatus, education: info.education }) : null;
    const u = await prisma.user.create({
      data: {
        name, email: email.toLowerCase(), passwordHash: await bcrypt.hash(password, 10),
        academicStatus: info ? academicStatus : null,
        education: info?.education || null,
        currentKkniLevel: seed,
      },
    });
    res.status(201).json({ token: makeToken(u), user: { id: u.id, email: u.email, role: u.role, name: u.name } });
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

// ── Login Google (OAuth) ──────────────────────────────────────────────────────
// Client ID BUKAN rahasia (dipakai FE untuk render tombol GIS) — aman diekspos.
router.get("/google-config", (req, res) => {
  res.json({ clientId: process.env.GOOGLE_CLIENT_ID || null });
});

// Terima ID token dari tombol Google (GIS), VERIFIKASI via endpoint tokeninfo Google
// (tanda tangan dicek Google server-side; kita validasi audience + email terverifikasi),
// lalu login / auto-daftar dan terbitkan JWT internal seperti biasa.
router.post("/google", async (req, res) => {
  try {
    const clientId = process.env.GOOGLE_CLIENT_ID;
    if (!clientId) return res.status(503).json({ error: "Login Google belum dikonfigurasi." });
    const { credential } = req.body || {};
    if (!credential) return res.status(400).json({ error: "credential (ID token) wajib dikirim." });

    const r = await fetch("https://oauth2.googleapis.com/tokeninfo?id_token=" + encodeURIComponent(credential), {
      signal: AbortSignal.timeout(8000),
    });
    if (!r.ok) return res.status(401).json({ error: "Token Google tidak valid / kedaluwarsa." });
    const p = await r.json();
    if (p.aud !== clientId) return res.status(401).json({ error: "Token bukan untuk aplikasi ini." });
    if (String(p.email_verified) !== "true" || !p.email) return res.status(401).json({ error: "Email Google belum terverifikasi." });

    const email = String(p.email).toLowerCase();
    let u = await prisma.user.findUnique({ where: { email } });
    let isNew = false;
    if (!u) {
      // Auto-daftar sebagai Talenta. Password acak (login selanjutnya via Google).
      isNew = true;
      u = await prisma.user.create({
        data: {
          name: p.name || email.split("@")[0],
          email,
          passwordHash: await bcrypt.hash(randomUUID(), 10),
          googleId: p.sub,
          avatarUrl: p.picture || null, // foto Google sebagai foto profil awal
        },
      });
    } else if (!u.googleId) {
      // Tautkan akun lama (email sama) dengan Google.
      u = await prisma.user.update({
        where: { id: u.id },
        data: { googleId: p.sub, avatarUrl: u.avatarUrl || p.picture || null },
      });
    }
    res.json({ token: makeToken(u), user: { id: u.id, email: u.email, role: u.role, name: u.name }, isNew });
  } catch (e) {
    console.error("[google-auth]", e.message);
    res.status(500).json({ error: "Login Google gagal: " + e.message });
  }
});

router.get("/me", requireAuth, async (req, res) => {
  const u = await prisma.user.findUnique({ where: { id: req.user.id } });
  if (!u) return res.status(404).json({ error: "user not found" });
  const { passwordHash: _, ...safe } = u;
  res.json({ ...safe, certifications: JSON.parse(safe.certifications) });
});

export default router;
