import test from "node:test";
import assert from "node:assert/strict";
import { pickPlacementUnits, PLACEMENT_MAX_UNITS, PLACEMENT_MINUTES_PER_UNIT, PLACEMENT_FREE_ATTEMPTS, placementGate } from "../skkni.js";

// Tes Penempatan dibatasi supaya tetap manusiawi. Yang dijaga: batasnya benar-benar
// mengikat, unit yang dipilih MENYEBAR ke seluruh tier (bukan 12 pertama), dan angka yang
// dipakai intro (jumlah + waktu) cocok dengan tes yang benar-benar muncul - dulu intro
// bilang 79 unit / 237 menit padahal tesnya 12 unit.

const buatUnit = (n) => Array.from({ length: n }, (_, i) => ({
  code: `U.${String(i + 1).padStart(2, "0")}`,
  title: `Unit ke-${i + 1}`,
}));

test("kompetensi kecil dites seluruhnya, tanpa dipangkas", () => {
  const units = buatUnit(8);
  assert.equal(pickPlacementUnits(units, 9).length, 8);
});

test("kompetensi besar dipangkas ke batas maksimal", () => {
  const dipilih = pickPlacementUnits(buatUnit(79), 9);
  assert.equal(dipilih.length, PLACEMENT_MAX_UNITS);
});

test("tepat di batas tidak dipangkas", () => {
  assert.equal(pickPlacementUnits(buatUnit(PLACEMENT_MAX_UNITS), 9).length, PLACEMENT_MAX_UNITS);
});

test("unit yang dipilih menyebar ke seluruh rentang, bukan hanya awal", () => {
  // Kalau hanya mengambil 12 pertama, baseline berat sebelah ke unit dasar. Ambil kode
  // terbesar yang terpilih - kalau menyebar, ia harus jauh melewati indeks ke-12.
  const dipilih = pickPlacementUnits(buatUnit(79), 9);
  const nomor = dipilih.map((u) => Number(u.code.split(".")[1]));
  assert.ok(Math.max(...nomor) > PLACEMENT_MAX_UNITS, "pilihan harus menyebar, bukan 12 unit pertama");
});

test("tidak ada unit yang terpilih dua kali", () => {
  const dipilih = pickPlacementUnits(buatUnit(79), 9);
  assert.equal(new Set(dipilih.map((u) => u.code)).size, dipilih.length);
});

test("unit tanpa kode diabaikan", () => {
  const units = [...buatUnit(3), { title: "tanpa kode" }, null];
  const dipilih = pickPlacementUnits(units, 9);
  assert.ok(dipilih.every((u) => u.code));
});

test("waktu efektif memakai jumlah yang benar-benar diuji, bukan total unit", () => {
  // Ini inti keluhan owner: 79 x 3 = 237 menit di intro, padahal tes hanya 12 unit.
  const total = 79;
  const efektif = Math.min(total, PLACEMENT_MAX_UNITS);
  assert.equal(efektif * PLACEMENT_MINUTES_PER_UNIT, 36);
  assert.notEqual(total * PLACEMENT_MINUTES_PER_UNIT, efektif * PLACEMENT_MINUTES_PER_UNIT);
});

test("daftar kosong tidak melempar", () => {
  assert.deepEqual(pickPlacementUnits([], 9), []);
  assert.deepEqual(pickPlacementUnits(null, 9), []);
});

// ── Jatah mengambil tes penempatan (anti-hafal baseline) ─────────────────────

test("dua kesempatan gratis: baseline + satu kali ulang", () => {
  assert.equal(PLACEMENT_FREE_ATTEMPTS, 2);
  assert.equal(placementGate({ used: 0 }).canStart, true);   // pertama
  assert.equal(placementGate({ used: 1 }).canStart, true);   // ulang gratis
  assert.equal(placementGate({ used: 2 }).canStart, false);  // habis
  assert.equal(placementGate({ used: 2 }).locked, true);
});

test("sisa kesempatan dihitung benar", () => {
  assert.equal(placementGate({ used: 0 }).remaining, 2);
  assert.equal(placementGate({ used: 1 }).remaining, 1);
  assert.equal(placementGate({ used: 2 }).remaining, 0);
});

test("membeli kesempatan menambah jatah, bukan mereset pemakaian", () => {
  // Sudah pakai 2 (terkunci), beli 1 → boleh mulai sekali lagi, lalu terkunci lagi.
  assert.equal(placementGate({ used: 2, bonus: 0 }).canStart, false);
  assert.equal(placementGate({ used: 2, bonus: 1 }).canStart, true);
  assert.equal(placementGate({ used: 2, bonus: 1 }).remaining, 1);
  assert.equal(placementGate({ used: 3, bonus: 1 }).canStart, false);
});

test("beli beberapa kali menumpuk kesempatan", () => {
  assert.equal(placementGate({ used: 2, bonus: 3 }).remaining, 3);
});

test("bonus negatif diabaikan, tak menambah maupun mengurangi di bawah nol", () => {
  const g = placementGate({ used: 0, bonus: -5 });
  assert.equal(g.allowed, PLACEMENT_FREE_ATTEMPTS);
  assert.ok(g.remaining >= 0);
});

test("pemakaian melebihi jatah tetap terkunci, sisa tak pernah negatif", () => {
  const g = placementGate({ used: 99, bonus: 1 });
  assert.equal(g.remaining, 0);
  assert.equal(g.locked, true);
});
