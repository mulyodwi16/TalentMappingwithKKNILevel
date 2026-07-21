// Status akademik/karier pengguna - menggantikan asumsi "pekerja perusahaan".
// Platform menyiapkan siswa/mahasiswa/pencari kerja memenuhi standar kompetensi SKKNI.
//
// FILOSOFI RANK: rank BUKAN ditentukan ijazah, melainkan KOMPETENSI yang dibuktikan
// (ujian, sertifikat, course). Pendidikan hanya memberi "seed" awal yang DIBATASI rendah
// (maks Platinum/level 4) - selebihnya rank DIRAIH lewat skill. Maka lulusan SMK terampil
// bisa menyamai/melampaui lulusan S3, dan sebaliknya. Lihat server/rankcalc.js.
export const RANK_FLOOR = 3;  // Gold - usia kerja minimal (tamatan SMA/SMK)
export const SEED_CAP = 4;    // Platinum - batas kontribusi pendidikan ke rank

export const ACADEMIC_STATUS = {
  siswa_smk:   { label: "Siswa SMA/SMK",           education: "SMK",    seed: 3 }, // Gold
  mahasiswa:   { label: "Mahasiswa",                education: "Kuliah", seed: 3 }, // Gold
  lulusan_smk: { label: "Lulusan SMA/SMK",          education: "SMK",    seed: 3 }, // Gold
  lulusan_s1:  { label: "Lulusan Kuliah (D3-S1)",   education: "S1",     seed: 4 }, // Platinum
  lulusan_s2:  { label: "Lulusan S2 (Magister)",    education: "S2",     seed: 4 }, // Platinum
  lulusan_s3:  { label: "Lulusan S3 (Doktor)",      education: "S3",     seed: 4 }, // Platinum
};

export function statusInfo(key) { return ACADEMIC_STATUS[key] || null; }

// Seed rank AWAL = bukti kompetensi SEMENTARA dari CV (dibatasi SEED_CAP), yang tetap harus
// dibuktikan lewat kelas & ujian. TANPA CV → rank TERENDAH (RANK_FLOOR): user dianggap belum
// punya pengalaman terbukti di kompetensi itu. Ijazah/pendidikan TIDAK lagi menaikkan rank -
// hanya kompetensi terbukti (CV sementara → ujian) yang bisa. Lihat rankcalc.computeRank.
export function educationSeed(u) {
  let predicted = null;
  try {
    const meta = u?.cvMeta ? (typeof u.cvMeta === "string" ? JSON.parse(u.cvMeta) : u.cvMeta) : null;
    predicted = meta?.predictedLevel ?? null;
  } catch { /* cvMeta rusak → abaikan */ }
  if (predicted != null) return clampRank(Math.min(SEED_CAP, Number(predicted) || RANK_FLOOR));
  return RANK_FLOOR;
}

// Terapkan lantai & atap rank (Gold..Legend).
export function clampRank(level) {
  const n = Number(level) || RANK_FLOOR;
  return Math.max(RANK_FLOOR, Math.min(9, n));
}
