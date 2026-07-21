import test, { before, after } from "node:test";
import assert from "node:assert/strict";
import { siapkanDb, buatUser, uniq } from "./helpers/db.js";
import { jalankanApp, tokenUntuk } from "./helpers/app.js";

// Panel admin memegang akun orang. Yang dijaga: hak akses, validasi masukan, dan
// penghapusan yang benar-benar bekerja tanpa meninggalkan baris yatim.

let prisma, app, admin, hrd, talenta;

before(async () => {
  ({ prisma } = await siapkanDb("routes-admin"));
  const { default: adminRouter } = await import("../routes/admin.js");
  app = await jalankanApp({ "/api/admin": adminRouter });
  admin = await buatUser(prisma, { role: "admin", name: "Admin", email: "admin@uji.local" });
  hrd = await buatUser(prisma, { role: "hrd", name: "HRD" });
  talenta = await buatUser(prisma, { role: "user", name: "Talenta" });
});
after(async () => { await app.tutup(); await prisma.$disconnect(); });

const sbgAdmin = () => tokenUntuk(admin);
const baru = (extra = {}) => ({ name: "Orang Baru", email: `${uniq("baru")}@uji.local`, password: "rahasia123", ...extra });

test("hanya admin yang boleh membuka panel", async () => {
  assert.equal((await app.get("/api/admin/users")).status, 401);
  assert.equal((await app.get("/api/admin/users", { token: tokenUntuk(hrd) })).status, 403);
  assert.equal((await app.get("/api/admin/users", { token: tokenUntuk(talenta) })).status, 403);
  assert.equal((await app.get("/api/admin/users", { token: sbgAdmin() })).status, 200);
});

test("daftar pengguna tak pernah mengirim kata sandi", async () => {
  const r = await app.get("/api/admin/users", { token: sbgAdmin() });
  assert.ok(r.body.every((u) => !("passwordHash" in u)));
});

test("membuat pengguna tanpa kata sandi ditolak", async () => {
  // Dulu body tanpa password diam-diam membuat akun berkata sandi "demo123".
  const { password: _, ...tanpa } = baru();
  const r = await app.post("/api/admin/users", { token: sbgAdmin(), body: tanpa });
  assert.equal(r.status, 400);
  assert.match(r.body.error, /kata sandi/i);
});

test("kata sandi terlalu pendek ditolak", async () => {
  const r = await app.post("/api/admin/users", { token: sbgAdmin(), body: baru({ password: "abc" }) });
  assert.equal(r.status, 400);
});

test("email tak berformat ditolak", async () => {
  const r = await app.post("/api/admin/users", { token: sbgAdmin(), body: baru({ email: "bukan-email" }) });
  assert.equal(r.status, 400);
});

test("peran di luar daftar ditolak", async () => {
  const r = await app.post("/api/admin/users", { token: sbgAdmin(), body: baru({ role: "superadmin" }) });
  assert.equal(r.status, 400);
  assert.match(r.body.error, /role/i);
});

test("email kembar ditolak", async () => {
  const body = baru();
  assert.equal((await app.post("/api/admin/users", { token: sbgAdmin(), body })).status, 201);
  assert.equal((await app.post("/api/admin/users", { token: sbgAdmin(), body })).status, 409);
});

test("skor & rank TIDAK bisa disuntikkan dari klien", async () => {
  // Dulu seluruh isi body disebar ke Prisma, jadi angka yang seharusnya dihitung dari
  // bukti bisa dikarang - termasuk readinessScore yang dibaca perekrut.
  const r = await app.post("/api/admin/users", {
    token: sbgAdmin(),
    body: baru({ readinessScore: 99, currentKkniLevel: 9, status: "ready", googleId: "curian" }),
  });
  assert.equal(r.status, 201);
  const db = await prisma.user.findUnique({ where: { id: r.body.id } });
  assert.equal(db.readinessScore, 0);
  assert.equal(db.currentKkniLevel, null);
  assert.equal(db.googleId, null);
});

test("perubahan pengguna dicatat lengkap dengan isinya", async () => {
  // Entri "update_user someone@x" tanpa isi tak bisa dipakai menelusuri siapa yang
  // menaikkan peran seseorang jadi admin.
  const u = (await app.post("/api/admin/users", { token: sbgAdmin(), body: baru() })).body;
  await app.put(`/api/admin/users/${u.id}`, { token: sbgAdmin(), body: { role: "hrd" } });
  const log = await prisma.auditLog.findFirst({ where: { action: "update_user", target: u.email } });
  assert.ok(log, "perubahan harus tercatat");
  assert.match(log.meta || "", /role/, "catatannya harus menyebut apa yang berubah");
});

test("admin tak bisa menurunkan peran dirinya sendiri", async () => {
  const r = await app.put(`/api/admin/users/${admin.id}`, { token: sbgAdmin(), body: { role: "user" } });
  assert.equal(r.status, 400);
});

test("admin tak bisa menghapus dirinya sendiri", async () => {
  const r = await app.del(`/api/admin/users/${admin.id}`, { token: sbgAdmin() });
  assert.equal(r.status, 400);
});

test("pengguna yang tak ada memberi 404 yang jujur", async () => {
  const r = await app.del("/api/admin/users/tidak-ada", { token: sbgAdmin() });
  assert.equal(r.status, 404);
});

test("hapus pengguna yang punya data terkait BERHASIL dan tak sisakan yatim", async () => {
  // Skema tak punya relasi berantai di User, jadi versi lama melempar P2003 lalu membalas
  // "user not found" untuk orang yang jelas ada di tabel.
  const u = (await app.post("/api/admin/users", { token: sbgAdmin(), body: baru() })).body;
  await prisma.notification.create({ data: { userId: u.id, type: "uji", message: "halo" } });
  await prisma.coinWallet.create({ data: { userId: u.id, balance: 10 } });
  await prisma.skillAssessment.create({
    data: { userId: u.id, competencyCode: "X.1", competencyName: "Uji", currentScore: 70, requiredScore: 100, gap: 30 },
  });
  await prisma.examAttempt.create({
    data: { userId: u.id, kkniLevel: 3, answers: "{}", scorePerCompetency: "{}", results: "[]", readinessScore: 70, status: "ready", passed: true, gaps: "[]" },
  });

  const r = await app.del(`/api/admin/users/${u.id}`, { token: sbgAdmin() });
  assert.equal(r.status, 200, `gagal menghapus: ${JSON.stringify(r.body)}`);

  assert.equal(await prisma.user.count({ where: { id: u.id } }), 0);
  for (const [nama, model] of [["notifikasi", prisma.notification], ["dompet", prisma.coinWallet],
    ["penilaian", prisma.skillAssessment], ["percobaan", prisma.examAttempt]]) {
    assert.equal(await model.count({ where: { userId: u.id } }), 0, `${nama} tertinggal sebagai yatim`);
  }
});

test("akun yang masih memegang posisi tidak dihapus diam-diam", async () => {
  // Menghapusnya akan menghilangkan seluruh catatan seleksi milik orang lain.
  const u = (await app.post("/api/admin/users", { token: sbgAdmin(), body: baru({ role: "hrd" }) })).body;
  await prisma.job.create({
    data: { postedById: u.id, postedByName: "HRD", title: "Posisi", kkniLevel: 3, skills: '["A"]', certifications: "[]", modules: "[]" },
  });
  const r = await app.del(`/api/admin/users/${u.id}`, { token: sbgAdmin() });
  assert.equal(r.status, 409);
  assert.match(r.body.error, /posisi/i);
  assert.equal(await prisma.user.count({ where: { id: u.id } }), 1, "akunnya harus tetap ada");
});

test("penghapusan tercatat di jejak audit", async () => {
  const u = (await app.post("/api/admin/users", { token: sbgAdmin(), body: baru() })).body;
  await app.del(`/api/admin/users/${u.id}`, { token: sbgAdmin() });
  const log = await prisma.auditLog.findFirst({ where: { action: "delete_user", target: u.email } });
  assert.ok(log, "penghapusan wajib tercatat");
});
