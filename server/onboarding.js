// Status akademik/karier pengguna — menggantikan asumsi "pekerja perusahaan".
// Platform menyiapkan siswa/mahasiswa/pencari kerja memenuhi standar kompetensi SKKNI.
//
// FILOSOFI RANK: rank BUKAN ditentukan ijazah, melainkan KOMPETENSI yang dibuktikan
// (ujian, sertifikat, course). Pendidikan hanya memberi "seed" awal yang DIBATASI rendah
// (maks Platinum/level 4) — selebihnya rank DIRAIH lewat skill. Maka lulusan SMK terampil
// bisa menyamai/melampaui lulusan S3, dan sebaliknya. Lihat server/rankcalc.js.
export const RANK_FLOOR = 3;  // Gold — usia kerja minimal (tamatan SMA/SMK)
export const SEED_CAP = 4;    // Platinum — batas kontribusi pendidikan ke rank

export const ACADEMIC_STATUS = {
  siswa_smk:   { label: "Siswa SMA/SMK",           education: "SMK",    seed: 3 }, // Gold
  mahasiswa:   { label: "Mahasiswa",                education: "Kuliah", seed: 3 }, // Gold
  lulusan_smk: { label: "Lulusan SMA/SMK",          education: "SMK",    seed: 3 }, // Gold
  lulusan_s1:  { label: "Lulusan Kuliah (D3–S1)",   education: "S1",     seed: 4 }, // Platinum
};

export function statusInfo(key) { return ACADEMIC_STATUS[key] || null; }

// Seed rank awal dari pendidikan (dibatasi SEED_CAP). Bukan penentu akhir — hanya titik mulai.
export function educationSeed(u) {
  const fromStatus = ACADEMIC_STATUS[u?.academicStatus]?.seed;
  if (fromStatus) return clampRank(fromStatus);
  const tertiary = /^(D1|D2|D3|D4|S1|S2|S3|Profesi|Kuliah)$/i.test(u?.education || "");
  return clampRank(tertiary ? SEED_CAP : RANK_FLOOR);
}

// Terapkan lantai & atap rank (Gold..Legend).
export function clampRank(level) {
  const n = Number(level) || RANK_FLOOR;
  return Math.max(RANK_FLOOR, Math.min(9, n));
}
