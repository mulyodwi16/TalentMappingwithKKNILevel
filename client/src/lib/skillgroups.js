// Pengelompokan unit kompetensi untuk Skill Gap.
//
// Saat kompetensi punya banyak unit (mis. 79), radar per-unit jadi tak terbaca dan daftar
// kartunya terlalu panjang. Solusinya: gabung per KATEGORI (dasar/teknikal/lanjutan) yang
// sudah dikirim server dari classifyUnit - sumber yang sama dengan tangga rank, jadi
// pengelompokannya konsisten dengan bagian lain aplikasi.

// Ambang: di bawah ini radar tetap per-unit (masih terbaca); di atasnya digabung per kelompok.
export const RADAR_UNIT_CAP = 12;

// Urutan tetap: dari mendasar ke menuntut tanggung jawab luas. Label diterjemahkan lewat t()
// di komponen (kunci = teks Indonesia di sini).
export const CATEGORY_ORDER = ["dasar", "teknikal", "lanjutan"];
export const CATEGORY_LABEL = {
  dasar: "Dasar & Persiapan",
  teknikal: "Inti Teknikal",
  lanjutan: "Lanjutan & Tanggung Jawab",
};
const catOf = (a) => (CATEGORY_ORDER.includes(a?.category) ? a.category : "teknikal");

// Bagi assessment ke kelompok terurut. Tiap kelompok berisi ringkasan + daftar unitnya
// (gap terbesar di atas). Kelompok kosong tidak disertakan.
export function groupByCategory(assessments = []) {
  const bucket = new Map(CATEGORY_ORDER.map((c) => [c, []]));
  for (const a of assessments) bucket.get(catOf(a)).push(a);

  const groups = [];
  for (const cat of CATEGORY_ORDER) {
    const items = bucket.get(cat);
    if (!items.length) continue;
    const avg = Math.round(items.reduce((s, a) => s + (a.currentScore || 0), 0) / items.length);
    const avgTarget = Math.round(items.reduce((s, a) => s + (a.requiredScore || 0), 0) / items.length);
    const mastered = items.filter((a) => (a.currentScore || 0) >= 60).length;
    groups.push({
      key: cat,
      label: CATEGORY_LABEL[cat],
      avg,
      avgTarget,
      total: items.length,
      mastered,
      gaps: items.filter((a) => (a.gap || 0) > 0).length,
      items: [...items].sort((a, b) => (b.gap || 0) - (a.gap || 0)),
    });
  }
  return groups;
}

// Data radar. Sedikit unit → per-unit (label 2 kata). Banyak unit → satu titik per kelompok
// dengan nilai rata-rata, sehingga radar tetap terbaca dan tetap menunjukkan bentuk kekuatan.
export function radarSeries(assessments = [], cap = RADAR_UNIT_CAP) {
  if (assessments.length <= cap) {
    return {
      grouped: false,
      data: assessments.map((a) => ({
        label: a.competencyName?.split(" ").slice(0, 2).join(" ") || a.competencyCode,
        aktual: a.currentScore || 0,
        target: a.requiredScore || 0,
        gap: a.gap || 0,
        fullName: a.competencyName,
      })),
    };
  }
  return {
    grouped: true,
    data: groupByCategory(assessments).map((g) => ({
      label: CATEGORY_LABEL[g.key],
      aktual: g.avg,
      target: g.avgTarget,
      gap: Math.max(0, g.avgTarget - g.avg),
      fullName: `${CATEGORY_LABEL[g.key]} - rata-rata ${g.total} unit`,
    })),
  };
}
