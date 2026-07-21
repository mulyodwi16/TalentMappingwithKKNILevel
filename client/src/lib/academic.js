// Pilihan status akademik untuk form daftar - hanya untuk TAMPILAN.
//
// `key` dan `label` HARUS sama dengan ACADEMIC_STATUS di server/onboarding.js (dijaga oleh
// server/tests/academic-sync.test.js). Yang lain tidak: rank awal ditentukan SERVER lewat
// `educationSeed`, dan sengaja dibatasi rendah karena ijazah bukan bukti kompetensi.
//
// Dulu di sini ada field `level` (S1 = 6, S3 = 8) di bawah komentar "mirror server" -
// padahal server memberi seed 4 untuk ketiganya. Angka itu tak pernah dipakai, tapi siapa
// pun yang membacanya akan mengira ijazah S3 memberi rank Grandmaster. Sudah dihapus.
export const ACADEMIC_STATUS = [
  { key: "siswa_smk",   label: "Siswa SMA/SMK",         desc: "Masih menempuh SMA/SMK" },
  { key: "lulusan_smk", label: "Lulusan SMA/SMK",       desc: "Sudah tamat SMA/SMK" },
  { key: "mahasiswa",   label: "Mahasiswa",              desc: "Menempuh pendidikan tinggi" },
  { key: "lulusan_s1",  label: "Lulusan Kuliah (D3-S1)", desc: "Sudah lulus D3/D4/S1" },
  { key: "lulusan_s2",  label: "Lulusan S2 (Magister)",  desc: "Sudah lulus Magister" },
  { key: "lulusan_s3",  label: "Lulusan S3 (Doktor)",    desc: "Sudah lulus Doktor" },
];
export function statusLabel(key) { return ACADEMIC_STATUS.find((s) => s.key === key)?.label || "-"; }
