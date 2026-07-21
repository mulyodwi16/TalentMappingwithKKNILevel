import { prisma } from "./prisma.js";
import { UNIT_MASTERY } from "./thresholds.js";
import { chosenUnitCodeSet } from "./competencyScope.js";

// Skor Kesiapan (0–100) terbagi 3 komponen agar transparan:
//   • CV        (maks 25) - profil/CV terisi & terpetakan.
//   • Ujian     (maks 60) - rata-rata unit kompetensi yang LULUS (dari SkillAssessment).
//   • Sertifikat(maks 15) - poin plus: sertifikat & bukti tambahan.
// Total = jumlah ketiganya (maks 100). Rank berasal dari pendidikan, TERPISAH dari kesiapan.
export const READINESS_WEIGHTS = { cv: 25, exam: 60, cert: 15 };

// Inti perhitungan dipisah dari pengambilan data supaya bisa diuji tanpa database.
// Semua aturan rumus ada DI SINI; `computeReadiness` hanya mengumpulkan masukannya.
export function readinessFrom({ hasCvMeta = false, hasEducation = false, passed = 0, totalUnits = 0, assessedUnits = 0, certCount = 0, evidenceCount = 0 } = {}) {
  const cv = hasCvMeta ? READINESS_WEIGHTS.cv : (hasEducation ? Math.round(READINESS_WEIGHTS.cv * 0.5) : 0);

  // Penyebutnya SELURUH unit kompetensi, bukan hanya unit yang kebetulan sudah diuji.
  // Dulu memakai jumlah unit yang dinilai, jadi orang yang baru mengerjakan 1 unit dari 11
  // dan lulus langsung mendapat nilai ujian PENUH dan berstatus "Siap Naik" - HRD membaca
  // 85% lalu mengira orangnya sudah kompeten menyeluruh.
  const denom = totalUnits || assessedUnits;
  const capped = denom ? Math.min(passed, denom) : 0;
  const exam = denom ? Math.round(READINESS_WEIGHTS.exam * (capped / denom)) : 0;

  // Bonus: sertifikat kompetensi + bukti eksternal terverifikasi.
  const cert = Math.min(READINESS_WEIGHTS.cert, (certCount + evidenceCount) * 5);

  const total = Math.min(100, cv + exam + cert);
  const status = total >= 80 ? "ready" : total >= 50 ? "in_progress" : "not_ready";
  return { total, cv, exam, cert, status };
}

export async function computeReadiness(userId) {
  const [u, assessAll, certRows, evidenceCount] = await Promise.all([
    prisma.user.findUnique({ where: { id: userId } }),
    prisma.skillAssessment.findMany({ where: { userId } }),
    prisma.certificate.findMany({ where: { userId }, select: { competencyCode: true } }),
    prisma.externalEvidence.count({ where: { userId, status: "verified" } }).catch(() => 0),
  ]);
  if (!u) return { total: 0, cv: 0, exam: 0, cert: 0, assessed: 0, passed: 0, certCount: 0 };

  let hasCvMeta = false;
  try { hasCvMeta = !!u.cvMeta && u.cvMeta !== "{}" && Object.keys(JSON.parse(u.cvMeta)).length > 0; } catch { /* ignore */ }

  // Ujian & sertifikat di-scope ke kompetensi AKTIF → ganti kompetensi = kesiapan ikut berganti.
  // CV sengaja TIDAK di-scope (global per akun).
  const codes = await chosenUnitCodeSet(userId, u.chosenSkkniId || null);
  const inScope = (code) => (codes ? codes.has(code) : false);
  const assess = codes ? assessAll.filter((a) => inScope(a.competencyCode)) : [];
  const certCount = certRows.filter((c) => inScope(c.competencyCode)).length;
  const passed = assess.filter((a) => a.currentScore >= UNIT_MASTERY).length;

  // `codes` memuat docId (kode sertifikat kompetensi), jadi dikurangi satu agar penyebutnya
  // benar-benar jumlah unit. Lihat catatan di chosenUnitCodeSet.
  const totalUnits = codes ? Math.max(0, codes.size - 1) : 0;

  const r = readinessFrom({
    hasCvMeta, hasEducation: !!u.education,
    passed, totalUnits, assessedUnits: assess.length, certCount, evidenceCount,
  });
  return { ...r, assessed: assess.length, passed, certCount, evidenceCount, totalUnits };
}

// Hitung ulang & simpan ke user.readinessScore + status. Panggil setelah CV/ujian/sertifikat berubah.
export async function refreshReadiness(userId) {
  const r = await computeReadiness(userId);
  await prisma.user.update({ where: { id: userId }, data: { readinessScore: r.total, status: r.status } });
  return r;
}
