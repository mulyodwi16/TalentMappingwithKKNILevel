import test, { before, after } from "node:test";
import assert from "node:assert/strict";
import { siapkanDb, buatUser, buatKompetensi, beriNilai, UNIT_VIDEO } from "./helpers/db.js";

// readiness.test.js sudah menguji RUMUSNYA tanpa database. Yang diuji di sini adalah
// pengumpulan datanya: apakah yang masuk ke rumus benar-benar milik kompetensi aktif,
// dan apakah penyebutnya seluruh unit - dua hal yang sudah pernah salah dan membuat
// HRD membaca 85% untuk orang yang baru lulus satu unit dari sebelas.

let prisma, computeReadiness, refreshReadiness, chosenUnitCodeSet;

before(async () => {
  ({ prisma } = await siapkanDb("readiness"));
  ({ computeReadiness, refreshReadiness } = await import("../readiness.js"));
  ({ chosenUnitCodeSet } = await import("../competencyScope.js"));
});
after(async () => { await prisma.$disconnect(); });

async function talenta({ lulus = 0, cvMeta = null, education = null } = {}) {
  const u = await buatUser(prisma, { cvMeta: cvMeta || "{}", education });
  const doc = await buatKompetensi(prisma, { units: UNIT_VIDEO });
  await prisma.user.update({ where: { id: u.id }, data: { chosenSkkniId: doc } });
  for (let i = 0; i < lulus; i++) await beriNilai(prisma, u.id, UNIT_VIDEO[i].code, 100);
  return { user: u, doc };
}

test("satu unit lulus dari sebelas TIDAK memberi nilai ujian penuh", async () => {
  const { user } = await talenta({ lulus: 1, cvMeta: JSON.stringify({ skills: ["a"] }) });
  const r = await computeReadiness(user.id);
  assert.equal(r.passed, 1);
  assert.equal(r.totalUnits, 11);
  assert.ok(r.exam < 10, `nilai ujian ${r.exam} terlalu besar untuk 1 dari 11 unit`);
  assert.notEqual(r.status, "ready");
});

test("lulus seluruh unit + CV memberi kesiapan tinggi", async () => {
  const { user } = await talenta({ lulus: 11, cvMeta: JSON.stringify({ skills: ["a"] }) });
  const r = await computeReadiness(user.id);
  assert.equal(r.exam, 60);
  assert.equal(r.total, 85, "CV 25 + ujian 60, tanpa sertifikat");
  assert.equal(r.status, "ready");
});

test("nilai milik kompetensi LAIN tidak menaikkan kesiapan", async () => {
  const { user } = await talenta({ lulus: 0 });
  for (const kode of ["LAIN.1", "LAIN.2", "LAIN.3"]) await beriNilai(prisma, user.id, kode, 100);
  const r = await computeReadiness(user.id);
  assert.equal(r.passed, 0);
  assert.equal(r.exam, 0);
});

test("penyebutnya seluruh unit walau baru sebagian yang dinilai", async () => {
  const { user } = await talenta({ lulus: 0 });
  // Dinilai 2 unit, keduanya lulus. Penyebut tetap 11, bukan 2.
  await beriNilai(prisma, user.id, UNIT_VIDEO[0].code, 100);
  await beriNilai(prisma, user.id, UNIT_VIDEO[1].code, 100);
  const r = await computeReadiness(user.id);
  assert.equal(r.assessed, 2);
  assert.equal(r.totalUnits, 11);
  assert.equal(r.exam, Math.round(60 * (2 / 11)));
});

test("CV terisi memberi seperempat nilai, pendidikan saja separuhnya", async () => {
  const penuh = await talenta({ cvMeta: JSON.stringify({ skills: ["a"] }) });
  assert.equal((await computeReadiness(penuh.user.id)).cv, 25);
  const sebagian = await talenta({ education: "SMK" });
  assert.equal((await computeReadiness(sebagian.user.id)).cv, 13);
  const kosong = await talenta({});
  assert.equal((await computeReadiness(kosong.user.id)).cv, 0);
});

test("cvMeta rusak tidak membuat perhitungan gagal", async () => {
  const u = await buatUser(prisma, { cvMeta: "{bukan json" });
  const r = await computeReadiness(u.id);
  assert.equal(r.cv, 0);
  assert.ok(Number.isInteger(r.total));
});

test("sertifikat kompetensi menambah nilai, klaim tak terverifikasi tidak", async () => {
  const { user, doc } = await talenta({ lulus: 0 });
  await prisma.certificate.create({
    data: { userId: user.id, competencyCode: doc, name: "Video Editing", kkniLevel: 6, score: 80, source: "competency" },
  });
  await prisma.externalEvidence.create({
    data: { userId: user.id, type: "cert", title: "Klaim", status: "pending", rankImplied: 9 },
  });
  const r = await computeReadiness(user.id);
  assert.equal(r.certCount, 1);
  assert.equal(r.evidenceCount, 0, "bukti pending tak boleh dihitung");
  assert.equal(r.cert, 5);
});

test("pengguna tak dikenal mengembalikan nol, bukan melempar", async () => {
  const r = await computeReadiness("tidak-ada");
  assert.equal(r.total, 0);
});

test("refreshReadiness menyimpan skor & status ke pengguna", async () => {
  const { user } = await talenta({ lulus: 11, cvMeta: JSON.stringify({ skills: ["a"] }) });
  await refreshReadiness(user.id);
  const after = await prisma.user.findUnique({ where: { id: user.id } });
  assert.equal(after.readinessScore, 85);
  assert.equal(after.status, "ready");
});

test("chosenUnitCodeSet menyertakan docId untuk sertifikat kompetensi", async () => {
  // Sertifikat kompetensi memakai docId sebagai kodenya, bukan kode unit. Tanpa docId di
  // dalam set ini, sertifikat yang sah bernilai nol di kesiapan, rank, dan Learning Path.
  const { user, doc } = await talenta({});
  const set = await chosenUnitCodeSet(user.id, doc);
  assert.ok(set.has(doc), "docId harus ada di dalam set");
  assert.ok(set.has(UNIT_VIDEO[0].code));
  assert.equal(set.size, UNIT_VIDEO.length + 1);
});

test("tanpa kompetensi, chosenUnitCodeSet mengembalikan null", async () => {
  const u = await buatUser(prisma);
  assert.equal(await chosenUnitCodeSet(u.id), null);
});
