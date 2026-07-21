// Aplikasi Express untuk tes rute.
//
// Sengaja TIDAK memakai server.js: berkas itu memanggil app.listen dan memicu sinkron
// katalog SKKNI ke Kemnaker saat start. Tes tak boleh menembak API pihak ketiga.
// Di sini router yang sama dipasang di aplikasi kosong, lalu didengarkan di port acak.
import express from "express";
import jwt from "jsonwebtoken";

// Sama dengan middleware/auth.js. Tes tidak memuat env.js, jadi nilainya yang cadangan.
const SECRET = process.env.JWT_SECRET || "dev-secret-change-me";

export const tokenUntuk = (u) => jwt.sign({ id: u.id, email: u.email, role: u.role }, SECRET, { expiresIn: "1h" });

// `mounts` = { "/api/jobs": routerJobs, ... }
export async function jalankanApp(mounts) {
  const app = express();
  app.use(express.json({ limit: "12mb" }));
  for (const [p, r] of Object.entries(mounts)) app.use(p, r);
  // eslint-disable-next-line no-unused-vars
  app.use((err, _req, res, _next) => res.status(500).json({ error: err.message }));

  const server = await new Promise((resolve) => {
    const s = app.listen(0, "127.0.0.1", () => resolve(s));
  });
  const base = `http://127.0.0.1:${server.address().port}`;

  // Pembungkus permintaan: kembalikan status + body sekaligus supaya tes bisa memeriksa
  // keduanya tanpa mengulang boilerplate.
  async function req(metode, jalur, { token, body, redirect = "follow" } = {}) {
    const r = await fetch(base + jalur, {
      method: metode,
      redirect,
      headers: {
        ...(body ? { "Content-Type": "application/json" } : {}),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
    const teks = await r.text();
    let json = null;
    try { json = JSON.parse(teks); } catch { /* balasan bukan JSON (mis. pengalihan) */ }
    return { status: r.status, body: json, teks, headers: r.headers };
  }

  return {
    base,
    get: (j, o) => req("GET", j, o),
    post: (j, o) => req("POST", j, o),
    put: (j, o) => req("PUT", j, o),
    del: (j, o) => req("DELETE", j, o),
    tutup: () => new Promise((res) => server.close(res)),
  };
}
