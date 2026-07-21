import test from "node:test";
import assert from "node:assert/strict";
import { RANKS, rankName, rankLabel } from "../rank.js";
import { RANKS as RANKS_KLIEN, rankName as rankNameKlien } from "../../client/src/lib/rank.js";
import { EARNED_FLOOR, MAX_RANK } from "../unitrank.js";

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

test("level 1..9 berurutan tanpa lompatan", () => {
  assert.deepEqual(RANKS.map((r) => r.level), [1, 2, 3, 4, 5, 6, 7, 8, 9]);
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
