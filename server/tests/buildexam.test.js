import test from "node:test";
import assert from "node:assert/strict";
import { buildExamQuestions, PLACEMENT_BATCH } from "../skkni.js";

// Penyusun paket soal dipanggil dengan `batchFn` yang bisa disuntik, jadi seluruh perilakunya
// bisa diperiksa TANPA menyalakan LLM: berapa batch dijalankan, apakah bersamaan, apakah unit
// yang gagal dicoba ulang, dan apakah kegagalan satu batch menjatuhkan yang lain.

const tunda = (ms) => new Promise((r) => setTimeout(r, ms));
const unitDummy = (n) => Array.from({ length: n }, (_, i) => ({ code: `U.${i + 1}`, title: `Unit ${i + 1}` }));
const soalUntuk = (chunk) => chunk.map((u) => ({ unitCode: u.code, type: "mc", q: `soal ${u.code}` }));

test("batch dijalankan BERSAMAAN, bukan berurutan", async () => {
  // Inti keluhannya: 12 unit = 3 batch berurutan @ ~40 dtk = ~2 menit. Bersamaan, waktunya
  // tinggal selama satu batch. Diukur lewat berapa banyak batch yang hidup pada saat yang sama.
  const units = unitDummy(PLACEMENT_BATCH * 3);
  let hidup = 0, puncak = 0;

  const batchFn = async (_judul, chunk) => {
    puncak = Math.max(puncak, ++hidup);
    await tunda(40);
    hidup--;
    return soalUntuk(chunk);
  };

  const mulai = Date.now();
  const q = await buildExamQuestions("Kompetensi Uji", units, batchFn, "uji");
  const durasi = Date.now() - mulai;

  assert.equal(puncak, 3, "ketiga batch harus jalan bersamaan");
  assert.ok(durasi < 100, `harusnya selama satu batch (~40ms), bukan tiga (~120ms); dapat ${durasi}ms`);
  assert.equal(q.length, units.length, "semua unit tetap kebagian soal");
});

test("satu batch gagal tidak menjatuhkan batch lain", async () => {
  const units = unitDummy(PLACEMENT_BATCH * 3);
  let panggil = 0;
  const batchFn = async (_judul, chunk) => {
    // Batch pertama selalu gagal, termasuk saat dicoba ulang.
    if (++panggil === 1) throw new Error("LLM tumbang");
    return soalUntuk(chunk);
  };

  const q = await buildExamQuestions("Kompetensi Uji", units, batchFn, "uji");
  const tercakup = new Set(q.map((x) => x.unitCode));
  assert.ok(q.length > 0, "batch yang berhasil harus tetap masuk paket");
  assert.ok(tercakup.size >= PLACEMENT_BATCH * 2, "dua batch yang sehat harus utuh");
});

test("unit yang belum kebagian soal DICOBA ULANG sekali", async () => {
  // Kegagalan di sini senyap dan hasilnya tersimpan PERMANEN, jadi percobaan ulangnya
  // yang menjaga paket tidak bolong. Jangan dihapus.
  const units = unitDummy(PLACEMENT_BATCH * 2);
  let panggil = 0;
  const batchFn = async (_judul, chunk) => {
    if (++panggil === 1) throw new Error("gagal sekali");   // ulangannya berhasil
    return soalUntuk(chunk);
  };

  const q = await buildExamQuestions("Kompetensi Uji", units, batchFn, "uji");
  const tercakup = new Set(q.map((x) => x.unitCode));
  assert.equal(tercakup.size, units.length, "percobaan ulang harus menutup unit yang bolong");
});

test("kemajuan dilaporkan per batch yang selesai", async () => {
  const units = unitDummy(PLACEMENT_BATCH * 3);
  const laporan = [];
  await buildExamQuestions("Kompetensi Uji", units, async (_j, c) => soalUntuk(c), "uji",
    (p) => laporan.push(p));

  assert.deepEqual(laporan[0], { done: 0, total: 3 }, "harus melapor total sejak awal");
  assert.deepEqual(laporan[laporan.length - 1], { done: 3, total: 3 }, "harus berakhir penuh");
  const naik = laporan.every((p, i) => i === 0 || p.done >= laporan[i - 1].done);
  assert.ok(naik, "angka kemajuan tak boleh mundur");
});
