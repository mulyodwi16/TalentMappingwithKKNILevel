import test, { before, after } from "node:test";
import assert from "node:assert/strict";
import { siapkanDb, buatUser, buatKompetensi, UNIT_VIDEO } from "./helpers/db.js";
import { jalankanApp, tokenUntuk } from "./helpers/app.js";

// Dokumen SKKNI yang sudah DICABUT ("cancelled") pernah lolos ke picker kompetensi.
// Unit-unitnya ikut berstatus cancelled, sedangkan SELURUH fitur hilir (Kelas, Latihan Unit,
// tes penempatan, ujian utama, tangga rank) hanya membaca unit "applied" - jadi kompetensi
// itu tampak sah, layar penyiapan menyatakannya siap dengan 46 unit, lalu setiap halaman
// tampil kosong dan rank tak pernah bisa naik. Dua penjaga di sini: dokumen dicabut tak boleh
// bisa dipilih, dan hitungan "siap" harus memakai unit yang benar-benar terpakai.

let prisma, app, talenta, skkni;

before(async () => {
  ({ prisma } = await siapkanDb("skkni-selectable"));
  skkni = await import("../skkni.js");
  const { default: skkniRouter } = await import("../routes/skkni.js");
  app = await jalankanApp({ "/api/skkni": skkniRouter });
  talenta = await buatUser(prisma, { role: "user" });
});
after(async () => { await app.tutup(); await prisma.$disconnect(); });

test("dokumen SKKNI yang dicabut TIDAK muncul di picker kompetensi", async () => {
  const aktif = await buatKompetensi(prisma, { title: "SKKNI Video Editing", units: UNIT_VIDEO });
  const dicabut = await buatKompetensi(prisma, {
    title: "SKKNI Administrasi Perkantoran", units: UNIT_VIDEO, availability: "cancelled",
  });

  const { items } = await skkni.searchLocal("", "all", 100, 0);
  const ids = items.map((i) => i.id);
  assert.ok(ids.includes(aktif), "kompetensi berlaku harus tetap bisa dipilih");
  assert.ok(!ids.includes(dicabut), "kompetensi yang dicabut tak boleh bisa dipilih - unitnya nol bagi semua fitur");
});

test("pencarian bernama juga menyaring dokumen yang dicabut", async () => {
  await buatKompetensi(prisma, { title: "SKKNI Tata Boga Lama", units: UNIT_VIDEO, availability: "cancelled" });
  const { items, total } = await skkni.searchLocal("Tata Boga Lama", "all", 100, 0);
  assert.equal(total, 0, "hasil pencarian tak boleh memunculkan standar yang sudah dicabut");
  assert.equal(items.length, 0);
});

test("usableUnitCount hanya menghitung unit yang berlaku", async () => {
  const campur = await buatKompetensi(prisma, {
    title: "SKKNI Campuran",
    units: [
      { code: "C.01", title: "Menerapkan prosedur K3" },
      { code: "C.02", title: "Menyunting berkas", availability: "cancelled" },
      { code: "C.03", title: "Melakukan komunikasi", availability: "cancelled" },
    ],
  });
  assert.equal(await skkni.usableUnitCount(campur), 1, "hanya unit applied yang boleh dihitung");
});

test("layar penyiapan menyebut kompetensi dicabut sebagai KOSONG, bukan siap", async () => {
  const dicabut = await buatKompetensi(prisma, {
    title: "SKKNI Kearsipan Lama", units: UNIT_VIDEO, availability: "cancelled",
  });
  const r = await app.get(`/api/skkni/prepare/${dicabut}`, { token: tokenUntuk(talenta) });
  assert.equal(r.status, 200);
  assert.equal(r.body.unitCount, 0, "unitCount harus memakai unit terpakai, bukan kolom unitCount dokumen");
  assert.equal(r.body.empty, true, "harus ditandai kosong supaya klien menyuruh pilih kompetensi lain");
});

test("kompetensi berlaku tetap dilaporkan siap dengan jumlah unitnya", async () => {
  const aktif = await buatKompetensi(prisma, { title: "SKKNI Desain Grafis", units: UNIT_VIDEO });
  const r = await app.get(`/api/skkni/prepare/${aktif}`, { token: tokenUntuk(talenta) });
  assert.equal(r.body.ready, true);
  assert.equal(r.body.unitCount, UNIT_VIDEO.length);
  assert.equal(r.body.empty, false);
});
