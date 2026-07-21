import test, { before, after } from "node:test";
import assert from "node:assert/strict";
import { siapkanDb, buatUser, buatKompetensi, beriNilai, UNIT_VIDEO } from "./helpers/db.js";

// computeRank menyentuh 6 tabel sekaligus. Yang diuji di sini bukan rumus tangganya
// (itu di unitrank.test.js) melainkan PERAKITANNYA: apakah data yang benar yang diambil,
// apakah pembatasan per kompetensi bekerja, dan apakah bukti eksternal punya batas.

let prisma, computeRank, refreshRank;

before(async () => {
  ({ prisma } = await siapkanDb("rankcalc"));
  ({ computeRank, refreshRank } = await import("../rankcalc.js"));
});
after(async () => { await prisma.$disconnect(); });

// Susun satu talenta lengkap dengan kompetensi + nilai unit.
async function talenta({ lulus = [], cap = 9, docId = null } = {}) {
  const u = await buatUser(prisma);
  const doc = await buatKompetensi(prisma, { id: docId, units: UNIT_VIDEO, weightMaxRank: cap });
  await prisma.user.update({ where: { id: u.id }, data: { chosenSkkniId: doc, chosenSkkniTitle: "Video Editing" } });
  for (const c of lulus) await beriNilai(prisma, u.id, c, 100);
  return { user: u, doc };
}

test("tanpa kompetensi, rank jatuh ke seed pendidikan", async () => {
  const u = await buatUser(prisma);
  const r = await computeRank(u.id);
  assert.equal(r.earned, 0, "belum ada bukti kompetensi");
  assert.equal(r.effective, 3, "lantai Gold");
});

test("menguasai seluruh unit meraih rank sampai batas bobot", async () => {
  const { user } = await talenta({ lulus: UNIT_VIDEO.map((u) => u.code), cap: 6 });
  const r = await computeRank(user.id);
  assert.equal(r.earned, 6);
  assert.equal(r.effective, 6);
  assert.equal(r.passedUnits, 11);
  assert.equal(r.weightCap, 6);
  assert.equal(r.cappedByWeight, true, "harus ditandai sudah mentok bobot");
});

test("bobot kompetensi membatasi rank walau semua unit dikuasai", async () => {
  const { user } = await talenta({ lulus: UNIT_VIDEO.map((u) => u.code), cap: 5 });
  const r = await computeRank(user.id);
  assert.equal(r.earned, 5, "kompetensi ber-cap Emerald tak boleh menghasilkan Diamond");
  assert.ok(r.ladder.every((s) => s.level <= 5));
});

test("nilai di bawah ambang tidak dihitung sebagai unit dikuasai", async () => {
  const u = await buatUser(prisma);
  const doc = await buatKompetensi(prisma, { units: UNIT_VIDEO });
  await prisma.user.update({ where: { id: u.id }, data: { chosenSkkniId: doc } });
  for (const unit of UNIT_VIDEO) await beriNilai(prisma, u.id, unit.code, 59);
  const r = await computeRank(u.id);
  assert.equal(r.passedUnits, 0, "59 belum dikuasai");
  assert.equal(r.earned, 0);
});

test("nilai dari kompetensi LAIN tidak ikut menaikkan rank", async () => {
  // Ini bug yang pernah nyata di sisi HRD: nilai milik kompetensi lain terbaca sebagai
  // bukti. Rank harus di-scope ke kompetensi yang SEDANG dipilih.
  const u = await buatUser(prisma);
  const doc = await buatKompetensi(prisma, { units: UNIT_VIDEO });
  await prisma.user.update({ where: { id: u.id }, data: { chosenSkkniId: doc } });
  for (const kode of ["LAIN.01", "LAIN.02", "LAIN.03"]) await beriNilai(prisma, u.id, kode, 100);
  const r = await computeRank(u.id);
  assert.equal(r.passedUnits, 0);
  assert.equal(r.earned, 0);
});

test("ganti kompetensi: progres lama tersimpan dan pulih saat kembali", async () => {
  const u = await buatUser(prisma);
  const docA = await buatKompetensi(prisma, { units: UNIT_VIDEO, weightMaxRank: 6 });
  const docB = await buatKompetensi(prisma, { units: [{ code: "B.01", title: "Unit lain" }] });
  await prisma.user.update({ where: { id: u.id }, data: { chosenSkkniId: docA } });
  for (const unit of UNIT_VIDEO) await beriNilai(prisma, u.id, unit.code, 100);
  assert.equal((await computeRank(u.id)).earned, 6);

  await prisma.user.update({ where: { id: u.id }, data: { chosenSkkniId: docB } });
  assert.equal((await computeRank(u.id)).earned, 0, "kompetensi baru mulai dari nol");

  await prisma.user.update({ where: { id: u.id }, data: { chosenSkkniId: docA } });
  assert.equal((await computeRank(u.id)).earned, 6, "progres lama harus pulih, bukan hilang");
});

test("sertifikat kompetensi (berkode docId) ikut terhitung", async () => {
  // Bug diam yang pernah terjadi: sertifikat memakai docId sebagai kode, sedangkan
  // penyaringnya hanya berisi kode unit - sertifikat sah bernilai nol di mana-mana.
  const { user, doc } = await talenta({ lulus: [] });
  await prisma.certificate.create({
    data: { userId: user.id, competencyCode: doc, name: "Video Editing", kkniLevel: 6, score: 80, source: "competency" },
  });
  const r = await computeRank(user.id);
  assert.equal(r.certs, 1, "sertifikat kompetensi harus terhitung");
});

test("bukti eksternal hanya boleh menembus 2 tingkat di atas rank ujian", async () => {
  const { user } = await talenta({ lulus: UNIT_VIDEO.slice(0, 3).map((u) => u.code), cap: 6 });
  await prisma.externalEvidence.create({
    data: { userId: user.id, type: "cert", title: "Sertifikasi BNSP", status: "verified", rankImplied: 9 },
  });
  const r = await computeRank(user.id);
  assert.ok(r.effective <= r.cappedEarned + 2, `bukti melompat terlalu jauh: ${r.cappedEarned} → ${r.effective}`);
});

test("bukti eksternal yang BELUM terverifikasi tidak berpengaruh", async () => {
  const { user } = await talenta({ lulus: [] });
  await prisma.externalEvidence.create({
    data: { userId: user.id, type: "cert", title: "Klaim", status: "pending", rankImplied: 9 },
  });
  const r = await computeRank(user.id);
  assert.equal(r.evidenceCount, 0);
  assert.equal(r.boostedByEvidence, false);
});

test("tangga rank menyebut unit apa yang kurang untuk naik", async () => {
  const { user } = await talenta({ lulus: [], cap: 6 });
  const r = await computeRank(user.id);
  assert.ok(r.next, "harus ada tier berikutnya");
  assert.ok(r.next.need > 0);
  assert.ok(r.next.units.length > 0, "syaratnya harus bisa ditunjuk, bukan sekadar angka");
  assert.ok(r.next.units.every((u) => u.code && u.title));
});

test("refreshRank menyimpan hasilnya ke pengguna", async () => {
  const { user } = await talenta({ lulus: UNIT_VIDEO.map((u) => u.code), cap: 6 });
  await refreshRank(user.id);
  const after = await prisma.user.findUnique({ where: { id: user.id } });
  assert.equal(after.currentKkniLevel, 6);
});

test("pengguna tanpa unit ter-cache tidak membuat computeRank melempar", async () => {
  const u = await buatUser(prisma);
  const doc = await buatKompetensi(prisma, { units: [] });
  await prisma.user.update({ where: { id: u.id }, data: { chosenSkkniId: doc } });
  const r = await computeRank(u.id);
  assert.equal(r.earned, 0);
  assert.ok(Array.isArray(r.ladder));
});
