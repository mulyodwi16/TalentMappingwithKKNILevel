import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { PLACEMENT_BATCH, PLACEMENT_MAX_UNITS } from "../skkni.js";

// Batas waktu panggilan LLM dulu TETAP 60 detik untuk semua jenis panggilan. Itu cukup untuk
// jawaban percakapan, tapi TIDAK untuk penyusunan soal: satu batch meminta ribuan token, dan
// menulisnya makan lebih dari satu menit. Akibatnya tiap batch diputus tepat sebelum selesai,
// paketnya kosong, dan pengguna melihat "Menyusun soal..." tanpa akhir.
//
// Diuji lewat sumbernya (bukan panggilan sungguhan) karena menembak LLM dari tes berarti biaya
// nyata dan hasil yang tak deterministik.

const here = dirname(fileURLToPath(import.meta.url));
const llm = readFileSync(join(here, "../llm.js"), "utf8");

test("batas waktu LLM menyesuaikan panjang keluaran yang diminta", () => {
  assert.match(llm, /opts\.maxTokens/, "perhitungan batas waktu harus melihat maxTokens");
  assert.doesNotMatch(llm, /opts\.timeoutMs \?\? 60_000/,
    "batas tetap 60 detik memutus penyusunan panjang di tengah jalan");
});

test("permintaan besar mendapat waktu yang masuk akal", () => {
  // Tiru rumusnya: ~1 detik per 40 token + kelonggaran 30 detik, minimal 60 detik.
  const batas = (maxTokens) => Math.max(60_000, Math.ceil(maxTokens / 40) * 1000 + 30_000);

  assert.equal(batas(700), 60_000, "panggilan kecil tetap 60 detik - jangan bikin galat menggantung lama");
  const satuBatch = 900 * PLACEMENT_BATCH + 600;      // maxTokens generatePlacementBatch
  assert.ok(batas(satuBatch) >= satuBatch / 40 * 1000,
    "batas harus melampaui perkiraan waktu menulisnya, kalau tidak selalu diputus di tengah");
});

test("satu batch tak boleh meminta keluaran yang mustahil selesai", () => {
  // Ini penjaga arah: menaikkan PLACEMENT_BATCH memperpanjang tulisan per panggilan, dan
  // itulah yang dulu membuat penyusunan mustahil selesai. Batch kecil + jalan bersamaan.
  const tokenPerBatch = 900 * PLACEMENT_BATCH + 600;
  assert.ok(tokenPerBatch <= 3000,
    `satu panggilan meminta ${tokenPerBatch} token - terlalu panjang, pecah jadi batch lebih kecil`);
  assert.ok(PLACEMENT_BATCH >= 1 && PLACEMENT_BATCH <= PLACEMENT_MAX_UNITS);
});
