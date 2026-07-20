// Data dummy talenta demo (#14): variasi nilai atas kompetensi yang sama (Video Editing) agar
// dashboard HRD terisi & bervariasi. Budi (patokan) & Reza (Desain Grafis) TIDAK disentuh -
// keduanya sudah punya data nyata. Idempoten: menimpa data unit Video Editing utk Andi & Dewi.
// Jalankan: node seed/dummy-talents.js
import "../env.js";
import { prisma } from "../prisma.js";
import { refreshReadiness } from "../readiness.js";
import { refreshRank } from "../rankcalc.js";

// Skor per unit (index 0..10) - 0 = belum diuji, <60 = gap, >=60 = lulus (terbit sertifikat).
const PLANS = {
  "andi@demo.id": { scores: [75, 68, 40, 35, 0, 0, 0, 0, 0, 0, 0] },              // SMK junior: 2 lulus, 2 gap
  "dewi@demo.id": { scores: [86, 82, 78, 72, 68, 64, 45, 40, 0, 0, 0] },          // D3: 6 lulus, 2 gap
};

const budi = await prisma.user.findUnique({ where: { email: "user@demo.id" } });
if (!budi?.chosenSkkniId) { console.error("Budi belum punya kompetensi Video Editing. Batal."); process.exit(1); }
const docId = budi.chosenSkkniId;
const title = budi.chosenSkkniTitle;
const units = await prisma.skkniUnit.findMany({ where: { documentId: docId, availability: "applied" }, orderBy: { code: "asc" } });
const codes = units.map((u) => u.code);
console.log(`Kompetensi: ${title} (${units.length} unit)`);

for (const [email, plan] of Object.entries(PLANS)) {
  const u = await prisma.user.findUnique({ where: { email } });
  if (!u) { console.log("skip (tidak ada):", email); continue; }

  await prisma.user.update({ where: { id: u.id }, data: { chosenSkkniId: docId, chosenSkkniTitle: title } });
  // Bersihkan data unit ini dulu (idempoten).
  await prisma.skillAssessment.deleteMany({ where: { userId: u.id, competencyCode: { in: codes } } });
  await prisma.certificate.deleteMany({ where: { userId: u.id, competencyCode: { in: codes }, source: "exam" } });
  await prisma.unitProgress.deleteMany({ where: { userId: u.id, unitCode: { in: codes } } });

  let passed = 0, assessed = 0;
  for (let i = 0; i < units.length; i++) {
    const score = plan.scores[i] ?? 0;
    if (score <= 0) continue;
    const unit = units[i];
    assessed++;
    await prisma.skillAssessment.create({ data: { userId: u.id, competencyCode: unit.code, competencyName: unit.title, currentScore: score, requiredScore: 100, gap: 100 - score } });
    await prisma.unitProgress.create({ data: { userId: u.id, docId, unitCode: unit.code, learned: true, learnedAt: new Date() } });
    if (score >= 60) {
      passed++;
      await prisma.certificate.create({ data: { userId: u.id, competencyCode: unit.code, name: unit.title, kkniLevel: u.currentKkniLevel || null, score, source: "exam" } });
    }
  }

  // Satu riwayat ujian terakhir agar tampil di "aktivitas terbaru" HRD.
  const readiness = assessed ? Math.round((passed / assessed) * 100) : 0;
  await prisma.examAttempt.create({
    data: {
      userId: u.id, kkniLevel: u.currentKkniLevel || 1, answers: "{}",
      scorePerCompetency: "{}", results: "[]", readinessScore: readiness,
      status: readiness >= 80 ? "ready" : readiness >= 50 ? "in_progress" : "not_ready",
      passed: readiness >= 80, gaps: "[]",
    },
  });

  const rank = await refreshRank(u.id);
  const r = await refreshReadiness(u.id);
  console.log(`${email}: ${passed}/${assessed} unit lulus, rank L${rank.effective}, kesiapan ${r.total}% (${r.status})`);
}

await prisma.$disconnect();
console.log("Dummy talenta selesai ✓");
