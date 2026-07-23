import test from "node:test";
import assert from "node:assert/strict";
import { RANKS, rankName, rankLabel, KKNI_FLOOR } from "../rank.js";
import { RANKS as RANKS_KLIEN, rankName as rankNameKlien, KKNI_FLOOR as KKNI_FLOOR_KLIEN,
  rankLabel as rankLabelKlien } from "../../client/src/lib/rank.js";
import { EARNED_FLOOR, MAX_RANK } from "../unitrank.js";
import { RANK_FLOOR } from "../onboarding.js";

// `client/src/lib/rank.js` dan `server/rank.js` adalah dua salinan daftar tier yang sama.
// Selama ini keduanya dijaga sinkron hanya lewat catatan "jaga tetap sinkron" di komentar.
// Tes ini yang menagihnya - kalau salah satu diubah sendirian, di sinilah ketahuannya.

test("daftar tier klien & server identik: jumlah, level, dan nama", () => {
  assert.equal(RANKS.length, RANKS_KLIEN.length, "jumlah tier berbeda");
  for (let i = 0; i < RANKS.length; i++) {
    assert.equal(RANKS[i].level, RANKS_KLIEN[i].level, `level tier ke-${i} berbeda`);
    assert.equal(RANKS[i].name, RANKS_KLIEN[i].name, `nama tier level ${RANKS[i].level} berbeda`);
  }
});

test("rankName memberi nama yang sama di kedua sisi", () => {
  for (const r of RANKS) assert.equal(rankName(r.level), rankNameKlien(r.level));
});

test("tangga mulai KKNI 3 sampai 9, berurutan tanpa lompatan", () => {
  // KKNI 1-2 (SD/SMP) sengaja tidak ada: di bawah usia kerja, dan lantai sistem memang
  // sudah dikunci di 3. Kalau keduanya dikembalikan, pengguna melihat dua tier yang
  // mustahil ditapaki dan mengira dirinya memulai jauh dari bawah.
  assert.deepEqual(RANKS.map((r) => r.level), [3, 4, 5, 6, 7, 8, 9]);
});

test("lantai tangga sama di keempat tempat yang mendefinisikannya", () => {
  // KKNI_FLOOR (tampilan) harus sejalan dengan RANK_FLOOR (seed pendidikan) dan
  // EARNED_FLOOR (tangga unit). Kalau salah satu bergeser sendiri, akan ada rank yang
  // bisa dihitung tapi tak punya nama - atau nama yang tak pernah bisa diraih.
  assert.equal(KKNI_FLOOR, 3);
  assert.equal(KKNI_FLOOR_KLIEN, KKNI_FLOOR, "KKNI_FLOOR klien & server berbeda");
  assert.equal(RANK_FLOOR, KKNI_FLOOR, "RANK_FLOOR (onboarding) tak sejalan");
  assert.equal(EARNED_FLOOR, KKNI_FLOOR, "EARNED_FLOOR (tangga unit) tak sejalan");
  assert.equal(Math.min(...RANKS.map((r) => r.level)), KKNI_FLOOR);
});

test("label rank menyebut jenjang KKNI, bukan nomor urut tier", () => {
  // Permintaan tim: gamifikasinya boleh, tapi sumbernya harus tetap terbaca. "Rank 3"
  // terbaca sebagai tier ketiga; padahal angkanya adalah jenjang KKNI.
  assert.match(rankLabel(3), /KKNI 3/);
  assert.match(rankLabelKlien(3), /KKNI 3/);
  assert.doesNotMatch(rankLabel(6), /Rank 6/);
  assert.doesNotMatch(rankLabelKlien(6), /Rank 6/);
});

test("jenjang di bawah usia kerja tidak punya nama tier", () => {
  for (const l of [1, 2]) {
    assert.equal(rankName(l), "Unranked", `KKNI ${l} seharusnya tak dipakai platform ini`);
  }
});

test("nama tier unik - dua tier bernama sama akan membingungkan di mana pun", () => {
  assert.equal(new Set(RANKS.map((r) => r.name)).size, RANKS.length);
});

test("lantai & plafon tangga rank berada di dalam daftar tier", () => {
  const levels = RANKS.map((r) => r.level);
  assert.ok(levels.includes(EARNED_FLOOR), "EARNED_FLOOR tak ada di daftar tier");
  assert.ok(levels.includes(MAX_RANK), "MAX_RANK tak ada di daftar tier");
  assert.equal(MAX_RANK, Math.max(...levels));
});

test("level di luar rentang tidak melempar, hanya tak dikenali", () => {
  assert.equal(rankName(0), "Unranked");
  assert.equal(rankName(99), "Unranked");
  assert.equal(rankName(null), "Unranked");
  assert.equal(rankLabel(0), "Unranked");
});

test("setiap tier klien punya warna - dipakai emblem & bingkai sertifikat", () => {
  for (const r of RANKS_KLIEN) {
    assert.match(r.color, /^#[0-9a-f]{6}$/i, `warna tier ${r.name} tidak valid`);
  }
});
