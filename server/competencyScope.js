import { prisma } from "./prisma.js";

// Set kode unit milik kompetensi yang SEDANG dipilih user.
//   • null  → user belum memilih kompetensi apa pun.
// Dipakai untuk MEMBATASI analisa AI (rank, kesiapan, skill gap) ke kompetensi AKTIF saja -
// sehingga ganti kompetensi = data analisa ikut berganti, dan kompetensi baru mulai dari 0.
// Data mentah (SkillAssessment/Certificate/UnitProgress) TIDAK dihapus: ia tetap tersimpan
// per-kode-unit & per-akun, jadi berganti balik ke kompetensi lama akan memulihkan progresnya.
// CV (cvMeta) sengaja TIDAK di-scope - ia global per akun (user yang memutuskan memperbaruinya).
export async function chosenUnitCodeSet(userId, chosenSkkniId = undefined) {
  let docId = chosenSkkniId;
  if (docId === undefined) {
    const u = await prisma.user.findUnique({ where: { id: userId }, select: { chosenSkkniId: true } });
    docId = u?.chosenSkkniId || null;
  }
  if (!docId) return null;
  const units = await prisma.skkniUnit.findMany({ where: { documentId: docId }, select: { code: true } });
  return new Set(units.map((x) => x.code));
}
