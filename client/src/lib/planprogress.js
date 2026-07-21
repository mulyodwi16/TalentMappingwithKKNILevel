// Progres Learning Path = CAKUPAN kompetensi (unit dikuasai / TOTAL unit kompetensi),
// bukan jumlah langkah tematik yang selesai.
//
// Rencana Learning Path hanya berisi ~8-12 langkah PRIORITAS (kurasi AI), bukan satu langkah
// per unit. Dulu progresnya dihitung "langkah selesai / total langkah" - jadi user yang lulus
// 11 dari 62 unit lewat tes penempatan melihat "10/12 langkah" (83%) padahal kompetensinya
// baru tersentuh 18%. Angka itu bertabrakan dengan Skor Kesiapan (24%) dan Skill Gap (62 unit).
//
// Cakupan unit menyatukan semuanya: Learning Path, Pemahaman di Dashboard, dan Skill Gap
// kini bercerita hal yang sama tentang seberapa jauh user menguasai kompetensinya.

export function coveragePct(mastered = 0, total = 0) {
  if (!total) return 0;
  return Math.max(0, Math.min(100, Math.round((mastered / total) * 100)));
}

// Cakupan dari payload Learning Path (`inputs`). `passedUnits` = unit lulus (skor >= 60),
// `competency.unitCount` = seluruh unit kompetensi. `known` = total unitnya diketahui
// (kompetensi sudah ter-cache); bila belum, pemanggil boleh jatuh ke metrik lama.
export function planCoverage(inputs) {
  const mastered = inputs?.passedUnits?.length || 0;
  const total = inputs?.competency?.unitCount || 0;
  return { mastered, total, pct: coveragePct(mastered, total), known: total > 0 };
}
