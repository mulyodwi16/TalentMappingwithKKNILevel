import test from "node:test";
import assert from "node:assert/strict";
import { once, isRunning, startJob, jobState, clearJob, readyOrStart, setProgress } from "../inflight.js";

// Penyusunan soal & materi oleh AI makan puluhan detik - lebih lama dari batas tunggu klien.
// Pengguna yang kehabisan waktu akan menekan tombolnya lagi. `once` memastikan tekanan kedua
// MENUMPANG pekerjaan yang sedang berjalan: biaya LLM tak berlipat, dan hasilnya tetap satu.

const tunda = (ms) => new Promise((r) => setTimeout(r, ms));

test("panggilan bersamaan dengan kunci sama hanya mengerjakan SEKALI", async () => {
  let jalan = 0;
  const kerja = async () => { jalan++; await tunda(30); return "paket"; };

  const hasil = await Promise.all([once("k1", kerja), once("k1", kerja), once("k1", kerja)]);
  assert.equal(jalan, 1, "pekerjaan mahal tak boleh diulang untuk kunci yang sama");
  assert.deepEqual(hasil, ["paket", "paket", "paket"], "semua penunggu menerima hasil yang sama");
});

test("kunci berbeda berjalan sendiri-sendiri", async () => {
  let jalan = 0;
  const kerja = async () => { jalan++; await tunda(10); return jalan; };
  await Promise.all([once("a", kerja), once("b", kerja)]);
  assert.equal(jalan, 2, "dua kompetensi berbeda harus disusun masing-masing");
});

test("setelah selesai, kunci dilepas supaya bisa dipakai lagi", async () => {
  let jalan = 0;
  const kerja = async () => { jalan++; return jalan; };
  await once("k2", kerja);
  assert.equal(isRunning("k2"), false, "kunci tak boleh menyangkut sesudah selesai");
  await once("k2", kerja);
  assert.equal(jalan, 2, "panggilan setelah selesai adalah pekerjaan baru, bukan hasil basi");
});

test("kegagalan juga melepas kunci - percobaan berikutnya tetap bisa jalan", async () => {
  let jalan = 0;
  const gagal = async () => { jalan++; throw new Error("LLM tumbang"); };

  await assert.rejects(() => once("k3", gagal), /LLM tumbang/);
  assert.equal(isRunning("k3"), false, "kunci yang gagal tak boleh mengunci fitur selamanya");
  await assert.rejects(() => once("k3", gagal), /LLM tumbang/);
  assert.equal(jalan, 2, "pengguna harus bisa mencoba lagi setelah kegagalan");
});

test("penunggu ikut menerima kegagalan, bukan menggantung", async () => {
  const gagal = async () => { await tunda(20); throw new Error("putus"); };
  const a = once("k4", gagal);
  const b = once("k4", gagal);
  await assert.rejects(() => a, /putus/);
  await assert.rejects(() => b, /putus/);
});

test("fungsi yang melempar sinkron tetap jadi promise yang ditolak", async () => {
  // Kalau `fn()` dipanggil di luar konteks async, lemparan sinkron akan lolos sebagai
  // pengecualian biasa dan kunci tak pernah dibersihkan.
  await assert.rejects(() => once("k5", () => { throw new Error("sinkron"); }), /sinkron/);
  assert.equal(isRunning("k5"), false);
});

// ── Pekerjaan LATAR + pelacak status ─────────────────────────────────────────
// Inti polanya: permintaan HTTP tak lagi menahan penyusunan yang lama. Supaya itu aman,
// keadaannya harus bisa ditanyakan SESUDAH pekerjaannya berhenti - termasuk sebab kegagalan.

test("startJob tidak menahan pemanggil, dan keadaannya bisa ditanyakan", async () => {
  let selesai = false;
  const st = startJob("bg1", async () => { await tunda(40); selesai = true; return "ok"; });

  assert.equal(st.state, "running", "harus langsung melapor sedang berjalan");
  assert.equal(selesai, false, "pemanggil tak boleh ikut menunggu sampai selesai");
  assert.equal(jobState("bg1").state, "running");

  await tunda(70);
  assert.equal(selesai, true);
  assert.equal(jobState("bg1").state, "done", "hasilnya harus bisa dipungut sesudah selesai");
});

test("startJob kedua menumpang pekerjaan yang sedang jalan", async () => {
  let jalan = 0;
  const kerja = async () => { jalan++; await tunda(40); return "paket"; };
  startJob("bg2", kerja);
  startJob("bg2", kerja);
  startJob("bg2", kerja);
  await tunda(70);
  assert.equal(jalan, 1, "polling klien tak boleh memicu penyusunan berulang");
});

test("sebab kegagalan tetap tersimpan setelah pekerjaan berhenti", async () => {
  startJob("bg3", async () => { await tunda(10); throw new Error("kuota LLM habis"); });
  await tunda(40);
  const st = jobState("bg3");
  assert.equal(st.state, "error");
  assert.match(st.error, /kuota LLM habis/, "pengguna harus bisa diberi tahu sebabnya, bukan cuma 'tidak jalan'");
});

test("kegagalan yang sudah dilaporkan bisa dibersihkan supaya bisa dicoba lagi", async () => {
  let jalan = 0;
  startJob("bg4", async () => { jalan++; throw new Error("sekali gagal"); });
  await tunda(20);
  assert.equal(jobState("bg4").state, "error");

  clearJob("bg4");
  assert.equal(jobState("bg4").state, "idle", "sesudah dibersihkan harus kembali seperti belum pernah dicoba");

  startJob("bg4", async () => { jalan++; return "ok"; });
  await tunda(20);
  assert.equal(jalan, 2, "percobaan berikutnya harus benar-benar jalan");
  assert.equal(jobState("bg4").state, "done");
});

test("kunci yang belum pernah dikerjakan berstatus idle, bukan error", () => {
  assert.equal(jobState("belum-pernah").state, "idle");
  assert.equal(jobState("belum-pernah").error, null);
});

test("kegagalan pekerjaan latar tidak menjadi unhandled rejection", async () => {
  // Kalau promise-nya dibiarkan menolak tanpa penangkap, Node memadamkan proses server.
  // Jaring pengamannya ada di startJob; tes ini menahannya supaya tak lepas diam-diam.
  const tertangkap = [];
  const asli = process.listeners("unhandledRejection");
  process.removeAllListeners("unhandledRejection");
  process.on("unhandledRejection", (e) => tertangkap.push(e));

  startJob("bg5", async () => { throw new Error("meledak"); });
  await tunda(50);

  process.removeAllListeners("unhandledRejection");
  asli.forEach((l) => process.on("unhandledRejection", l));
  assert.equal(tertangkap.length, 0, "kegagalan penyusunan tak boleh menjatuhkan server");
});

// ── readyOrStart: yang benar-benar dipakai rute penyaji soal ─────────────────
// Diuji di sini, bukan lewat rute HTTP, karena menembus rutenya akan MENYUSUN SOAL SUNGGUHAN
// (biaya LLM nyata, puluhan detik, hasil tak deterministik).

test("paket yang sudah ada dikembalikan langsung tanpa memulai pekerjaan", async () => {
  let jalan = 0;
  const r = await readyOrStart({
    key: "ro1", read: async () => ({ id: "paket-lama" }), work: async () => { jalan++; },
  });
  assert.deepEqual(r.hasil, { id: "paket-lama" });
  assert.equal(r.pending, undefined);
  assert.equal(jalan, 0, "paket yang sudah tersimpan tak boleh disusun ulang");
});

test("paket belum ada → jawab `preparing` seketika, penyusunan jalan di latar", async () => {
  let jalan = 0;
  const mulai = Date.now();
  const r = await readyOrStart({
    key: "ro2", read: async () => null, work: async () => { jalan++; await tunda(60); return "paket"; },
  });
  assert.equal(r.hasil, undefined);
  assert.equal(r.pending.preparing, true);
  assert.ok(Date.now() - mulai < 40, "permintaan TIDAK boleh ikut menunggu penyusunan selesai");

  await tunda(90);
  assert.equal(jalan, 1);
  assert.equal(jobState("ro2").state, "done");
});

test("polling berulang selagi menyusun tidak menambah pekerjaan", async () => {
  let jalan = 0;
  const kerja = async () => { jalan++; await tunda(60); return "paket"; };
  for (let i = 0; i < 4; i++) {
    const r = await readyOrStart({ key: "ro3", read: async () => null, work: kerja });
    assert.equal(r.pending.preparing, true);
  }
  await tunda(90);
  assert.equal(jalan, 1, "empat kali polling harus tetap satu kali penyusunan");
});

test("kegagalan dilaporkan sekali, lalu percobaan berikutnya dimulai baru", async () => {
  let jalan = 0;
  await readyOrStart({ key: "ro4", read: async () => null, work: async () => { jalan++; throw new Error("LLM tumbang"); } });
  await tunda(30);

  const gagal = await readyOrStart({ key: "ro4", read: async () => null, work: async () => { jalan++; } });
  assert.equal(gagal.pending.failed, true, "pengguna harus diberi tahu penyusunannya gagal");
  assert.match(gagal.pending.error, /LLM tumbang/);

  const lagi = await readyOrStart({ key: "ro4", read: async () => null, work: async () => { jalan++; return "paket"; } });
  assert.equal(lagi.pending.preparing, true, "sesudah dilaporkan, tombol coba lagi harus benar-benar mencoba lagi");
  await tunda(30);
  assert.equal(jalan, 2);
});

test("paket yang selesai selagi klien polling langsung tersaji", async () => {
  let selesai = false;
  const kerja = async () => { await tunda(40); selesai = true; return "paket"; };
  const baca = async () => (selesai ? { id: "paket-baru" } : null);

  const pertama = await readyOrStart({ key: "ro5", read: baca, work: kerja });
  assert.equal(pertama.pending.preparing, true);

  await tunda(70);
  const kedua = await readyOrStart({ key: "ro5", read: baca, work: kerja });
  assert.deepEqual(kedua.hasil, { id: "paket-baru" }, "polling berikutnya harus memungut hasilnya");
  assert.equal(kedua.pending, undefined);
});

test("kemajuan pekerjaan bisa dilaporkan & ikut terbawa ke klien", async () => {
  // Menunggu 2 menit tanpa tahu sudah sampai mana terasa seperti macet. Angka yang bergerak
  // membedakan "sedang jalan" dari "menggantung" - tanpa perlu menebak dari lamanya.
  let lepas;
  const selesai = new Promise((r) => { lepas = r; });
  startJob("pg1", async () => {
    setProgress("pg1", { done: 1, total: 3 });
    await selesai;
    return "paket";
  });
  await tunda(20);

  const r = await readyOrStart({ key: "pg1", read: async () => null, work: async () => "x" });
  assert.deepEqual(r.pending.progress, { done: 1, total: 3 }, "kemajuan harus ikut di balasan `preparing`");

  lepas();
  await tunda(30);
  assert.equal(jobState("pg1").state, "done");
});

test("kemajuan pekerjaan yang sudah berhenti tidak ditimpa lagi", async () => {
  startJob("pg2", async () => "cepat");
  await tunda(20);
  setProgress("pg2", { done: 99, total: 99 });
  assert.notDeepEqual(jobState("pg2").progress, { done: 99, total: 99 },
    "laporan telat dari pekerjaan lama tak boleh mengotori catatan hasil");
});

test("pekerjaan yang selesai TANPA hasil dilaporkan gagal, bukan diulang selamanya", async () => {
  // Kasus nyata: batas waktu LLM memutus tiap batch, jadi paketnya kosong dan tak pernah
  // tersimpan. Karena `read()` tetap null dan statusnya "done", polling klien memulai
  // penyusunan BARU tiap kali - spinner tak pernah berhenti dan biayanya terus jalan.
  let jalan = 0;
  const kosong = async () => { jalan++; return null; };   // selesai, tapi tak menulis apa pun

  const pertama = await readyOrStart({ key: "nil1", read: async () => null, work: kosong });
  assert.equal(pertama.pending.preparing, true);
  await tunda(30);

  const kedua = await readyOrStart({ key: "nil1", read: async () => null, work: kosong });
  assert.equal(kedua.pending.failed, true, "harus dilaporkan gagal, bukan 'sedang menyusun' lagi");
  assert.match(kedua.pending.error, /tanpa hasil/i);
  assert.equal(jalan, 1, "tak boleh langsung memulai penyusunan kedua di panggilan yang sama");
});

test("sesudah dilaporkan, pengguna tetap bisa mencoba lagi", async () => {
  let jalan = 0;
  const kosong = async () => { jalan++; return null; };
  await readyOrStart({ key: "nil2", read: async () => null, work: kosong });
  await tunda(30);
  await readyOrStart({ key: "nil2", read: async () => null, work: kosong });   // laporan gagal

  const lagi = await readyOrStart({ key: "nil2", read: async () => null, work: kosong });
  assert.equal(lagi.pending.preparing, true, "percobaan berikutnya harus benar-benar jalan lagi");
  await tunda(30);
  assert.equal(jalan, 2);
});

// ── Regresi: pekerjaan latar yang membungkus dirinya sendiri ─────────────────
// Ini penyebab nyata "Menyusun soal..." tanpa akhir di Tes Penempatan. Rutenya memanggil
// startJob(K, work), sedangkan work-nya (ensurePlacementPackage) membungkus pekerjaan asli
// dengan once(K, ...) - kunci yang SAMA, memang disengaja supaya pemanggil langsung ikut
// menumpang. Saat keduanya berbagi satu peta promise, once menemukan promise si pemanggil
// yang belum selesai lalu mengembalikannya: promise menunggu dirinya sendiri.
//
// Gejalanya jahat karena tak terlihat seperti galat - tak ada lemparan, tak ada log, tak ada
// biaya LLM. Yang terlihat hanya spinner yang tak pernah berhenti.

test("pekerjaan latar yang memanggil once dengan kunci sama TETAP jalan", async () => {
  let jalan = false;
  const kerja = async () => {
    await tunda(10);                       // ensurePlacementPackage membaca DB dulu
    return once("selfref", async () => { jalan = true; return "paket"; });
  };

  startJob("selfref", kerja);
  await tunda(120);
  assert.ok(jalan, "pekerjaan aslinya tak pernah dijalankan - promise menunggu dirinya sendiri");
  assert.equal(jobState("selfref").state, "done", "status harus selesai, bukan menggantung di 'running'");
  clearJob("selfref");
});

test("hasil pekerjaan latar yang membungkus once tetap bisa dipungut", async () => {
  // Bukan cuma soal 'jalan': hasilnya harus benar-benar tersimpan supaya pembacaan
  // berikutnya menemukannya, bukan memulai penyusunan baru tanpa henti.
  let simpanan = null;
  const susun = async () => {
    await tunda(10);
    return once("selfref2", async () => { simpanan = "paket"; return simpanan; });
  };

  let r = await readyOrStart({ key: "selfref2", read: async () => simpanan, work: susun });
  assert.equal(r.pending?.preparing, true, "panggilan pertama menyusun di latar");

  await tunda(150);
  r = await readyOrStart({ key: "selfref2", read: async () => simpanan, work: susun });
  assert.equal(r.hasil, "paket", "polling berikutnya harus memungut hasilnya, bukan menyusun ulang");
  clearJob("selfref2");
});
