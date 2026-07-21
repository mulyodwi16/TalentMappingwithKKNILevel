import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

// Aturan tetap proyek: SETIAP teks yang dilihat pengguna dibungkus t() dan punya entri EN,
// tanpa kunci kembar, dan tanpa em dash. Selama ini itu dijaga lewat ingatan dan pemeriksaan
// manual - sekali terlewat, pengguna EN mendapat kalimat Indonesia diam-diam (t() memang
// sengaja jatuh ke teks aslinya, jadi tak ada error yang muncul). Tes ini yang menjaganya.

const HERE = path.dirname(fileURLToPath(import.meta.url));
const CLIENT = path.resolve(HERE, "../../client/src");
const DICT = path.join(CLIENT, "lib/translations.en.js");

// Ubah literal sumber jadi teks sebenarnya: \" → " dan \\ → \.
const unescapeLiteral = (s) => s.replace(/\\(["\\])/g, "$1");

const dictSrc = fs.readFileSync(DICT, "utf8");
const dictKeys = [...dictSrc.matchAll(/^ {2}"((?:[^"\\]|\\.)*)"\s*:/gm)].map((m) => unescapeLiteral(m[1]));
const dictSet = new Set(dictKeys);

function berkasKlien() {
  const out = [];
  (function walk(dir) {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      const p = path.join(dir, e.name);
      if (e.isDirectory()) walk(p);
      else if (/\.(jsx|js)$/.test(e.name) && p !== DICT) out.push(p);
    }
  })(CLIENT);
  return out;
}

const FILES = berkasKlien();
const rel = (p) => path.relative(CLIENT, p).replace(/\\/g, "/");

test("kamus EN tidak punya kunci kembar", () => {
  // Kunci kembar tidak error - yang terakhir menang DIAM-DIAM, jadi terjemahan yang
  // sebelumnya sengaja ditulis bisa hilang tanpa jejak.
  const seen = new Set(), dup = [];
  for (const k of dictKeys) { if (seen.has(k)) dup.push(k); seen.add(k); }
  assert.deepEqual(dup, [], `kunci kembar: ${dup.join(" | ")}`);
});

test("setiap kunci t(\"...\") punya terjemahan EN", () => {
  const hilang = [];
  for (const f of FILES) {
    const src = fs.readFileSync(f, "utf8");
    for (const m of src.matchAll(/\bt\(\s*"((?:[^"\\]|\\.)*)"/g)) {
      const key = unescapeLiteral(m[1]);
      if (!dictSet.has(key)) hilang.push(`${rel(f)}: ${JSON.stringify(key)}`);
    }
  }
  assert.deepEqual(hilang, [], `kunci tanpa terjemahan:\n  ${hilang.join("\n  ")}`);
});

// Kumpulan teks yang BENAR-BENAR dilihat pengguna: isi t() di komponen + kedua sisi kamus.
// Sengaja tidak menyisir seluruh berkas - komentar kode bukan teks pengguna, dan melarang
// tanda baca di sana hanya menghasilkan tes yang berisik lalu diabaikan orang.
function teksPengguna() {
  const out = [];
  for (const f of FILES) {
    const src = fs.readFileSync(f, "utf8");
    for (const m of src.matchAll(/\bt\(\s*"((?:[^"\\]|\\.)*)"/g)) out.push([rel(f), unescapeLiteral(m[1])]);
  }
  for (const m of dictSrc.matchAll(/^ {2}"((?:[^"\\]|\\.)*)"\s*:\s*"((?:[^"\\]|\\.)*)"/gm)) {
    out.push(["translations.en.js", unescapeLiteral(m[1])], ["translations.en.js", unescapeLiteral(m[2])]);
  }
  return out;
}

test("tidak ada em dash di teks pengguna", () => {
  // Permintaan tetap owner: pakai tanda hubung biasa, bukan em dash.
  const kena = teksPengguna().filter(([, s]) => s.includes("—")).map(([f, s]) => `${f}: ${s.slice(0, 60)}`);
  assert.deepEqual(kena, [], `em dash:\n  ${kena.join("\n  ")}`);
});

test("tidak ada en dash di teks pengguna", () => {
  // En dash sama halusnya dan sama tak konsistennya dengan sisa teks.
  const kena = teksPengguna().filter(([, s]) => s.includes("–")).map(([f, s]) => `${f}: ${s.slice(0, 60)}`);
  assert.deepEqual(kena, [], `en dash:\n  ${kena.join("\n  ")}`);
});

test("kamus punya isi dan bentuknya wajar", () => {
  assert.ok(dictKeys.length > 1000, `kunci kamus cuma ${dictKeys.length} - kemungkinan parser rusak`);
  const kosong = dictKeys.filter((k) => !k.trim());
  assert.deepEqual(kosong, [], "ada kunci kosong di kamus");
});

test("penanda interpolasi kunci & terjemahannya cocok", () => {
  // t("Ada {n} unit", { n }) - kalau terjemahan EN memakai penanda berbeda, teksnya
  // tampil apa adanya sebagai "{count}" di layar pengguna.
  const masalah = [];
  for (const m of dictSrc.matchAll(/^ {2}"((?:[^"\\]|\\.)*)"\s*:\s*"((?:[^"\\]|\\.)*)"/gm)) {
    const id = unescapeLiteral(m[1]), en = unescapeLiteral(m[2]);
    const tanda = (s) => [...s.matchAll(/\{(\w+)\}/g)].map((x) => x[1]).sort();
    const a = tanda(id), b = tanda(en);
    if (a.join(",") !== b.join(",")) masalah.push(`${JSON.stringify(id)} → {${a}} vs {${b}}`);
  }
  assert.deepEqual(masalah, [], `penanda tak cocok:\n  ${masalah.join("\n  ")}`);
});
