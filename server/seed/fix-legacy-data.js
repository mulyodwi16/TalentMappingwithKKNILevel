import fs from "fs";
import path from "path";
import { prisma } from "../prisma.js";
import { refreshReadiness } from "../readiness.js";
import { refreshRank } from "../rankcalc.js";

// Pembersihan data lama yang tidak lagi sah di model penilaian baru (Fase 14).
// Jalankan: node seed/fix-legacy-data.js [--tulis]
// Tanpa --tulis hanya melaporkan (aman untuk dilihat dulu).
//
// 1) SERTIFIKAT PER UNIT. Dulu tiap unit yang lulus menerbitkan sertifikat sendiri. Sekarang
//    sertifikat HANYA satu per kompetensi, terbit dari Ujian Kompetensi Utama (source
//    "competency"). Sertifikat lama menjanjikan sesuatu yang tak lagi berlaku, jadi dihapus -
//    isinya dicadangkan dulu ke berkas JSON supaya tetap bisa ditelusuri.
//    Penguasaan unit TIDAK ikut hilang: itu tersimpan di SkillAssessment, bukan di sertifikat.
// 2) TARGET RANK DI LUAR BATAS KOMPETENSI. Tiap kompetensi punya bobot (weightMaxRank) -
//    Video Editing mentok di Diamond (6). Target Legend (9) mustahil dicapai lewat kompetensi
//    itu, dan bikin mentor menyuruh pengguna mengejar sesuatu yang tak akan pernah tercapai.
//    Target dipangkas ke batas kompetensinya; melampaui itu butuh bukti eksternal.

const WRITE = process.argv.includes("--tulis");
const say = (...a) => console.log(...a);

const backupDir = path.join(process.cwd(), "backup");
const stamp = new Date().toISOString().replace(/[:.]/g, "-");

async function bersihkanSertifikatLama() {
  const rows = await prisma.certificate.findMany({ where: { source: { not: "competency" } } });
  say(`\n[1] Sertifikat lama (bukan "competency"): ${rows.length}`);
  if (!rows.length) return new Set();

  const perSumber = rows.reduce((m, c) => ({ ...m, [c.source]: (m[c.source] || 0) + 1 }), {});
  say("    per sumber:", Object.entries(perSumber).map(([k, v]) => `${k}=${v}`).join(", "));

  const userIds = new Set(rows.map((r) => r.userId));
  if (!WRITE) { say("    (mode lihat saja - tidak dihapus)"); return userIds; }

  if (!fs.existsSync(backupDir)) fs.mkdirSync(backupDir, { recursive: true });
  const file = path.join(backupDir, `certificates-legacy-${stamp}.json`);
  fs.writeFileSync(file, JSON.stringify(rows, null, 2));
  say(`    dicadangkan ke ${file}`);

  const del = await prisma.certificate.deleteMany({ where: { source: { not: "competency" } } });
  say(`    dihapus: ${del.count}`);
  return userIds;
}

async function rapikanTargetRank() {
  const users = await prisma.user.findMany({
    where: { targetKkniLevel: { not: null }, chosenSkkniId: { not: null } },
    select: { id: true, email: true, targetKkniLevel: true, currentKkniLevel: true, chosenSkkniId: true },
  });
  const docs = await prisma.skkniDocument.findMany({
    where: { id: { in: [...new Set(users.map((u) => u.chosenSkkniId))] } },
    select: { id: true, title: true, weightMaxRank: true },
  });
  const capOf = Object.fromEntries(docs.map((d) => [d.id, d.weightMaxRank]));
  const titleOf = Object.fromEntries(docs.map((d) => [d.id, d.title]));

  const nakal = users.filter((u) => capOf[u.chosenSkkniId] && u.targetKkniLevel > capOf[u.chosenSkkniId]);
  say(`\n[2] Target rank melampaui batas kompetensi: ${nakal.length}`);
  for (const u of nakal) {
    const cap = capOf[u.chosenSkkniId];
    say(`    ${u.email}: target ${u.targetKkniLevel} → ${cap} (batas "${titleOf[u.chosenSkkniId]}")`);
    if (WRITE) await prisma.user.update({ where: { id: u.id }, data: { targetKkniLevel: cap } });
  }
  return new Set(nakal.map((u) => u.id));
}

async function main() {
  const a = await bersihkanSertifikatLama();
  const b = await rapikanTargetRank();

  const perlu = new Set([...a, ...b]);
  say(`\n[3] Hitung ulang rank & kesiapan: ${perlu.size} pengguna`);
  if (WRITE) {
    for (const id of perlu) {
      await refreshRank(id).catch(() => {});
      await refreshReadiness(id).catch(() => {});
    }
    say("    selesai");
  } else {
    say("    (mode lihat saja)");
  }

  say(WRITE ? "\nPerubahan DITULIS." : "\nTidak ada yang diubah. Jalankan ulang dengan --tulis untuk menerapkan.");
  await prisma.$disconnect();
}

main().catch(async (e) => { console.error(e); await prisma.$disconnect(); process.exit(1); });
