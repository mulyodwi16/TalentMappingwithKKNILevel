import { prisma } from "./prisma.js";
import { educationSeed, clampRank } from "./onboarding.js";

// Rank efektif = MAX( seed pendidikan (rendah), rank yang DIRAIH dari kompetensi ).
// Rank diraih dari BUKTI kompetensi: unit kompetensi yang LULUS + sertifikat + course selesai.
// Ini membuat keahlian (bukan ijazah) jadi penentu utama — SMK terampil bisa menyalip S3.
//
// masteryScore = unitLulus*8 + sertifikat*10 + course*4  → dipetakan ke tier:
const TIERS = [
  { min: 160, level: 9 }, // Legend
  { min: 120, level: 8 }, // Grandmaster
  { min: 85,  level: 7 }, // Master
  { min: 55,  level: 6 }, // Diamond
  { min: 32,  level: 5 }, // Emerald
  { min: 15,  level: 4 }, // Platinum
  { min: 0,   level: 3 }, // Gold
];

export function earnedFromMastery(passedUnits, certs, courses) {
  const score = passedUnits * 8 + certs * 10 + courses * 4;
  const level = (TIERS.find((t) => score >= t.min) || TIERS[TIERS.length - 1]).level;
  return { score, level };
}

// Poin kompetensi menuju tier berikutnya (untuk UI progres "berapa lagi untuk naik").
export function nextTierInfo(score) {
  const higher = [...TIERS].reverse().find((t) => t.min > score);
  return higher ? { level: higher.level, need: higher.min - score, at: higher.min } : null;
}

export async function computeRank(userId) {
  const [u, assess, certs, courseTx, redemptions] = await Promise.all([
    prisma.user.findUnique({ where: { id: userId } }),
    prisma.skillAssessment.findMany({ where: { userId } }),
    prisma.certificate.count({ where: { userId } }),
    prisma.coinTransaction.count({ where: { userId, refType: "course" } }).catch(() => 0),
    prisma.shopRedemption.count({ where: { userId } }).catch(() => 0),
  ]);
  const passedUnits = assess.filter((a) => a.currentScore >= 60).length;
  const courses = (courseTx || 0) + (redemptions || 0);
  const seed = educationSeed(u);
  const earned = earnedFromMastery(passedUnits, certs, courses);
  const effective = clampRank(Math.max(seed, earned.level));
  return {
    seed, earned: earned.level, masteryScore: earned.score, effective,
    passedUnits, certs, courses, next: nextTierInfo(earned.score),
  };
}

// Hitung ulang & simpan rank efektif ke user.currentKkniLevel. Panggil setelah ujian/sertifikat/course.
export async function refreshRank(userId) {
  const r = await computeRank(userId);
  await prisma.user.update({ where: { id: userId }, data: { currentKkniLevel: r.effective } });
  return r;
}
