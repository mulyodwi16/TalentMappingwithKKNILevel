import test from "node:test";
import assert from "node:assert/strict";
import {
  classifyUnit, buildRankLadder, evaluateLadder,
  EARNED_FLOOR, MAX_RANK, TIER_TOLERANCE,
} from "../unitrank.js";

const unit = (code, title) => ({ code, title });

// 11 unit ala kompetensi Video Editing - dipakai berulang di bawah.
const UNIT_VIDEO = [
  unit("V.01", "Menerapkan prosedur K3 di area kerja"),
  unit("V.02", "Menjaga keamanan data produksi"),
  unit("V.03", "Mempersiapkan bahan editing"),
  unit("V.04", "Mencatat log produksi"),
  unit("V.05", "Melakukan instalasi perangkat lunak editing"),
  unit("V.06", "Menyunting audio dan atau video sesuai tuntutan naskah"),
  unit("V.07", "Melakukan penambahan efek visual"),
  unit("V.08", "Melakukan export hasil editing"),
  unit("V.09", "Menerapkan prosedur kendali mutu hasil editing"),
  unit("V.10", "Melakukan komunikasi di tempat kerja"),
  unit("V.11", "Membangun kerjasama dengan klien"),
];

test("klasifikasi memakai kata utuh, bukan potongan kata", () => {
  // "pekerjaan" mengandung "kerja"; kalau dicocokkan sebagai substring, unit teknikal
  // akan salah masuk kategori lanjutan.
  assert.equal(classifyUnit(unit("x", "Melaksanakan pekerjaan pemotongan bahan")), "teknikal");
  assert.equal(classifyUnit(unit("x", "Melakukan kerjasama dengan klien")), "lanjutan");
});

test("softskill & mutu diperiksa lebih dulu daripada kata dasar", () => {
  // Unit ini mengandung "prosedur" (dasar) sekaligus "mutu" (lanjutan). Tanggung jawab
  // mutunya yang membuatnya layak di rank atas.
  assert.equal(classifyUnit(unit("x", "Menerapkan prosedur kendali mutu")), "lanjutan");
});

test("tangga rank deterministik - susunan sama untuk masukan sama", () => {
  const a = buildRankLadder(UNIT_VIDEO, 6);
  const b = buildRankLadder([...UNIT_VIDEO].reverse(), 6);
  assert.deepEqual(
    a.map((s) => [s.level, s.units.map((u) => u.code)]),
    b.map((s) => [s.level, s.units.map((u) => u.code)]),
    "urutan masukan tidak boleh mengubah tangga seseorang",
  );
});

test("tangga berhenti di cap bobot kompetensi", () => {
  const l = buildRankLadder(UNIT_VIDEO, 6);
  assert.equal(l[0].level, EARNED_FLOOR);
  assert.equal(l[l.length - 1].level, 6, "kompetensi ber-cap Diamond tak boleh punya tier di atasnya");
});

test("semua unit terbagi habis, tak ada yang hilang atau dobel", () => {
  const l = buildRankLadder(UNIT_VIDEO, 9);
  const semua = l.flatMap((s) => s.units.map((u) => u.code));
  assert.equal(semua.length, UNIT_VIDEO.length);
  assert.equal(new Set(semua).size, UNIT_VIDEO.length);
});

test("unit dasar ada di tier bawah, softskill di tier atas", () => {
  const l = buildRankLadder(UNIT_VIDEO, 6);
  const tierDari = (code) => l.find((s) => s.units.some((u) => u.code === code))?.level;
  assert.ok(tierDari("V.01") < tierDari("V.11"), "K3 harus di bawah kerjasama klien");
});

test("cap di bawah lantai tetap menghasilkan minimal satu tier", () => {
  const l = buildRankLadder(UNIT_VIDEO, 1);
  assert.equal(l.length, 1);
  assert.equal(l[0].level, EARNED_FLOOR);
});

test("cap di atas batas tertinggi dipangkas ke Legend", () => {
  const l = buildRankLadder(UNIT_VIDEO, 99);
  assert.equal(l[l.length - 1].level, MAX_RANK);
});

test("tanpa unit, tangga kosong dan tak melempar", () => {
  assert.deepEqual(buildRankLadder([], 6).map((s) => s.units.length), [0, 0, 0, 0]);
  assert.deepEqual(buildRankLadder(null, 6).length, 4);
});

test("unit tanpa kode diabaikan, bukan bikin tangga rusak", () => {
  const l = buildRankLadder([unit("A.1", "Satu"), { title: "tanpa kode" }, null], 6);
  assert.equal(l.flatMap((s) => s.units).length, 1);
});

test("belum menguasai apa pun berarti belum meraih tier", () => {
  const l = buildRankLadder(UNIT_VIDEO, 6);
  const r = evaluateLadder(l, new Set());
  assert.equal(r.earned, 0);
  assert.equal(r.next.level, EARNED_FLOOR);
});

test("menguasai semua unit meraih tier tertinggi yang tersedia", () => {
  const l = buildRankLadder(UNIT_VIDEO, 6);
  const r = evaluateLadder(l, new Set(UNIT_VIDEO.map((u) => u.code)));
  assert.equal(r.earned, 6);
  assert.equal(r.next, null);
});

test("melompati tier tengah TIDAK dihargai", () => {
  // Kasus nyata (dewi): tier atas tuntas tapi tier tengah bolong. Ambangnya kumulatif,
  // jadi memetik hanya unit tier atas tidak menaikkan rank.
  const l = buildRankLadder(UNIT_VIDEO, 6);
  const tierAtas = l[l.length - 1].units.map((u) => u.code);
  const r = evaluateLadder(l, new Set(tierAtas));
  assert.ok(r.earned < 6, `harusnya belum meraih tier puncak, dapat ${r.earned}`);
});

test("ambang kumulatif memberi toleransi satu unit yang tertinggal", () => {
  // Ini alasan toleransinya dibuat kumulatif, bukan per tier: ember tier hanya berisi
  // 2-3 unit, sehingga ambang per tier membulat jadi "semua unit wajib".
  const l = buildRankLadder(UNIT_VIDEO, 6);
  const semua = UNIT_VIDEO.map((u) => u.code);
  const kurangSatu = new Set(semua.slice(0, semua.length - 1)); // 10/11 = 91% >= 80%
  const r = evaluateLadder(l, kurangSatu);
  assert.equal(r.earned, 6, "10 dari 11 unit harus tetap meraih tier puncak");
});

test("toleransi tidak boleh dilonggarkan diam-diam", () => {
  assert.equal(TIER_TOLERANCE, 0.8);
});

test("`need` menyebut berapa unit lagi, dan habis saat tier tercapai", () => {
  const l = buildRankLadder(UNIT_VIDEO, 6);
  const kosong = evaluateLadder(l, new Set());
  assert.ok(kosong.next.need > 0);
  const penuh = evaluateLadder(l, new Set(UNIT_VIDEO.map((u) => u.code)));
  assert.ok(penuh.steps.every((s) => s.need === 0));
});

test("evaluateLadder menerima array maupun Set", () => {
  const l = buildRankLadder(UNIT_VIDEO, 6);
  const kode = UNIT_VIDEO.map((u) => u.code);
  assert.equal(evaluateLadder(l, kode).earned, evaluateLadder(l, new Set(kode)).earned);
});

test("penguasaan tak pernah turun saat unit ditambahkan", () => {
  // Sifat monoton: menguasai lebih banyak unit tak boleh MENURUNKAN rank.
  const l = buildRankLadder(UNIT_VIDEO, 6);
  const kode = UNIT_VIDEO.map((u) => u.code);
  let sebelum = 0;
  for (let i = 0; i <= kode.length; i++) {
    const r = evaluateLadder(l, new Set(kode.slice(0, i)));
    assert.ok(r.earned >= sebelum, `rank turun di ${i} unit: ${sebelum} → ${r.earned}`);
    sebelum = r.earned;
  }
});
