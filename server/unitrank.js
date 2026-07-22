// Tangga rank per unit kompetensi.
//
// Dulu rank diraih dari skor gabungan (unitLulus*8 + sertifikat*10 + course*4) yang buram:
// user tak bisa tahu persis apa yang harus dikuasai untuk naik. Sekarang unit kompetensi
// dibagi ke ember per tier, sehingga syarat naik rank bisa ditunjuk:
// "kuasai 3 unit ini untuk naik ke Diamond".
//
// Pembagian sengaja DETERMINISTIK (urutan kode unit, bukan AI) supaya tangga rank seorang
// user tidak berubah-ubah sendiri di antara kunjungan.

export const EARNED_FLOOR = 3; // Gold - tier terendah yang bisa diraih lewat ujian
export const MAX_RANK = 9;     // Legend

// ── Klasifikasi sifat unit ───────────────────────────────────────────────────
// Urutan kode SKKNI TIDAK mencerminkan tingkat kesulitan, jadi pembagian tier memakai
// sifat unitnya:
//   dasar    - hal umum yang cepat dikuasai: K3, prosedur, keamanan, persiapan, pencatatan
//   teknikal - inti pekerjaan: metode, alat, produksi, penyuntingan (mayoritas unit)
//   lanjutan - softskill & tanggung jawab luas: komunikasi, kerjasama klien, kendali mutu,
//              supervisi, evaluasi. Ini nilai plus, jadi ditaruh di rank atas.
//
// PENTING: cocokkan per KATA UTUH (\b). Pencocokan substring bikin salah kelompok
// (mis. "kerja" akan ikut menangkap "pekerjaan", "mutu" menangkap "mutunya").
const CAT = { dasar: 1, teknikal: 2, lanjutan: 3 };

const DASAR_RE = /\b(k3|keselamatan|kesehatan|kebersihan|higiene|prosedur|sop|keamanan|etika|peraturan|persyaratan|mempersiapkan|persiapan|menyiapkan|memelihara|merawat|perawatan|membersihkan|mencatat|catatan|dokumentasi|administrasi|mengidentifikasi|membaca|dasar)\b/;
const LANJUTAN_RE = /\b(komunikasi|berkomunikasi|kerjasama|kerja\s*sama|koordinasi|berkoordinasi|negosiasi|presentasi|klien|client|pelanggan|customer|tim|memimpin|kepemimpinan|supervisi|menyelia|mengelola|pengelolaan|manajemen|mengevaluasi|evaluasi|mutu|kualitas|mengembangkan|pengembangan|inovasi|melatih|pelatihan|membimbing|menganalisis|analisis|strategi|perencanaan)\b/;

// Kelompokkan satu unit. Softskill/mutu diperiksa LEBIH DULU: unit seperti
// "Menerapkan prosedur kendali mutu" mengandung kata dasar sekaligus lanjutan,
// dan tanggung jawab mutunya yang membuatnya layak di rank atas.
export function classifyUnit(unit) {
  const s = String(unit?.title || "").toLowerCase();
  if (LANJUTAN_RE.test(s)) return "lanjutan";
  if (DASAR_RE.test(s)) return "dasar";
  return "teknikal";
}

// Urutan tampilan kelompok: dari yang mendasar ke yang menuntut tanggung jawab luas.
// Dipakai Skill Gap untuk menyusun radar & kartu per kelompok saat unitnya banyak.
export const UNIT_CATEGORIES = ["dasar", "teknikal", "lanjutan"];

// Bagi unit ke tier EARNED_FLOOR..cap. Unit diurutkan berdasarkan sifatnya
// (dasar → teknikal → lanjutan), lalu kode untuk menjaga urutan tetap stabil.
// Sisa pembagian diberikan ke tier ATAS.
export function buildRankLadder(units = [], cap = MAX_RANK) {
  const list = (units || [])
    .filter((u) => u && u.code)
    .map((u) => ({ code: u.code, title: u.title, category: classifyUnit(u) }))
    .sort((a, b) => CAT[a.category] - CAT[b.category] || String(a.code).localeCompare(String(b.code)));
  const top = Math.max(EARNED_FLOOR, Math.min(cap || MAX_RANK, MAX_RANK));

  // Tangga tak boleh lebih panjang dari jumlah unitnya. Kalau lebih panjang, sebagian tier
  // pasti kosong - dan tier kosong dulu dihitung "tercapai", jadi kompetensi dengan 3 unit
  // membagikan Gold sampai Diamond secara cuma-cuma, dan kompetensi yang unitnya BELUM
  // tertarik dari Kemnaker (0 unit) langsung memberi Legend kepada siapa pun. Sekarang
  // tiernya dipangkas mengikuti banyaknya bukti yang benar-benar bisa diminta.
  const n0 = (units || []).filter((u) => u && u.code).length;
  const maxLevels = Math.max(1, top - EARNED_FLOOR + 1);
  const jumlahTier = n0 ? Math.min(maxLevels, n0) : maxLevels;

  const levels = [];
  for (let l = EARNED_FLOOR; l < EARNED_FLOOR + jumlahTier; l++) levels.push(l);

  const ladder = levels.map((level) => ({ level, units: [] }));
  const n = list.length;
  const k = levels.length;
  if (!n || !k) return ladder;

  const base = Math.floor(n / k);
  const extra = n % k;
  let i = 0;
  for (let b = 0; b < k; b++) {
    const take = base + (b >= k - extra ? 1 : 0); // sisa ke ember paling atas
    ladder[b].units = list.slice(i, i + take);
    i += take;
  }
  return ladder;
}

// Ambang penguasaan untuk mencapai sebuah tier. Sengaja KUMULATIF (dihitung atas seluruh
// unit sampai tier tersebut), bukan per tier terpisah: ember tier berisi 2-3 unit, sehingga
// ambang per tier akan membulat jadi "semua unit wajib" (2 dari 3 hanya 67%) dan satu unit
// dasar yang terlewat menahan seluruh tier di atasnya. Kumulatif membuat toleransinya nyata
// sekaligus tetap mencegah user memetik hanya unit tier atas.
export const TIER_TOLERANCE = 0.8;

// Rank yang diraih = tier tertinggi yang penguasaan kumulatifnya (tier itu + semua tier di
// bawahnya) mencapai ambang. Unit yang belum dikuasai TETAP dilaporkan sebagai gap.
// `mastered` = Set kode unit yang skornya mencapai UNIT_MASTERY (lihat thresholds.js).
// ── Babak rank untuk Learning Path ────────────────────────────────────────────
// Learning Path dulu menampilkan SATU bar raksasa "cakupan seluruh kompetensi" yang macet
// di angka kecil (0/90 = 13%) - bikin patah semangat. Sekarang progres dipecah PER RANK:
// "babak" saat ini = dorongan menuju rank berikutnya. Penuh → naik rank → babak maju ke tier
// atasnya (bar seolah reset). Angkanya diturunkan dari tangga yang SAMA dengan computeRank,
// jadi Learning Path, Dashboard, dan hero rank tak pernah berselisih.
//
// Target babak = rank pertama DI ATAS rank efektif yang, kalau unit-unitnya dikuasai, BENAR-
// BENAR menaikkan rank (memicu perayaan). Untuk pemula yang rank awalnya dari pendidikan
// (mis. Gold), targetnya Platinum - membuktikan Gold saja tak menaikkan rank yang sudah dimiliki.
// Sudah mentok cap bobot kompetensi (butuh bukti eksternal untuk lanjut) → atTop.
// Mengembalikan LEVEL angka saja (tanpa nama) - klien yang memberi nama & warna rank.
export function rankChapter({ ladder = [], next = null, effective = 0 } = {}) {
  const map = ladder.map((s) => ({ level: s.level, total: s.total, done: s.done, complete: s.complete, achieved: s.achieved }));
  const top = ladder.length ? ladder[ladder.length - 1].level : effective;
  const targetLevel = Math.max((effective || EARNED_FLOOR) + 1, next?.level || 0);

  // Tak ada tangga (belum pilih kompetensi) atau target melewati tier tertinggi yang tersedia
  // untuk kompetensi ini → tak ada babak berikutnya lewat unit.
  if (!ladder.length || targetLevel > top) {
    return { atTop: true, earned: effective, target: null, done: 0, total: 0, need: 0, pct: 100, ladder: map };
  }

  const step = ladder.find((s) => s.level === targetLevel) || next;
  const need = step?.need ?? 0;                 // unit lagi (kumulatif) untuk mencapai target
  const done = step?.cumDone ?? 0;              // unit yang sudah dikuasai sampai tier target
  const total = done + need;                    // = ceil(TIER_TOLERANCE * cumTotal target)
  const pct = total ? Math.round((done / total) * 100) : (need === 0 ? 100 : 0);
  return { atTop: false, earned: effective, target: targetLevel, done, total, need, pct, ladder: map };
}

export function evaluateLadder(ladder, mastered, tolerance = TIER_TOLERANCE) {
  const codes = mastered instanceof Set ? mastered : new Set(mastered || []);
  let earned = 0;      // 0 = belum ada tier yang tercapai
  let next = null;     // tier pertama yang belum tercapai
  let blocked = false;
  let cumTotal = 0;
  let cumDone = 0;

  const steps = ladder.map((step) => {
    const total = step.units.length;
    const done = step.units.filter((u) => codes.has(u.code)).length;
    cumTotal += total;
    cumDone += done;
    // Tanpa satu pun unit sampai tier ini, tak ada yang bisa dibuktikan - maka tier itu
    // TIDAK tercapai. Dulu `cumTotal === 0` dihitung tercapai, sehingga kompetensi yang
    // unitnya belum ter-cache memberi rank tertinggi kepada pengguna yang belum ujian
    // sama sekali. Rank harus selalu punya bukti di belakangnya.
    const reached = cumTotal > 0 && cumDone / cumTotal >= tolerance;
    // Berapa unit lagi (mana pun, termasuk tier bawah yang tertinggal) untuk mencapai tier ini.
    const need = Math.max(0, Math.ceil(tolerance * cumTotal) - cumDone);
    // `reached` saja BELUM berarti tier itu didapat. Rasio kumulatif bisa turun di tier bawah
    // lalu pulih di tier atas (mis. 1/2, 2/3, 3/3, 3/3 → Diamond 9/11 = 82%), sehingga tier
    // atas tampak tercapai padahal rank berhenti di tier pertama yang gagal. `achieved` = benar
    // benar didapat: tier ini DAN seluruh tier di bawahnya lolos. Ini yang dipakai tampilan
    // (centang tangga rank) dan gerbang Kelas/Ujian, supaya tak pernah berselisih dengan `earned`.
    const achieved = !blocked && reached;
    const s = {
      level: step.level,
      total,
      done,
      complete: reached,
      achieved,
      need,
      cumDone,
      cumTotal,
      units: step.units.map((u) => ({ code: u.code, title: u.title, category: u.category, mastered: codes.has(u.code) })),
    };
    if (!blocked) {
      if (reached) earned = step.level;
      else { blocked = true; next = s; }
    }
    return s;
  });

  return { earned, next, steps };
}
