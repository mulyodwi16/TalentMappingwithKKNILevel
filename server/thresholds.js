// Ambang penilaian - SATU sumber kebenaran.
//
// Sebelumnya angka 60 ditulis langsung di belasan tempat (rank, kesiapan, skill gap, HRD,
// learning path, profil skill). Selama semuanya kebetulan sama, tak ada yang sadar; begitu
// satu tempat diubah, dua layar melaporkan hal berbeda tentang orang yang sama - dan itu
// sudah terjadi lebih dari sekali di proyek ini.
//
// KETIGANYA SENGAJA BERBEDA. Jangan disatukan:
//
//   UNIT_MASTERY (60)     "unit ini dikuasai". Dipakai tangga rank, skor kesiapan, Skill
//                         Gap, dan hitungan unit lulus di sisi HRD. Ini ambang yang
//                         menyatakan seseorang bisa mengerjakan unit tersebut.
//
//   FINAL_PASS_SCORE (70) ambang lulus Ujian Kompetensi Utama - satu-satunya yang
//                         menerbitkan sertifikat. Lebih tinggi karena soalnya sintesis
//                         lintas unit dan hasilnya dibawa ke luar sebagai bukti.
//
//   PLAN_MASTERY (80)     ambang "langkah Learning Path selesai". Paling tinggi karena
//                         Learning Path bertugas MENUTUP gap, bukan sekadar melewatinya:
//                         unit 65% memang sudah dikuasai, tapi masih layak dikerjakan.
//
// Kalau salah satu diubah, server/tests/thresholds.test.js akan menagih hubungannya.
export const UNIT_MASTERY = 60;
export const FINAL_PASS_SCORE = 70;
export const PLAN_MASTERY = 80;
