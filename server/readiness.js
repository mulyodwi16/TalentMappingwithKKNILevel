import { prisma } from "./prisma.js";
import { chosenUnitCodeSet } from "./competencyScope.js";

// Skor Kesiapan (0–100) terbagi 3 komponen agar transparan:
//   • CV        (maks 25) — profil/CV terisi & terpetakan.
//   • Ujian     (maks 60) — rata-rata unit kompetensi yang LULUS (dari SkillAssessment).
//   • Sertifikat(maks 15) — poin plus: sertifikat & bukti tambahan.
// Total = jumlah ketiganya (maks 100). Rank berasal dari pendidikan, TERPISAH dari kesiapan.
export const READINESS_WEIGHTS = { cv: 25, exam: 60, cert: 15 };

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
  // CV penuh bila sudah upload CV; separuh bila data pendidikan terisi manual. CV GLOBAL (tak di-scope).
  const cv = hasCvMeta ? READINESS_WEIGHTS.cv : (u.education ? Math.round(READINESS_WEIGHTS.cv * 0.5) : 0);

  // Ujian & sertifikat di-scope ke kompetensi AKTIF → ganti kompetensi = kesiapan ikut berganti.
  const codes = await chosenUnitCodeSet(userId, u.chosenSkkniId || null);
  const inScope = (code) => (codes ? codes.has(code) : false);
  const assess = codes ? assessAll.filter((a) => inScope(a.competencyCode)) : [];
  const certCount = certRows.filter((c) => inScope(c.competencyCode)).length;

  const passed = assess.filter((a) => a.currentScore >= 60).length;
  const exam = assess.length ? Math.round(READINESS_WEIGHTS.exam * (passed / assess.length)) : 0;

  // Bonus: sertifikat ujian (scoped) + bukti eksternal terverifikasi (global, poin plus).
  const cert = Math.min(READINESS_WEIGHTS.cert, (certCount + evidenceCount) * 5);

  const total = Math.min(100, cv + exam + cert);
  const status = total >= 80 ? "ready" : total >= 50 ? "in_progress" : "not_ready";
  return { total, cv, exam, cert, status, assessed: assess.length, passed, certCount, evidenceCount };
}

// Hitung ulang & simpan ke user.readinessScore + status. Panggil setelah CV/ujian/sertifikat berubah.
export async function refreshReadiness(userId) {
  const r = await computeReadiness(userId);
  await prisma.user.update({ where: { id: userId }, data: { readinessScore: r.total, status: r.status } });
  return r;
}
