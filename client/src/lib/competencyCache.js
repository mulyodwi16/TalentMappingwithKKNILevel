// Kompetensi target adalah AKAR dari hampir semua angka di aplikasi ini: tangga rank, Skill Gap,
// Kelas, Latihan Unit, tes penempatan, ujian kompetensi, Learning Path, skor kesiapan.
//
// Karena itu, mengganti kompetensi TANPA membuang cache akan menampilkan angka kompetensi LAMA
// di halaman yang belum dikunjungi ulang - dan sialnya itu terlihat meyakinkan, bukan seperti
// galat. Pernah terjadi: layar Tes Penempatan menyebut kompetensi lama berikut jumlah unit &
// durasinya, padahal server sudah menyusun soal untuk kompetensi yang baru.
//
// Satu daftar, satu pemanggilan. Kalau menambah query yang bergantung kompetensi aktif,
// tambahkan kuncinya DI SINI - jangan menyebar invalidasi ke banyak komponen.
export const COMPETENCY_SCOPED_KEYS = [
  "overview",           // rank, kesiapan, kompetensi terpilih
  "skkni-chosen",       // dokumen + unitnya
  "placement",          // status & baseline tes penempatan
  "final-exam",         // status ujian kompetensi
  "kelas-units",        // daftar unit + gerbang tier
  "skill-assessments",  // radar & kartu Skill Gap
  "learning-path",      // rencana belajar
  "assessments",
  "attempts",
  "certificates",
  "exam",               // soal latihan unit yang sedang dibuka
  "exam-history",
];

export function invalidateCompetencyScoped(qc) {
  COMPETENCY_SCOPED_KEYS.forEach((k) => qc.invalidateQueries({ queryKey: [k] }));
}
