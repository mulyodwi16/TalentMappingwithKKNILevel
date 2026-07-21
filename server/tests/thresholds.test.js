import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { UNIT_MASTERY, FINAL_PASS_SCORE, PLAN_MASTERY } from "../thresholds.js";

const SERVER = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

test("hubungan antar ambang tetap masuk akal", () => {
  // Kalau urutannya terbalik, artinya lulus ujian sertifikasi bisa lebih mudah daripada
  // menguasai satu unit - atau langkah Learning Path selesai sebelum unitnya dikuasai.
  assert.ok(UNIT_MASTERY < FINAL_PASS_SCORE, "ujian sertifikasi harus lebih berat dari unit");
  assert.ok(FINAL_PASS_SCORE <= PLAN_MASTERY, "target Learning Path tak boleh di bawah ambang sertifikasi");
  for (const v of [UNIT_MASTERY, FINAL_PASS_SCORE, PLAN_MASTERY]) {
    assert.ok(v > 0 && v <= 100, `ambang ${v} di luar rentang nilai`);
  }
});

test("nilainya sesuai keputusan yang tercatat", () => {
  // Bukan sekadar mengulang kode: ketiganya keputusan produk yang dijelaskan di
  // thresholds.js. Kalau diubah, ubah juga penjelasannya di UI & KB mentor.
  assert.equal(UNIT_MASTERY, 60);
  assert.equal(FINAL_PASS_SCORE, 70);
  assert.equal(PLAN_MASTERY, 80);
});

// Kumpulkan berkas server (tanpa node_modules, tes, seed, dan thresholds.js sendiri).
function berkasServer() {
  const out = [];
  (function walk(dir) {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      if (["node_modules", "tests", "prisma", "backup", "seed"].includes(e.name)) continue;
      const p = path.join(dir, e.name);
      if (e.isDirectory()) walk(p);
      else if (e.name.endsWith(".js") && e.name !== "thresholds.js") out.push(p);
    }
  })(SERVER);
  return out;
}

test("ambang penguasaan tidak ditulis ulang sebagai angka di tempat lain", () => {
  // Ini penjaga yang sebenarnya. Angka 60 dulu tersebar di belasan berkas; selama semuanya
  // kebetulan sama tak ada yang sadar, dan begitu satu diubah, dua layar melaporkan hal
  // berbeda tentang orang yang sama. Kalau tes ini jatuh: impor UNIT_MASTERY, jangan tulis 60.
  // Menyisir dua bentuk: `score >= 60` dan `(… ?? 0) >= 60`. Kalau ambangnya memang konsep
  // LAIN yang kebetulan bernilai sama, beri nama sendiri (lihat ANSWER_OK_SCORE di
  // routes/skkni.js) - jangan tulis angkanya telanjang.
  const pola = /(?:\b(?:currentScore|score|nilai)\b|\))\s*>=?\s*(?:60|70|80)\b/;
  const kena = [];
  for (const f of berkasServer()) {
    const baris = fs.readFileSync(f, "utf8").split("\n");
    baris.forEach((l, i) => {
      if (pola.test(l)) kena.push(`${path.relative(SERVER, f).replace(/\\/g, "/")}:${i + 1} → ${l.trim().slice(0, 80)}`);
    });
  }
  assert.deepEqual(kena, [], `ambang ditulis sebagai angka:\n  ${kena.join("\n  ")}`);
});

test("thresholds.js menjelaskan kenapa ketiganya berbeda", () => {
  // Konstanta tanpa alasan akan disatukan orang berikutnya karena tampak duplikat.
  const src = fs.readFileSync(path.join(SERVER, "thresholds.js"), "utf8");
  for (const nama of ["UNIT_MASTERY", "FINAL_PASS_SCORE", "PLAN_MASTERY"]) {
    assert.ok(src.includes(nama), `${nama} hilang dari thresholds.js`);
  }
  assert.ok(src.length > 800, "penjelasannya terlalu pendek - tulis alasannya, bukan cuma angkanya");
});
