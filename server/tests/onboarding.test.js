import test from "node:test";
import assert from "node:assert/strict";
import { ACADEMIC_STATUS, educationSeed, clampRank, statusInfo, RANK_FLOOR, SEED_CAP } from "../onboarding.js";
import { ACADEMIC_STATUS as STATUS_KLIEN } from "../../client/src/lib/academic.js";

// Filosofi inti produk: rank berasal dari KOMPETENSI yang dibuktikan, bukan ijazah.
// Kalau pendidikan bisa mengangkat rank tinggi, seluruh janji "SMK terampil bisa menyalip
// S3" batal. Tes ini yang menjaga batas itu.

test("pendidikan tak pernah memberi rank di atas batas seed", () => {
  for (const [key, s] of Object.entries(ACADEMIC_STATUS)) {
    assert.ok(s.seed <= SEED_CAP, `${key} memberi seed ${s.seed}, melebihi batas ${SEED_CAP}`);
    assert.ok(s.seed >= RANK_FLOOR, `${key} memberi seed di bawah lantai`);
  }
});

test("S3 tidak lebih tinggi dari SMK lebih dari satu tingkat", () => {
  // Bukan menyamakan, tapi memastikan jaraknya tetap kecil - selebihnya harus diraih.
  const jarak = ACADEMIC_STATUS.lulusan_s3.seed - ACADEMIC_STATUS.siswa_smk.seed;
  assert.ok(jarak <= 1, `jarak seed S3 vs SMK ${jarak} - ijazah jadi terlalu menentukan`);
});

test("tanpa CV, rank awal jatuh ke lantai", () => {
  assert.equal(educationSeed(null), RANK_FLOOR);
  assert.equal(educationSeed({}), RANK_FLOOR);
  assert.equal(educationSeed({ cvMeta: "{}" }), RANK_FLOOR);
});

test("perkiraan rank dari CV dibatasi SEED_CAP", () => {
  assert.equal(educationSeed({ cvMeta: JSON.stringify({ predictedLevel: 9 }) }), SEED_CAP);
  assert.equal(educationSeed({ cvMeta: JSON.stringify({ predictedLevel: 4 }) }), 4);
});

test("perkiraan rendah dari CV tetap diangkat ke lantai", () => {
  assert.equal(educationSeed({ cvMeta: JSON.stringify({ predictedLevel: 1 }) }), RANK_FLOOR);
});

test("cvMeta rusak tidak melempar, hanya jatuh ke lantai", () => {
  assert.equal(educationSeed({ cvMeta: "{bukan json" }), RANK_FLOOR);
  assert.equal(educationSeed({ cvMeta: JSON.stringify({ predictedLevel: "abc" }) }), RANK_FLOOR);
});

test("cvMeta boleh berupa objek maupun string", () => {
  assert.equal(educationSeed({ cvMeta: { predictedLevel: 4 } }), 4);
  assert.equal(educationSeed({ cvMeta: JSON.stringify({ predictedLevel: 4 }) }), 4);
});

test("clampRank menjaga rentang Gold..Legend", () => {
  assert.equal(clampRank(0), RANK_FLOOR);
  assert.equal(clampRank(-5), RANK_FLOOR);
  assert.equal(clampRank(99), 9);
  assert.equal(clampRank(6), 6);
  assert.equal(clampRank(null), RANK_FLOOR);
  assert.equal(clampRank("bukan angka"), RANK_FLOOR);
});

test("statusInfo mengembalikan null untuk kunci tak dikenal", () => {
  assert.equal(statusInfo("tidak-ada"), null);
  assert.ok(statusInfo("lulusan_s1"));
});

test("pilihan status klien & server sama: kunci dan label", () => {
  // Dua daftar terpisah di dua berkas. Kalau labelnya beda seujung tanda hubung saja,
  // kunci kamus EN tak ketemu dan pengguna EN melihat teks Indonesia diam-diam.
  const kunciServer = Object.keys(ACADEMIC_STATUS).sort();
  const kunciKlien = STATUS_KLIEN.map((s) => s.key).sort();
  assert.deepEqual(kunciKlien, kunciServer, "daftar status berbeda antara klien & server");
  for (const s of STATUS_KLIEN) {
    assert.equal(s.label, ACADEMIC_STATUS[s.key].label, `label "${s.key}" berbeda antara klien & server`);
  }
});

test("tiap pilihan status di klien punya keterangan", () => {
  for (const s of STATUS_KLIEN) {
    assert.ok(s.desc?.trim(), `status ${s.key} tanpa keterangan`);
  }
});
