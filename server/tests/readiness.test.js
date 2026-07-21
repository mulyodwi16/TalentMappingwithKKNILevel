import test from "node:test";
import assert from "node:assert/strict";
import { readinessFrom, READINESS_WEIGHTS } from "../readiness.js";

// Skor Kesiapan adalah angka yang dibaca HRD untuk memilih orang. Kalau ia bisa dinaikkan
// tanpa bukti yang sepadan, seluruh produk kehilangan alasannya. Tes di bawah mengunci
// aturan yang paling mahal kalau salah.

test("penyebutnya SELURUH unit kompetensi, bukan unit yang kebetulan diuji", () => {
  // Ini bug yang pernah nyata: 1 unit dikerjakan & lulus dari 11 unit → nilai ujian PENUH.
  const r = readinessFrom({ hasCvMeta: true, passed: 1, totalUnits: 11, assessedUnits: 1 });
  assert.equal(r.exam, Math.round(READINESS_WEIGHTS.exam * (1 / 11)));
  assert.ok(r.exam < 10, `nilai ujian harus kecil untuk 1 dari 11 unit, dapat ${r.exam}`);
  assert.notEqual(r.status, "ready");
});

test("lulus seluruh unit memberi nilai ujian penuh", () => {
  const r = readinessFrom({ hasCvMeta: true, passed: 11, totalUnits: 11, assessedUnits: 11 });
  assert.equal(r.exam, READINESS_WEIGHTS.exam);
});

test("tanpa daftar unit, penyebut jatuh ke jumlah unit yang dinilai", () => {
  const r = readinessFrom({ passed: 2, totalUnits: 0, assessedUnits: 4 });
  assert.equal(r.exam, Math.round(READINESS_WEIGHTS.exam * 0.5));
});

test("tanpa unit sama sekali, nilai ujian nol - bukan NaN atau penuh", () => {
  const r = readinessFrom({ hasCvMeta: true, passed: 0, totalUnits: 0, assessedUnits: 0 });
  assert.equal(r.exam, 0);
  assert.equal(r.total, READINESS_WEIGHTS.cv);
});

test("data rusak (lulus melebihi jumlah unit) tidak melewati batas", () => {
  const r = readinessFrom({ passed: 99, totalUnits: 11, assessedUnits: 11 });
  assert.equal(r.exam, READINESS_WEIGHTS.exam);
});

test("CV: penuh bila ada cvMeta, separuh bila hanya pendidikan, nol bila kosong", () => {
  assert.equal(readinessFrom({ hasCvMeta: true }).cv, READINESS_WEIGHTS.cv);
  assert.equal(readinessFrom({ hasEducation: true }).cv, Math.round(READINESS_WEIGHTS.cv * 0.5));
  assert.equal(readinessFrom({}).cv, 0);
});

test("bonus sertifikat & bukti dibatasi, tak bisa ditumpuk tanpa henti", () => {
  assert.equal(readinessFrom({ certCount: 1 }).cert, 5);
  assert.equal(readinessFrom({ certCount: 50, evidenceCount: 50 }).cert, READINESS_WEIGHTS.cert);
});

test("total tak pernah melewati 100 dan ambang status konsisten", () => {
  const penuh = readinessFrom({ hasCvMeta: true, passed: 11, totalUnits: 11, certCount: 9 });
  assert.equal(penuh.total, 100);
  assert.equal(penuh.status, "ready");
  assert.equal(readinessFrom({ hasCvMeta: true, passed: 5, totalUnits: 11 }).status, "in_progress");
  assert.equal(readinessFrom({}).status, "not_ready");
});

test("bobotnya berjumlah 100 - kalau diubah salah satu, tes ini yang menagih", () => {
  const jumlah = READINESS_WEIGHTS.cv + READINESS_WEIGHTS.exam + READINESS_WEIGHTS.cert;
  assert.equal(jumlah, 100);
});
