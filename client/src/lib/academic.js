// Status akademik/karier (mirror server/onboarding.js) - untuk form daftar & profil.
// Platform menyiapkan siswa/mahasiswa/pencari kerja memenuhi standar SKKNI, bukan pekerja tetap.
export const ACADEMIC_STATUS = [
  { key: "siswa_smk",   label: "Siswa SMA/SMK",         desc: "Masih menempuh SMA/SMK", education: "SMK", level: 3 },
  { key: "lulusan_smk", label: "Lulusan SMA/SMK",       desc: "Sudah tamat SMA/SMK",    education: "SMK", level: 3 },
  { key: "mahasiswa",   label: "Mahasiswa",              desc: "Menempuh pendidikan tinggi", education: "Kuliah", level: 4 },
  { key: "lulusan_s1",  label: "Lulusan Kuliah (D3–S1)", desc: "Sudah lulus D3/D4/S1",  education: "S1",  level: 6 },
  { key: "lulusan_s2",  label: "Lulusan S2 (Magister)",  desc: "Sudah lulus Magister",  education: "S2",  level: 7 },
  { key: "lulusan_s3",  label: "Lulusan S3 (Doktor)",    desc: "Sudah lulus Doktor",    education: "S3",  level: 8 },
];
export function statusLabel(key) { return ACADEMIC_STATUS.find((s) => s.key === key)?.label || "-"; }
