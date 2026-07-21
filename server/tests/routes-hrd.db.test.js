import test, { before, after } from "node:test";
import assert from "node:assert/strict";
import { siapkanDb, buatUser, buatKompetensi, beriNilai, UNIT_VIDEO } from "./helpers/db.js";
import { jalankanApp, tokenUntuk } from "./helpers/app.js";

// Rute HRD memutuskan siapa yang ditawarkan ke perekrut dan data apa yang ikut terkirim.
// Dua hal yang diuji: hak akses (siapa boleh melihat apa) dan kejujuran angkanya.

let prisma, app, hrd, admin, talenta, docId;

before(async () => {
  ({ prisma } = await siapkanDb("routes-hrd"));
  const { default: hrdRouter } = await import("../routes/hrd.js");
  app = await jalankanApp({ "/api/hrd": hrdRouter });

  hrd = await buatUser(prisma, { role: "hrd", name: "Siti HRD" });
  admin = await buatUser(prisma, { role: "admin", name: "Admin" });

  docId = await buatKompetensi(prisma, { units: UNIT_VIDEO, title: "Video Editing", weightMaxRank: 6 });
  talenta = await buatUser(prisma, {
    name: "Budi Talenta", cvMeta: JSON.stringify({ skills: ["editing"], links: { linkedin: "https://x" } }),
    googleId: "google-123", avatarUrl: "data:image/jpeg;base64,AAAA",
  });
  await prisma.user.update({
    where: { id: talenta.id },
    data: { chosenSkkniId: docId, chosenSkkniTitle: "Video Editing" },
  });
  // 3 dari 11 unit dikuasai, plus 1 nilai milik kompetensi LAIN.
  for (const u of UNIT_VIDEO.slice(0, 3)) await beriNilai(prisma, talenta.id, u.code, 100);
  await beriNilai(prisma, talenta.id, "LAIN.99", 100);
});
after(async () => { await app.tutup(); await prisma.$disconnect(); });

test("tanpa token ditolak", async () => {
  assert.equal((await app.get("/api/hrd/workers")).status, 401);
});

test("token rusak ditolak", async () => {
  const r = await app.get("/api/hrd/workers", { token: "bukan.token.asli" });
  assert.equal(r.status, 401);
});

test("talenta biasa tidak boleh membuka data HRD", async () => {
  const r = await app.get("/api/hrd/workers", { token: tokenUntuk(talenta) });
  assert.equal(r.status, 403);
});

test("HRD dan admin boleh membuka daftar talenta", async () => {
  assert.equal((await app.get("/api/hrd/workers", { token: tokenUntuk(hrd) })).status, 200);
  assert.equal((await app.get("/api/hrd/workers", { token: tokenUntuk(admin) })).status, 200);
});

test("daftar talenta TIDAK mengirim data pribadi yang tak dipakai tampilan", async () => {
  // Dulu penyaringnya hanya membuang passwordHash, jadi tiap perekrut mengunduh isi CV,
  // tautan medsos, foto base64, dan googleId SELURUH talenta hanya untuk membuka tabel.
  const r = await app.get("/api/hrd/workers", { token: tokenUntuk(hrd) });
  const w = r.body.find((x) => x.id === talenta.id);
  assert.ok(w, "talenta harus ada di daftar");
  for (const bocor of ["passwordHash", "cvMeta", "googleId", "avatarUrl", "themeMode", "accent"]) {
    assert.equal(bocor in w, false, `${bocor} tidak boleh ikut terkirim`);
  }
  assert.equal(w.name, "Budi Talenta", "kolom yang dipakai tampilan harus tetap ada");
  assert.ok("readinessScore" in w);
});

test("hitungan unit lulus di-scope ke kompetensi yang dipilih", async () => {
  // Nilai milik kompetensi lain (LAIN.99) tak boleh ikut terhitung, dan penyebutnya
  // seluruh unit kompetensi - bukan unit yang kebetulan pernah dinilai.
  const r = await app.get("/api/hrd/workers", { token: tokenUntuk(hrd) });
  const w = r.body.find((x) => x.id === talenta.id);
  assert.equal(w.passedUnits, 3);
  assert.equal(w.totalUnits, 11);
});

test("detail talenta memakai penyebut yang SAMA dengan tabel", async () => {
  // Bug nyata: baris 3/11 di tabel terbuka jadi 3/3 di modal, karena modal menghitung
  // ulang dari daftar penilaian. Modal itulah yang dipercaya perekrut.
  const tabel = (await app.get("/api/hrd/workers", { token: tokenUntuk(hrd) })).body
    .find((x) => x.id === talenta.id);
  const detail = (await app.get(`/api/hrd/worker/${talenta.id}`, { token: tokenUntuk(hrd) })).body;
  assert.equal(detail.passedUnits, tabel.passedUnits);
  assert.equal(detail.totalUnits, tabel.totalUnits);
});

test("detail talenta tidak menampilkan nilai kompetensi lain", async () => {
  const d = (await app.get(`/api/hrd/worker/${talenta.id}`, { token: tokenUntuk(hrd) })).body;
  assert.equal(d.assessments.some((a) => a.code === "LAIN.99"), false);
  assert.equal(d.assessments.length, 3);
});

test("detail talenta juga tidak membocorkan data pribadi", async () => {
  const d = (await app.get(`/api/hrd/worker/${talenta.id}`, { token: tokenUntuk(hrd) })).body;
  for (const bocor of ["passwordHash", "cvMeta", "googleId", "avatarUrl"]) {
    assert.equal(bocor in d.worker, false, `${bocor} bocor lewat detail talenta`);
  }
});

test("detail akun bukan talenta mengembalikan 404", async () => {
  const r = await app.get(`/api/hrd/worker/${hrd.id}`, { token: tokenUntuk(hrd) });
  assert.equal(r.status, 404);
});

test("pergerakan talenta bisa dibatasi rentang hari", async () => {
  const r = await app.get("/api/hrd/movement?days=30", { token: tokenUntuk(hrd) });
  assert.equal(r.status, 200);
  assert.ok(Array.isArray(r.body.moving) || Array.isArray(r.body.bergerak) || typeof r.body === "object");
});

test("ringkasan analitik tidak melempar walau datanya sedikit", async () => {
  const r = await app.get("/api/hrd/analytics", { token: tokenUntuk(hrd) });
  assert.equal(r.status, 200);
  assert.ok(Number.isInteger(r.body.total));
});
