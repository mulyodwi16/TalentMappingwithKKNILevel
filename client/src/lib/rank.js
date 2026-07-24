// Sistem "Skill Rank" (gamifikasi) di atas jenjang KKNI (Perpres 8/2012).
// `level` di sini BUKAN nomor urut tier - ia adalah NOMOR JENJANG KKNI yang disetarakan.
// Karena itu daftarnya mulai dari 3, bukan 1, dan label selalu menyebut "KKNI <n>":
// tanpa itu pengguna membaca "Rank 3" sebagai tier ketiga dan kehilangan asal-usulnya.
//
// KKNI 1-2 SENGAJA TIDAK ADA. Keduanya setara jenjang SD/SMP - di bawah usia kerja,
// sedangkan pengguna produk ini paling rendah lulusan SMA/SMK. Lantainya memang sudah
// terkunci di 3 (`RANK_FLOOR` di server/onboarding.js & `EARNED_FLOOR` di unitrank.js),
// jadi dua tier itu tak pernah bisa ditapaki siapa pun - memajangnya hanya membuat
// tangga terlihat panjang lalu pengguna mengira dirinya memulai dari bawah sekali.
export const KKNI_FLOOR = 3;   // WAJIB sama dengan RANK_FLOOR/EARNED_FLOOR di server
export const RANKS = [
  { level: 3, name: "Gold",        color: "#e0b400" },
  { level: 4, name: "Platinum",    color: "#2dd4bf" },
  { level: 5, name: "Emerald",     color: "#10b981" },
  { level: 6, name: "Diamond",     color: "#38bdf8" },
  { level: 7, name: "Master",      color: "#a855f7" },
  { level: 8, name: "Grandmaster", color: "#ec4899" },
  { level: 9, name: "Legend",      color: "#ef4444" },
];

export function rankOf(level) {
  return RANKS.find((r) => r.level === level) || null;
}
export function rankName(level) {
  return rankOf(level)?.name || "-";
}
// SATU frasa baku untuk menyebut jenjang: "setara level KKNI 6".
// Dipakai di SEMUA fitur supaya pengguna tak menemui tiga cara penulisan berbeda untuk
// angka yang sama. Di komponen React tulis `t("setara level KKNI {n}", { n })` agar ikut
// diterjemahkan - helper ini untuk tempat yang tak punya akses `t`.
export const KKNI_TERM = (level) => `setara level KKNI ${level}`;

// mis. "Gold · setara level KKNI 3". Nomornya SELALU disebut sebagai jenjang KKNI, bukan
// "Rank 3" - itu permintaan tim: gamifikasinya boleh, tapi sumbernya harus tetap terbaca.
export function rankLabel(level) {
  const r = rankOf(level);
  return r ? `${r.name} · ${KKNI_TERM(r.level)}` : "Belum ada rank";
}
export function rankColor(level) {
  return rankOf(level)?.color || "#94a3b8";
}

// CATATAN: dulu di sini ada `RANK_TIERS` + `tierProgress()` berbasis masteryScore
// (unitLulus*8 + sertifikat*10 + course*4) dengan komentar "jaga tetap sinkron dengan
// server/rankcalc.js". Keduanya DIHAPUS karena sudah tidak dipakai sejak rank ditentukan
// oleh TANGGA UNIT (server/unitrank.js): progres tier kini datang dari `rank.next` yang
// dikirim server, bukan dihitung ulang di klien. Menyimpan salinan rumus yang tak lagi
// menentukan apa pun hanya menambah tempat yang bisa jadi tidak sinkron diam-diam.
// Yang MASIH harus sinkron dengan server hanyalah daftar RANKS di atas - dijaga oleh
// server/tests/rank-sync.test.js.
