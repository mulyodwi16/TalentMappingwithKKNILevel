import test, { before, after } from "node:test";
import assert from "node:assert/strict";
import { siapkanDb, buatUser, buatKompetensi, beriNilai, UNIT_VIDEO } from "./helpers/db.js";
import { jalankanApp, tokenUntuk } from "./helpers/app.js";

// Posisi & kandidat. Yang dijaga: satu perekrut tak boleh menyentuh posisi perekrut lain,
// dan tak ada posisi yang bisa dibuka tanpa syarat kemampuan - karena posisi tanpa syarat
// membuat SELURUH kolam talenta terbaca "memenuhi syarat".

let prisma, app, hrdA, hrdB, admin, talenta;

const POSISI = { title: "Video Editor", kkniLevel: 3, minExperience: 0, skills: ["Menyunting Audio/Video"] };

before(async () => {
  ({ prisma } = await siapkanDb("routes-jobs"));
  const { default: jobsRouter } = await import("../routes/jobs.js");
  app = await jalankanApp({ "/api/jobs": jobsRouter });

  hrdA = await buatUser(prisma, { role: "hrd", name: "HRD A" });
  hrdB = await buatUser(prisma, { role: "hrd", name: "HRD B" });
  admin = await buatUser(prisma, { role: "admin", name: "Admin" });

  const doc = await buatKompetensi(prisma, { units: UNIT_VIDEO });
  talenta = await buatUser(prisma, { name: "Budi", experienceYears: 3, currentKkniLevel: 6 });
  await prisma.user.update({ where: { id: talenta.id }, data: { chosenSkkniId: doc } });
  for (const u of UNIT_VIDEO) await beriNilai(prisma, talenta.id, u.code, 100, u.title);
});
after(async () => { await app.tutup(); await prisma.$disconnect(); });

const buatPosisi = (pemilik, extra = {}) =>
  app.post("/api/jobs", { token: tokenUntuk(pemilik), body: { ...POSISI, ...extra } });

test("talenta tidak boleh membuka posisi", async () => {
  const r = await buatPosisi(talenta);
  assert.equal(r.status, 403);
});

test("posisi tanpa daftar kemampuan ditolak", async () => {
  for (const skills of [[], undefined, ["", "   "]]) {
    const r = await buatPosisi(hrdA, { skills });
    assert.equal(r.status, 400, `skills=${JSON.stringify(skills)} seharusnya ditolak`);
  }
});

test("posisi dengan kemampuan berhasil dibuat", async () => {
  const r = await buatPosisi(hrdA);
  assert.equal(r.status, 201);
  assert.deepEqual(r.body.skills, ["Menyunting Audio/Video"]);
});

test("mengosongkan kemampuan lewat perubahan juga ditolak", async () => {
  const j = (await buatPosisi(hrdA)).body;
  const r = await app.put(`/api/jobs/${j.id}`, { token: tokenUntuk(hrdA), body: { skills: [] } });
  assert.equal(r.status, 400);
});

test("perekrut lain tidak boleh mengubah atau menghapus posisi bukan miliknya", async () => {
  const j = (await buatPosisi(hrdA)).body;
  assert.equal((await app.put(`/api/jobs/${j.id}`, { token: tokenUntuk(hrdB), body: { title: "Dibajak" } })).status, 403);
  assert.equal((await app.del(`/api/jobs/${j.id}`, { token: tokenUntuk(hrdB) })).status, 403);
  const utuh = await prisma.job.findUnique({ where: { id: j.id } });
  assert.equal(utuh.title, "Video Editor", "judulnya tak boleh berubah");
});

test("admin boleh menyentuh posisi milik siapa pun", async () => {
  const j = (await buatPosisi(hrdA)).body;
  const r = await app.put(`/api/jobs/${j.id}`, { token: tokenUntuk(admin), body: { title: "Diperbaiki Admin" } });
  assert.equal(r.status, 200);
});

test("daftar kandidat hanya untuk pemilik posisi", async () => {
  const j = (await buatPosisi(hrdA)).body;
  assert.equal((await app.get(`/api/jobs/${j.id}/candidates`, { token: tokenUntuk(hrdB) })).status, 403);
  assert.equal((await app.get(`/api/jobs/${j.id}/candidates`, { token: tokenUntuk(hrdA) })).status, 200);
});

test("kandidat yang kompetensinya terbukti dinyatakan memenuhi syarat", async () => {
  const j = (await buatPosisi(hrdA)).body;
  const r = await app.get(`/api/jobs/${j.id}/candidates`, { token: tokenUntuk(hrdA) });
  const c = r.body.candidates.find((x) => x.user.id === talenta.id);
  assert.ok(c, "talenta harus muncul sebagai kandidat");
  assert.equal(c.eligible, true);
  assert.equal(c.missingSkills.length, 0);
});

test("kandidat yang belum terbukti TIDAK dinyatakan memenuhi syarat", async () => {
  const j = (await buatPosisi(hrdA, { skills: ["Menguasai aplikasi Resolume Arena"] })).body;
  const r = await app.get(`/api/jobs/${j.id}/candidates`, { token: tokenUntuk(hrdA) });
  const c = r.body.candidates.find((x) => x.user.id === talenta.id);
  assert.equal(c.eligible, false);
  assert.equal(c.missingSkills.length, 1);
});

test("daftar kandidat tak membocorkan data pribadi talenta", async () => {
  const j = (await buatPosisi(hrdA)).body;
  const r = await app.get(`/api/jobs/${j.id}/candidates`, { token: tokenUntuk(hrdA) });
  const c = r.body.candidates[0];
  for (const bocor of ["passwordHash", "cvMeta", "googleId", "avatarUrl"]) {
    assert.equal(bocor in c.user, false, `${bocor} bocor lewat daftar kandidat`);
  }
});

test("penilaian kandidat hanya boleh oleh pemilik posisi", async () => {
  const j = (await buatPosisi(hrdA)).body;
  const jalur = `/api/jobs/${j.id}/candidates/${talenta.id}`;
  assert.equal((await app.put(jalur, { token: tokenUntuk(hrdB), body: { status: "shortlisted" } })).status, 403);
  const ok = await app.put(jalur, { token: tokenUntuk(hrdA), body: { status: "shortlisted", note: "bagus" } });
  assert.equal(ok.status, 200);
});

test("menandai kandidat TIDAK menaikkan jumlah peminat", async () => {
  // CandidateReview (penilaian HRD) sengaja terpisah dari JobApplication (minat talenta).
  // Kalau ditumpangkan, jumlah peminat naik tiap kali HRD menandai seseorang yang bahkan
  // tak pernah menyatakan minat.
  const j = (await buatPosisi(hrdA)).body;
  await app.put(`/api/jobs/${j.id}/candidates/${talenta.id}`, {
    token: tokenUntuk(hrdA), body: { status: "shortlisted" },
  });
  const minat = await prisma.jobApplication.count({ where: { jobId: j.id } });
  assert.equal(minat, 0);
});

test("posisi yang tak ada mengembalikan 404, bukan 500", async () => {
  const r = await app.get("/api/jobs/tidak-ada", { token: tokenUntuk(talenta) });
  assert.equal(r.status, 404);
});
