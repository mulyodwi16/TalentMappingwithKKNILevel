import { prisma } from "./prisma.js";
import { educationSeed, clampRank } from "./onboarding.js";
import { chosenUnitCodeSet } from "./competencyScope.js";
import { buildRankLadder, evaluateLadder } from "./unitrank.js";

// Rank efektif = MAX( seed pendidikan (rendah), rank yang DIRAIH dari kompetensi ).
// Rank diraih dari BUKTI kompetensi: unit kompetensi yang LULUS + sertifikat + course selesai.
// Ini membuat keahlian (bukan ijazah) jadi penentu utama - SMK terampil bisa menyalip S3.
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
  const u = await prisma.user.findUnique({ where: { id: userId } });
  // Batasi bukti kompetensi ke kompetensi yang SEDANG dipilih - ganti kompetensi = analisa
  // berganti; kompetensi baru mulai dari 0 (data lama tetap tersimpan & pulih bila kembali).
  const codes = await chosenUnitCodeSet(userId, u?.chosenSkkniId || null);
  const [assessAll, certRows, learnedRows, unitRows] = await Promise.all([
    prisma.skillAssessment.findMany({ where: { userId } }),
    prisma.certificate.findMany({ where: { userId }, select: { competencyCode: true } }),
    u?.chosenSkkniId
      ? prisma.unitProgress.findMany({ where: { userId, docId: u.chosenSkkniId, learned: true }, select: { unitCode: true } }).catch(() => [])
      : Promise.resolve([]),
    u?.chosenSkkniId
      ? prisma.skkniUnit.findMany({ where: { documentId: u.chosenSkkniId }, orderBy: { code: "asc" }, select: { code: true, title: true } }).catch(() => [])
      : Promise.resolve([]),
  ]);
  const inScope = (code) => (codes ? codes.has(code) : false);
  const passedCodes = new Set(assessAll.filter((a) => a.currentScore >= 60 && inScope(a.competencyCode)).map((a) => a.competencyCode));
  const passedUnits = passedCodes.size;
  const certs = certRows.filter((c) => inScope(c.competencyCode)).length;
  // "Course" = kelas kompetensi ini yang sudah dipelajari tapi BELUM lulus (hindari dobel hitung).
  const courses = learnedRows.filter((p) => !passedCodes.has(p.unitCode)).length;
  const seed = educationSeed(u);
  const mastery = earnedFromMastery(passedUnits, certs, courses); // dipertahankan sbg info, bukan penentu

  // Cap rank hasil-ujian oleh BOBOT kompetensi yang dipilih (cegah overcapacity).
  // Kompetensi basic tak bisa mengangkat ke rank ahli hanya lewat ujian kita.
  let doc = null;
  if (u?.chosenSkkniId) {
    doc = await prisma.skkniDocument.findUnique({
      where: { id: u.chosenSkkniId },
      select: { weightMaxRank: true, weightTier: true, weightReason: true },
    }).catch(() => null);
  }
  const cap = doc?.weightMaxRank || 9;

  // Rank diraih = tangga unit per tier (syaratnya bisa ditunjuk), bukan skor gabungan.
  // Unit dikelompokkan dasar → teknikal → softskill/mutu, lalu dibagi ke tier sampai cap.
  const ladder = buildRankLadder(unitRows, cap);
  const lad = evaluateLadder(ladder, passedCodes);
  const cappedEarned = lad.earned; // sudah otomatis terbatas cap lewat susunan tangga

  // Bukti eksternal terverifikasi bisa melampaui cap kompetensi (menuju "ahli"),
  // tapi tetap harus didukung ujian: headroom hanya +2 di atas rank ujian (koroborasi).
  const evid = await prisma.externalEvidence.findMany({
    where: { userId, status: "verified" }, select: { rankImplied: true },
  }).catch(() => []);
  const evidenceLevel = evid.reduce((m, e) => Math.max(m, e.rankImplied || 0), 0);
  const evidenceCount = evid.length;
  const withEvidence = Math.max(cappedEarned, Math.min(evidenceLevel, cappedEarned + 2));

  const effective = clampRank(Math.max(seed, withEvidence));
  return {
    seed, earned: cappedEarned, cappedEarned, masteryScore: mastery.score, effective,
    weightCap: cap, weightTier: doc?.weightTier || null, weightReason: doc?.weightReason || null,
    // Tangga sudah mentok di cap: tandai bila seluruh unit dikuasai tapi tier lebih tinggi
    // memang tak tersedia untuk kompetensi ini.
    cappedByWeight: cap < 9 && cappedEarned >= cap,
    evidenceLevel, evidenceCount, boostedByEvidence: withEvidence > cappedEarned,
    passedUnits, certs, courses,
    // Tangga rank per unit: dipakai UI untuk menunjukkan syarat naik secara konkret.
    ladder: lad.steps,
    next: lad.next
      ? { level: lad.next.level, done: lad.next.done, total: lad.next.total, need: lad.next.need,
          cumDone: lad.next.cumDone, cumTotal: lad.next.cumTotal, units: lad.next.units }
      : null,
  };
}

// Hitung ulang & simpan rank efektif ke user.currentKkniLevel. Panggil setelah ujian/sertifikat/course.
export async function refreshRank(userId) {
  const r = await computeRank(userId);
  await prisma.user.update({ where: { id: userId }, data: { currentKkniLevel: r.effective } });
  return r;
}
