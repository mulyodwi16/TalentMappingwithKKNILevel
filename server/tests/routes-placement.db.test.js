import test, { before, after } from "node:test";
import assert from "node:assert/strict";
import { siapkanDb, buatUser, buatKompetensi, UNIT_VIDEO } from "./helpers/db.js";
import { jalankanApp, tokenUntuk } from "./helpers/app.js";

// Jatah tes penempatan + buka lewat Koin. Yang dijaga di lapisan HTTP: tes yang sudah
// terkunci ditolak SEBELUM menyusun soal (tak boros LLM), buka butuh Koin cukup, dan tiap
// beli menambah tepat satu kesempatan. Alur start→submit penuh butuh LLM, jadi tak diuji
// di sini - cukup sampai gerbang jatahnya.

let prisma, app, talenta, docId, PLACEMENT_UNLOCK_COST;

before(async () => {
  ({ prisma } = await siapkanDb("routes-placement"));
  const { default: skkniRouter } = await import("../routes/skkni.js");
  ({ PLACEMENT_UNLOCK_COST } = await import("../skkni.js"));
  app = await jalankanApp({ "/api/skkni": skkniRouter });

  talenta = await buatUser(prisma, { role: "user" });
  docId = await buatKompetensi(prisma, { units: UNIT_VIDEO, title: "Video Editing" });
  await prisma.user.update({ where: { id: talenta.id }, data: { chosenSkkniId: docId, chosenSkkniTitle: "Video Editing" } });
});
after(async () => { await app.tutup(); await prisma.$disconnect(); });

const tok = () => tokenUntuk(talenta);
const setAkses = (used, bonus) => prisma.placementAccess.upsert({
  where: { userId_docId: { userId: talenta.id, docId } },
  update: { used, bonus }, create: { userId: talenta.id, docId, used, bonus },
});
const setKoin = (balance) => prisma.coinWallet.upsert({
  where: { userId: talenta.id }, update: { balance }, create: { userId: talenta.id, balance },
});

test("status placement mengabarkan sisa kesempatan", async () => {
  await setAkses(0, 0);
  const r = await app.get("/api/skkni/placement", { token: tok() });
  assert.equal(r.status, 200);
  assert.equal(r.body.attemptsLeft, 2);
  assert.equal(r.body.locked, false);
  assert.equal(r.body.unlockCost, PLACEMENT_UNLOCK_COST);
});

test("setelah jatah habis, status menandai terkunci", async () => {
  await setAkses(2, 0);
  const r = await app.get("/api/skkni/placement", { token: tok() });
  assert.equal(r.body.attemptsLeft, 0);
  assert.equal(r.body.locked, true);
});

test("memulai tes yang terkunci ditolak 403 - tanpa menyusun soal", async () => {
  await setAkses(2, 0);
  const r = await app.post("/api/skkni/placement/start", { token: tok() });
  assert.equal(r.status, 403);
  assert.equal(r.body.locked, true);
  assert.equal(r.body.unlockCost, PLACEMENT_UNLOCK_COST);
});

test("buka tanpa Koin cukup ditolak, jatah tak berubah", async () => {
  await setAkses(2, 0);
  await setKoin(PLACEMENT_UNLOCK_COST - 1);
  const r = await app.post("/api/skkni/placement/unlock", { token: tok() });
  assert.equal(r.status, 400);
  const a = await prisma.placementAccess.findUnique({ where: { userId_docId: { userId: talenta.id, docId } } });
  assert.equal(a.bonus, 0, "jatah tak boleh bertambah kalau gagal bayar");
});

test("buka dengan Koin cukup: potong Koin, tambah satu kesempatan", async () => {
  await setAkses(2, 0);
  await setKoin(PLACEMENT_UNLOCK_COST + 50);
  const r = await app.post("/api/skkni/placement/unlock", { token: tok() });
  assert.equal(r.status, 200);
  assert.equal(r.body.balance, 50, "Koin harus terpotong sebesar biaya buka");
  assert.equal(r.body.attemptsLeft, 1);
  const a = await prisma.placementAccess.findUnique({ where: { userId_docId: { userId: talenta.id, docId } } });
  assert.equal(a.bonus, 1);
  assert.equal(a.used, 2, "pemakaian tak boleh ter-reset");
});

test("sesudah buka, gerbang terbuka lagi (status tak terkunci)", async () => {
  // Sengaja cek lewat STATUS, bukan POST start - start yang lolos gerbang akan menyusun
  // soal via LLM, dan tes tak boleh menembak jaringan.
  await setAkses(2, 1);         // pakai 2, punya 1 bonus → boleh 1 lagi
  const r = await app.get("/api/skkni/placement", { token: tok() });
  assert.equal(r.body.locked, false);
  assert.equal(r.body.attemptsLeft, 1);
});

test("beli dua kali menumpuk dua kesempatan", async () => {
  await setAkses(2, 0);
  await setKoin(PLACEMENT_UNLOCK_COST * 2);
  await app.post("/api/skkni/placement/unlock", { token: tok() });
  const r2 = await app.post("/api/skkni/placement/unlock", { token: tok() });
  assert.equal(r2.status, 200);
  assert.equal(r2.body.attemptsLeft, 2);
  const a = await prisma.placementAccess.findUnique({ where: { userId_docId: { userId: talenta.id, docId } } });
  assert.equal(a.bonus, 2);
});

test("tanpa kompetensi terpilih, buka ditolak", async () => {
  const lain = await buatUser(prisma, { role: "user" });
  const r = await app.post("/api/skkni/placement/unlock", { token: tokenUntuk(lain) });
  assert.equal(r.status, 400);
});
