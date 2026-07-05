// Backfill sekali-jalan: set academicStatus + rank (min Gold/L3) untuk user demo lama,
// lalu hitung ulang skor kesiapan. Memperbaiki "rank kosong" (#5). Jalankan:
//   node seed/backfill-onboarding.js
import "../env.js";
import { prisma } from "../prisma.js";
import { refreshReadiness } from "../readiness.js";
import { refreshRank } from "../rankcalc.js";

const DEMO = {
  "user@demo.id": "lulusan_s1",   // Budi (patokan) — Video Editing, sudah ada data ujian
  "andi@demo.id": "lulusan_smk",
  "dewi@demo.id": "lulusan_s1",
  "reza@demo.id": "lulusan_s1",
};

for (const [email, academicStatus] of Object.entries(DEMO)) {
  const u = await prisma.user.findUnique({ where: { email } });
  if (!u) { console.log("skip (tidak ada):", email); continue; }
  await prisma.user.update({ where: { id: u.id }, data: { academicStatus } });
  const rank = await refreshRank(u.id);       // rank efektif = seed pendidikan + kompetensi
  const r = await refreshReadiness(u.id);
  console.log(`${email} → ${academicStatus}, rank L${rank.effective} (seed ${rank.seed}, earned ${rank.earned}, mastery ${rank.masteryScore}), kesiapan ${r.total}%`);
}

await prisma.$disconnect();
console.log("Backfill selesai ✓");
