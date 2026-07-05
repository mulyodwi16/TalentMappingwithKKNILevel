import { prisma } from "./prisma.js";

// Skor Kesiapan (0–100) terbagi 3 komponen agar transparan:
//   • CV        (maks 25) — profil/CV terisi & terpetakan.
//   • Ujian     (maks 60) — rata-rata unit kompetensi yang LULUS (dari SkillAssessment).
//   • Sertifikat(maks 15) — poin plus: sertifikat & bukti tambahan.
// Total = jumlah ketiganya (maks 100). Rank berasal dari pendidikan, TERPISAH dari kesiapan.
export const READINESS_WEIGHTS = { cv: 25, exam: 60, cert: 15 };

export async function computeReadiness(userId) {
  const [u, assess, certCount] = await Promise.all([
    prisma.user.findUnique({ where: { id: userId } }),
    prisma.skillAssessment.findMany({ where: { userId } }),
    prisma.certificate.count({ where: { userId } }),
  ]);
  if (!u) return { total: 0, cv: 0, exam: 0, cert: 0, assessed: 0, passed: 0, certCount: 0 };

  let hasCvMeta = false;
  try { hasCvMeta = !!u.cvMeta && u.cvMeta !== "{}" && Object.keys(JSON.parse(u.cvMeta)).length > 0; } catch { /* ignore */ }
  // CV penuh bila sudah upload CV; separuh bila data pendidikan terisi manual.
  const cv = hasCvMeta ? READINESS_WEIGHTS.cv : (u.education ? Math.round(READINESS_WEIGHTS.cv * 0.5) : 0);

  const passed = assess.filter((a) => a.currentScore >= 60).length;
  const exam = assess.length ? Math.round(READINESS_WEIGHTS.exam * (passed / assess.length)) : 0;

  const cert = Math.min(READINESS_WEIGHTS.cert, certCount * 5);

  const total = Math.min(100, cv + exam + cert);
  const status = total >= 80 ? "ready" : total >= 50 ? "in_progress" : "not_ready";
  return { total, cv, exam, cert, status, assessed: assess.length, passed, certCount };
}

// Hitung ulang & simpan ke user.readinessScore + status. Panggil setelah CV/ujian/sertifikat berubah.
export async function refreshReadiness(userId) {
  const r = await computeReadiness(userId);
  await prisma.user.update({ where: { id: userId }, data: { readinessScore: r.total, status: r.status } });
  return r;
}
