// Dedup pekerjaan yang MAHAL dan LAMA (penyusunan soal & materi oleh AI).
//
// Latar: penyusunan satu paket soal butuh puluhan detik - lebih lama dari batas tunggu klien.
// Klien yang kehabisan waktu terlihat gagal padahal servernya jalan terus, lalu pengguna
// menekan tombol lagi. Tanpa penjaga, tekanan kedua memulai penyusunan KEDUA dari nol:
// biaya LLM berlipat, dan dua penulisan hasil berebut baris unik yang sama.
//
// Dengan `once`, panggilan kedua untuk kunci yang sama menumpang promise yang sedang berjalan.
// Jadi mencoba lagi setelah kehabisan waktu bukan lagi pemborosan - justru itu cara pengguna
// memanen hasil pekerjaan yang sudah terlanjur selesai.
//
// Sengaja HANYA di memori: kalau proses mati di tengah jalan, tak ada penanda basi yang
// tertinggal di basis data dan menghalangi percobaan berikutnya selamanya.
const running = new Map();

// Riwayat singkat hasil terakhir tiap kunci. Perlu TERPISAH dari `running` karena pertanyaan
// "kenapa gagal?" baru diajukan klien SESUDAH pekerjaannya berhenti - kalau catatannya ikut
// terhapus saat selesai, klien cuma melihat "tidak sedang jalan" dan tak pernah tahu sebabnya.
const states = new Map();
const SIMPAN_HASIL_MS = 10 * 60_000;   // cukup lama untuk dipungut klien, tak menumpuk selamanya

function catat(k, s) {
  states.set(k, s);
  if (s.state !== "running") {
    const t = setTimeout(() => { if (states.get(k) === s) states.delete(k); }, SIMPAN_HASIL_MS);
    t.unref?.();                        // jangan menahan proses tetap hidup hanya demi pembersihan
  }
}

export function once(key, fn) {
  const k = String(key);
  const ada = running.get(k);
  if (ada) return ada;

  const s = { state: "running", error: null, startedAt: Date.now(), finishedAt: null, progress: null };
  catat(k, s);

  // `fn` dipanggil DI DALAM async supaya lemparan sinkron pun jadi promise yang ditolak -
  // kalau tidak, pengecualiannya lolos keluar dan kuncinya tak pernah dibersihkan.
  const p = (async () => fn())()
    .then((v) => { catat(k, { ...s, state: "done", finishedAt: Date.now() }); return v; })
    .catch((e) => {
      catat(k, { ...s, state: "error", error: e?.message || "Gagal", finishedAt: Date.now() });
      throw e;
    })
    .finally(() => { running.delete(k); });   // hapus setelah selesai, sukses maupun gagal
  running.set(k, p);
  return p;
}

// Untuk pelaporan/diagnostik: apakah kunci ini sedang dikerjakan?
export function isRunning(key) {
  const k = String(key);
  return running.has(k) || jobs.has(k);
}

// Keadaan terakhir sebuah kunci. "idle" = belum pernah dikerjakan di proses ini (atau
// catatannya sudah kedaluwarsa) - bukan berarti gagal.
export function jobState(key) {
  return states.get(String(key)) || { state: "idle", error: null, startedAt: null, finishedAt: null, progress: null };
}

// Laporkan kemajuan pekerjaan yang sedang jalan, mis. { done: 2, total: 3 }. Menunggu tanpa
// tahu sudah sampai mana terasa jauh lebih lama daripada menunggu yang sama sambil melihat
// angkanya bergerak - dan kalau macet, macetnya jadi kelihatan.
export function setProgress(key, progress) {
  const st = states.get(String(key));
  if (st && st.state === "running") st.progress = progress;
}

// Buang catatan hasil supaya panggilan berikutnya memulai percobaan BARU. Dipakai sesudah
// kegagalan dilaporkan ke pengguna: tanpa ini, satu kegagalan akan terus dilaporkan ulang
// dan pengguna tak pernah bisa mencoba lagi.
export function clearJob(key) {
  states.delete(String(key));
}

// Jalankan di LATAR: kembalikan keadaannya sekarang, jangan menahan pemanggil. Inilah yang
// memutus ketergantungan pada satu permintaan HTTP panjang - pekerjaan tetap jalan walau
// koneksi pengguna putus, dan hasilnya dipungut lewat panggilan berikutnya.
// Peta TERPISAH dari `running` milik `once`, dan pemisahan itu WAJIB. Pekerjaan yang
// dijalankan di sini hampir selalu memanggil `once(kunci yang sama)` di dalamnya - itu
// memang niatnya, supaya pemanggil langsung ikut menumpang. Kalau keduanya berbagi satu
// peta, `once` menemukan promise si pemanggil yang belum selesai lalu MENGEMBALIKANNYA:
// promise menunggu dirinya sendiri, pekerjaan aslinya tak pernah jalan, dan statusnya
// "running" selamanya - pengguna melihat "Menyusun soal..." tanpa akhir. Sudah terjadi.
const jobs = new Map();

export function startJob(key, fn) {
  const k = String(key);
  if (!jobs.has(k)) {
    const s = { state: "running", error: null, startedAt: Date.now(), finishedAt: null, progress: null };
    catat(k, s);
    // Kegagalannya dicatat ke `states`; ditelan di sini supaya tak jadi unhandled
    // rejection yang mematikan proses.
    const p = (async () => fn())()
      .then(() => { catat(k, { ...states.get(k), state: "done", finishedAt: Date.now() }); })
      .catch((e) => { catat(k, { ...states.get(k), state: "error", error: e?.message || "Gagal", finishedAt: Date.now() }); })
      .finally(() => { jobs.delete(k); });
    jobs.set(k, p);
  }
  return jobState(k);
}

// Pola "sudah ada, atau susun di latar" - dipakai rute yang menyajikan hasil pekerjaan mahal.
// Sengaja tinggal di sini (bukan di dalam berkas rute) supaya bisa diuji tanpa menyalakan LLM:
// kalau logikanya terkubur di dalam handler Express, satu-satunya cara mengujinya adalah
// benar-benar menyusun soal - mahal, lambat, dan hasilnya tak tentu.
//
// Balasannya SALAH SATU dari { hasil } atau { pending }.
export async function readyOrStart({ key, read, work }) {
  const ada = await read();
  if (ada) return { hasil: ada };

  const st = jobState(key);
  if (st.state === "error") {
    // Laporkan sekali lalu bersihkan, supaya percobaan pengguna berikutnya benar-benar baru
    // dan satu kegagalan tak terus dilaporkan ulang selamanya.
    clearJob(key);
    return { pending: { preparing: false, failed: true, error: st.error || "Gagal menyusun." } };
  }
  // Pekerjaan SELESAI tapi tak menghasilkan apa-apa. Ini bukan "belum siap" - mengulanginya
  // hanya akan gagal dengan cara yang sama, mahal, dan selamanya: pengguna melihat "sedang
  // menyusun" tanpa akhir sementara server membakar biaya tiap satu menit. Diperlakukan
  // sebagai kegagalan supaya pengguna diberi tahu dan bisa memutuskan sendiri.
  if (st.state === "done") {
    clearJob(key);
    return { pending: { preparing: false, failed: true, error: "Penyusunan selesai tanpa hasil. Coba lagi, atau pilih kompetensi lain bila terus gagal." } };
  }

  const jalan = startJob(key, work);
  return {
    pending: {
      preparing: true,
      state: jalan.state,
      progress: jalan.progress,
      // Klien memakainya untuk memperkirakan sudah berapa lama menunggu.
      elapsedMs: jalan.startedAt ? Date.now() - jalan.startedAt : 0,
    },
  };
}
