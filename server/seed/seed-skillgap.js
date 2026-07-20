// Restore data "Skill Gap" demo dari fixture (server/seed/fixtures/skillgap.json) - agar
// clone/DB baru langsung punya bahan Skill Gap yang ramai (radar, gap, learning path) TANPA
// perlu tarik katalog Kemnaker atau ambil ujian manual. Dipanggil dari seed.js.
//
// GUARD anti-clobber: hanya mengisi bila para demo user BELUM punya SkillAssessment sama sekali
// (DB fresh). Bila sudah ada data (mis. user sudah mengerjakan ujian), restore DILEWATI agar
// progres nyata tak tertimpa saat run-all.bat memanggil seed tiap start. Paksa dgn { force:true }.
//
// Standalone: `node seed/seed-skillgap.js` (atau `--force`).
import "../env.js";
import { prisma } from "../prisma.js";
import { refreshReadiness } from "../readiness.js";
import { refreshRank } from "../rankcalc.js";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const FIX = join(dirname(fileURLToPath(import.meta.url)), "fixtures", "skillgap.json");

function loadFixture() {
  try { return JSON.parse(readFileSync(FIX, "utf8")); }
  catch { return null; }
}

export async function restoreSkillGap({ force = false } = {}) {
  const fx = loadFixture();
  if (!fx || !Array.isArray(fx.talents) || !fx.talents.length) {
    console.log("Skill-gap fixture tidak ada / kosong - dilewati.");
    return { skipped: true };
  }

  const emails = fx.talents.map((t) => t.email);
  const demo = await prisma.user.findMany({ where: { email: { in: emails } }, select: { id: true, email: true } });
  if (!demo.length) { console.log("Skill-gap: user demo belum ada - dilewati (jalankan setelah seed user)."); return { skipped: true }; }

  // Anti-clobber: kalau sudah ada assessment milik demo user, JANGAN timpa (kecuali force).
  if (!force) {
    const existing = await prisma.skillAssessment.count({ where: { userId: { in: demo.map((u) => u.id) } } });
    if (existing > 0) { console.log(`Skill-gap: sudah ada ${existing} assessment demo - restore dilewati (pakai --force untuk menimpa).`); return { skipped: true }; }
  }

  // 1) Upsert dokumen SKKNI + unit (acuan chosenUnitCodeSet & skill gap; tak perlu Kemnaker).
  for (const doc of fx.documents || []) {
    const data = { ...doc };
    if (data.fetchedAt) data.fetchedAt = new Date(data.fetchedAt);
    if (data.unitsFetchedAt) data.unitsFetchedAt = new Date(data.unitsFetchedAt);
    await prisma.skkniDocument.upsert({ where: { id: doc.id }, create: data, update: data });
  }
  const docIds = [...new Set((fx.units || []).map((u) => u.documentId))];
  for (const id of docIds) await prisma.skkniUnit.deleteMany({ where: { documentId: id } });
  if (fx.units?.length) await prisma.skkniUnit.createMany({ data: fx.units });

  // 2) Restore tiap talenta: kompetensi + SkillAssessment + Certificate + UnitProgress → refresh.
  const byEmail = new Map(demo.map((u) => [u.email, u]));
  for (const t of fx.talents) {
    const u = byEmail.get(t.email);
    if (!u) { console.log("  skip (tak ada):", t.email); continue; }
    const full = await prisma.user.findUnique({ where: { id: u.id }, select: { currentKkniLevel: true } });

    await prisma.user.update({ where: { id: u.id }, data: {
      chosenSkkniId: t.docId, chosenSkkniTitle: t.docTitle,
      ...(t.academicStatus ? { academicStatus: t.academicStatus } : {}),
    } });

    const codes = t.assessments.map((a) => a.competencyCode);
    await prisma.skillAssessment.deleteMany({ where: { userId: u.id, competencyCode: { in: codes } } });
    await prisma.certificate.deleteMany({ where: { userId: u.id, competencyCode: { in: codes }, source: "exam" } });
    await prisma.unitProgress.deleteMany({ where: { userId: u.id, unitCode: { in: codes } } });
    await prisma.examAttempt.deleteMany({ where: { userId: u.id } }).catch(() => {});

    let passed = 0;
    for (const a of t.assessments) {
      const required = a.requiredScore ?? 100;
      const gap = a.gap ?? Math.max(0, required - a.currentScore);
      await prisma.skillAssessment.create({ data: {
        userId: u.id, competencyCode: a.competencyCode, competencyName: a.competencyName,
        currentScore: a.currentScore, requiredScore: required, gap,
      } });
      await prisma.unitProgress.create({ data: { userId: u.id, docId: t.docId, unitCode: a.competencyCode, learned: true, learnedAt: new Date() } });
      if (a.currentScore >= 60) {
        passed++;
        await prisma.certificate.create({ data: { userId: u.id, competencyCode: a.competencyCode, name: a.competencyName, kkniLevel: full?.currentKkniLevel || null, score: a.currentScore, source: "exam" } }).catch(() => {});
      }
    }

    const assessed = t.assessments.length;
    const readiness = assessed ? Math.round((passed / assessed) * 100) : 0;
    await prisma.examAttempt.create({ data: {
      userId: u.id, kkniLevel: full?.currentKkniLevel || 1, answers: "{}", scorePerCompetency: "{}", results: "[]",
      readinessScore: readiness, status: readiness >= 80 ? "ready" : readiness >= 50 ? "in_progress" : "not_ready",
      passed: readiness >= 80, gaps: "[]",
    } }).catch(() => {});

    const rank = await refreshRank(u.id);
    const r = await refreshReadiness(u.id);
    console.log(`  ${t.email}: ${passed}/${assessed} unit lulus, rank L${rank.effective}, kesiapan ${r.total}%`);
  }
  console.log("Skill-gap demo di-restore dari fixture ✓");
  return { skipped: false };
}

// Jalankan standalone bila dipanggil langsung: `node seed/seed-skillgap.js [--force]`.
const invokedDirectly = process.argv[1] && process.argv[1].replace(/\\/g, "/").endsWith("seed/seed-skillgap.js");
if (invokedDirectly) {
  restoreSkillGap({ force: process.argv.includes("--force") })
    .then(() => prisma.$disconnect())
    .catch((e) => { console.error(e); process.exit(1); });
}
