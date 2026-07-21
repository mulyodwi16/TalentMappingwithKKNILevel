import test, { before, after } from "node:test";
import assert from "node:assert/strict";
import { siapkanDb, buatUser } from "./helpers/db.js";
import { jalankanApp, tokenUntuk } from "./helpers/app.js";

// Kunci partner AvatarEdu tak boleh sampai ke peramban. Yang dikirim ke klien hanyalah
// alamat server kita berisi tiket berumur pendek; kuncinya dipasang saat mengalihkan.

const KUNCI_UJI = "kunci-partner-rahasia-untuk-tes";

let prisma, app, talenta;

before(async () => {
  process.env.AVATAREDU_API_KEY = KUNCI_UJI;
  ({ prisma } = await siapkanDb("routes-avataredu"));
  const { default: router } = await import("../routes/avataredu.js");
  app = await jalankanApp({ "/api/avataredu": router });
  talenta = await buatUser(prisma, { role: "user" });
});
after(async () => { await app.tutup(); await prisma.$disconnect(); });

const ambilUrl = async () => {
  const r = await app.get("/api/avataredu/embed-url/contoh-slug", { token: tokenUntuk(talenta) });
  return { status: r.status, url: r.body?.url, mentah: r.teks };
};

test("alamat pemutar butuh login", async () => {
  assert.equal((await app.get("/api/avataredu/embed-url/contoh-slug")).status, 401);
});

test("balasan ke klien TIDAK memuat kunci partner", async () => {
  const { status, mentah, url } = await ambilUrl();
  assert.equal(status, 200);
  assert.equal(mentah.includes(KUNCI_UJI), false, "kunci partner ikut terkirim ke klien");
  assert.equal(url.includes("key="), false);
  assert.match(url, /\/api\/avataredu\/player\//, "harus menunjuk server kita, bukan avataredu.ai");
});

test("tiket mengalihkan ke pemutar dengan kunci dipasang di server", async () => {
  const { url } = await ambilUrl();
  const jalur = url.replace(/^https?:\/\/[^/]+/, "");
  const r = await app.get(jalur, { redirect: "manual" });
  assert.equal(r.status, 302);
  const lokasi = r.headers.get("location");
  assert.match(lokasi, /^https:\/\/avataredu\.ai\/embed\/scorm\/contoh-slug/);
  assert.ok(lokasi.includes(`key=${KUNCI_UJI}`), "kunci harus dipasang saat mengalihkan");
  assert.ok(lokasi.includes(`partner_user_id=${talenta.id}`));
});

test("bab yang dipilih ikut terbawa", async () => {
  const r = await app.get("/api/avataredu/embed-url/contoh-slug?chapter=7", { token: tokenUntuk(talenta) });
  const jalur = r.body.url.replace(/^https?:\/\/[^/]+/, "");
  const red = await app.get(jalur, { redirect: "manual" });
  assert.ok(red.headers.get("location").includes("chapter=7"));
});

test("tiket yang dirusak ditolak", async () => {
  const { url } = await ambilUrl();
  const jalur = url.replace(/^https?:\/\/[^/]+/, "") + "xx";
  assert.equal((await app.get(jalur, { redirect: "manual" })).status, 403);
});

test("tiket tanpa tanda tangan ditolak", async () => {
  const r = await app.get("/api/avataredu/player/contoh-slug?t=palsu", { redirect: "manual" });
  assert.equal(r.status, 403);
});

test("tiket untuk slug LAIN tidak bisa dipakai di slug ini", async () => {
  const { url } = await ambilUrl();
  const t = new URL(url).searchParams.get("t");
  const r = await app.get(`/api/avataredu/player/slug-lain?t=${encodeURIComponent(t)}`, { redirect: "manual" });
  assert.equal(r.status, 403);
});

test("tiket kedaluwarsa ditolak", async () => {
  const crypto = await import("node:crypto");
  const rahasia = process.env.JWT_SECRET || "avataredu-ticket";
  const isi = Buffer.from(JSON.stringify({
    uid: talenta.id, slug: "contoh-slug", chapter: null, exp: Date.now() - 1000,
  })).toString("base64url");
  const sig = crypto.createHmac("sha256", rahasia).update(isi).digest("base64url");
  const r = await app.get(`/api/avataredu/player/contoh-slug?t=${isi}.${sig}`, { redirect: "manual" });
  assert.equal(r.status, 403);
});

test("tanpa kunci partner terpasang, jawabannya jujur bukan menggantung", async () => {
  const simpan = process.env.AVATAREDU_API_KEY;
  delete process.env.AVATAREDU_API_KEY;
  const r = await app.get("/api/avataredu/embed-url/contoh-slug", { token: tokenUntuk(talenta) });
  assert.equal(r.status, 503);
  process.env.AVATAREDU_API_KEY = simpan;
});
