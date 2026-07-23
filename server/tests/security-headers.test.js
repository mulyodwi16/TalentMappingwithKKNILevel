import test from "node:test";
import assert from "node:assert/strict";
import { securityHeaders } from "../security.js";

// Bawaan helmet adalah `Referrer-Policy: no-referrer`, dan itu MEMATAHKAN sematan pihak
// ketiga: YouTube memverifikasi domain penyemat lewat header Referer, dan tanpa header itu
// pemutarnya membalas "Error 153 - Video player configuration error". AvatarEdu memakai
// mekanisme serupa.
//
// Bug ini HANYA muncul di domain asli: saat pengembangan, HTML disajikan Vite yang tak
// memasang header ini, sedangkan di produksi HTML keluar dari Express lewat helmet. Karena
// itu tesnya memeriksa header yang BENAR-BENAR dipancarkan, bukan teks di berkas sumber.

function headersOf() {
  const out = {};
  const res = {
    setHeader: (k, v) => { out[k.toLowerCase()] = String(v); },
    removeHeader: (k) => { delete out[k.toLowerCase()]; },
  };
  securityHeaders()({}, res, () => {});
  return out;
}

test("Referer tetap dikirim ke tujuan lintas-origin (sematan YouTube/AvatarEdu)", () => {
  const rp = headersOf()["referrer-policy"];
  assert.ok(rp, "Referrer-Policy harus ditetapkan secara eksplisit, jangan ikut bawaan helmet");
  assert.notEqual(rp, "no-referrer", "no-referrer membuat YouTube membalas Error 153");
  assert.ok(!/^same-origin$/.test(rp), "same-origin juga tak mengirim apa pun ke YouTube");
});

test("alamat halaman penuh tidak ikut bocor ke pihak ketiga", () => {
  // Halaman Kelas beralamat /app/kelas?unit=<kode unit SKKNI>. Kebijakan yang mengirim
  // alamat PENUH akan menyerahkan kode unit yang sedang dipelajari ke YouTube.
  const rp = headersOf()["referrer-policy"];
  assert.ok(
    /strict-origin|origin$|origin-when-cross-origin/.test(rp),
    `"${rp}" mengirim alamat penuh lintas-origin - pakai turunan strict-origin`,
  );
  assert.ok(!/unsafe-url/.test(rp), "unsafe-url mengirim alamat penuh bahkan ke HTTP");
});

test("aplikasi tetap boleh di-embed di situs mitra", () => {
  // frameguard sengaja dimatikan (X-Frame-Options tak bisa mendaftar banyak domain);
  // pembatasnya CSP frame-ancestors di server.js. Kalau helmet menyalakannya lagi,
  // sematan di Canvas/eJourney kolega mati diam-diam.
  const h = headersOf();
  assert.equal(h["x-frame-options"], undefined, "X-Frame-Options menghalangi embed mitra");
  assert.equal(h["cross-origin-resource-policy"], "cross-origin", "aset harus termuat saat di-embed");
});
