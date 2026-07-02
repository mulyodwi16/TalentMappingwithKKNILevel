import express from "express";
import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import { prisma } from "../prisma.js";
import { requireAuth } from "../middleware/auth.js";

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
    const { name, email, password, department, position } = req.body || {};
    if (!name || !email || !password)
      return res.status(400).json({ error: "name, email, password wajib diisi" });
    const exists = await prisma.user.findUnique({ where: { email: email.toLowerCase() } });
    if (exists) return res.status(409).json({ error: "email sudah terdaftar" });
    const u = await prisma.user.create({
      data: { name, email: email.toLowerCase(), passwordHash: await bcrypt.hash(password, 10), department, position },
    });
    res.status(201).json({ token: makeToken(u), user: { id: u.id, email: u.email, role: u.role, name: u.name } });
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

router.get("/me", requireAuth, async (req, res) => {
  const u = await prisma.user.findUnique({ where: { id: req.user.id } });
  if (!u) return res.status(404).json({ error: "user not found" });
  const { passwordHash: _, ...safe } = u;
  res.json({ ...safe, certifications: JSON.parse(safe.certifications) });
});

export default router;
