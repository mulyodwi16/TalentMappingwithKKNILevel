import "../env.js";
import bcrypt from "bcryptjs";
import { PrismaClient } from "@prisma/client";
import { restoreSkillGap } from "./seed-skillgap.js";

const prisma = new PrismaClient();
const RESET = process.argv.includes("--reset");

if (RESET) {
  await prisma.$executeRawUnsafe("DELETE FROM AuditLog");
  await prisma.$executeRawUnsafe("DELETE FROM Notification");
  await prisma.$executeRawUnsafe("DELETE FROM Recommendation");
  await prisma.$executeRawUnsafe("DELETE FROM Request");
  await prisma.$executeRawUnsafe("DELETE FROM SkillAssessment");
  await prisma.$executeRawUnsafe("DELETE FROM ExamAttempt");
  await prisma.$executeRawUnsafe("DELETE FROM ExamQuestion");
  await prisma.$executeRawUnsafe("DELETE FROM LearningResource");
  await prisma.$executeRawUnsafe("DELETE FROM MappingRule");
  await prisma.$executeRawUnsafe("DELETE FROM Competency");
  await prisma.$executeRawUnsafe("DELETE FROM KkniLevel");
  await prisma.$executeRawUnsafe("DELETE FROM User");
  console.log("Tables cleared");
}

// ── KKNI Levels ───────────────────────────────────────────────────────────────
const levelCount = await prisma.kkniLevel.count();
if (levelCount === 0) {
  await prisma.kkniLevel.createMany({ data: [
    { level: 1, title: "Operator Dasar", educationMapping: "SD", jobGroup: "Operator",
      descriptors: JSON.stringify({ kemampuanKerja: "Melaksanakan tugas sederhana dan rutin sesuai instruksi", penguasaanPengetahuan: "Pengetahuan umum minimal", kemampuanManajerial: "Tidak ada tanggung jawab manajerial" }) },
    { level: 2, title: "Operator", educationMapping: "SMP", jobGroup: "Operator",
      descriptors: JSON.stringify({ kemampuanKerja: "Menyelesaikan tugas spesifik dengan pengawasan", penguasaanPengetahuan: "Pengetahuan faktual bidang tertentu", kemampuanManajerial: "Bekerja dalam tim dengan pengawasan" }) },
    { level: 3, title: "Operator Terampil", educationMapping: "SMA/SMK", jobGroup: "Operator",
      descriptors: JSON.stringify({ kemampuanKerja: "Menyelesaikan serangkaian tugas spesifik secara mandiri", penguasaanPengetahuan: "Pengetahuan operasional lengkap", kemampuanManajerial: "Bertanggung jawab atas pekerjaan sendiri" }) },
    { level: 4, title: "Teknisi Junior", educationMapping: "D1", jobGroup: "Teknisi/Analis",
      descriptors: JSON.stringify({ kemampuanKerja: "Menyelesaikan tugas berlingkup luas dengan metode tertentu", penguasaanPengetahuan: "Pengetahuan teori & praktis bidang kerja", kemampuanManajerial: "Dapat membimbing pekerja di bawahnya" }) },
    { level: 5, title: "Teknisi", educationMapping: "D2/D3", jobGroup: "Teknisi/Analis",
      descriptors: JSON.stringify({ kemampuanKerja: "Menyelesaikan pekerjaan berlingkup luas, memilih metode yang sesuai", penguasaanPengetahuan: "Penguasaan teori mendalam", kemampuanManajerial: "Bertanggung jawab atas kelompok kerja" }) },
    { level: 6, title: "Analis / Teknisi Ahli", educationMapping: "D4/S1", jobGroup: "Teknisi/Analis",
      descriptors: JSON.stringify({ kemampuanKerja: "Mengaplikasikan bidang keahlian dengan memanfaatkan IPTEK", penguasaanPengetahuan: "Konsep umum & prinsip ilmu pengetahuan", kemampuanManajerial: "Bertanggung jawab atas pekerjaan sendiri & dapat diserahi tanggung jawab kelompok" }) },
    { level: 7, title: "Ahli (Profesi)", educationMapping: "Profesi", jobGroup: "Ahli",
      descriptors: JSON.stringify({ kemampuanKerja: "Merencanakan & mengelola sumber daya dengan tanggung jawab penuh", penguasaanPengetahuan: "Pengetahuan khusus bidang tertentu secara umum & operasional", kemampuanManajerial: "Bertanggung jawab atas profesi sendiri" }) },
    { level: 8, title: "Ahli Spesialis", educationMapping: "S2/Spesialis", jobGroup: "Ahli",
      descriptors: JSON.stringify({ kemampuanKerja: "Mengembangkan pengetahuan & keterampilan pada bidang keahlian tertentu", penguasaanPengetahuan: "Pengetahuan & IPTEK mendalam di bidang tertentu", kemampuanManajerial: "Memimpin & mengembangkan tim" }) },
    { level: 9, title: "Ahli Utama", educationMapping: "S3", jobGroup: "Ahli",
      descriptors: JSON.stringify({ kemampuanKerja: "Mengembangkan pengetahuan baru & teknologi terkini dalam bidang keahlian", penguasaanPengetahuan: "Pengetahuan mutakhir di ranah keilmuan atau praktik profesi", kemampuanManajerial: "Bertanggung jawab atas pengembangan & inovasi organisasi" }) },
  ]});
  console.log("KKNI levels seeded (9)");
}

// ── Competencies ──────────────────────────────────────────────────────────────
const compCount = await prisma.competency.count();
if (compCount === 0) {
  await prisma.competency.createMany({ data: [
    { code: "K3",     name: "Keselamatan & Kesehatan Kerja", category: "Dasar",   skkni: "J.591200.001.01", requiredForLevels: JSON.stringify([3,4,5,6]), targetLevel: 3 },
    { code: "MUTU",   name: "Menerapkan Mutu Produk",        category: "Mutu",    skkni: "J.591200.003.01", requiredForLevels: JSON.stringify([4,5,6]),   targetLevel: 4 },
    { code: "INSTAL", name: "Instalasi Peralatan Editing",   category: "Teknis",  skkni: "J.591200.006.01", requiredForLevels: JSON.stringify([5,6]),     targetLevel: 5 },
    { code: "MATERI", name: "Persiapan Materi & Format",     category: "Teknis",  skkni: "J.591200.007.01", requiredForLevels: JSON.stringify([5,6]),     targetLevel: 5 },
    { code: "EDIT",   name: "Menyunting Audio/Video",        category: "Inti",    skkni: "J.591200.008.01", requiredForLevels: JSON.stringify([6]),       targetLevel: 6 },
    { code: "EXPORT", name: "Export Hasil Editing",          category: "Inti",    skkni: "J.591200.010.01", requiredForLevels: JSON.stringify([6]),       targetLevel: 6 },
  ]});
  console.log("Competencies seeded (6)");
}

// ── Mapping Rules ─────────────────────────────────────────────────────────────
const ruleCount = await prisma.mappingRule.count();
if (ruleCount === 0) {
  await prisma.mappingRule.createMany({ data: [
    { order: 1,  conditions: JSON.stringify({ education: "S3" }),                      predictedLevel: 9 },
    { order: 2,  conditions: JSON.stringify({ education: "S2" }),                      predictedLevel: 8 },
    { order: 3,  conditions: JSON.stringify({ education: "Profesi" }),                 predictedLevel: 7 },
    { order: 4,  conditions: JSON.stringify({ education: "S1" }),                      predictedLevel: 6 },
    { order: 5,  conditions: JSON.stringify({ education: "D4" }),                      predictedLevel: 6 },
    { order: 6,  conditions: JSON.stringify({ education: "D3" }),                      predictedLevel: 5 },
    { order: 7,  conditions: JSON.stringify({ education: "D2" }),                      predictedLevel: 5 },
    { order: 8,  conditions: JSON.stringify({ education: "D1" }),                      predictedLevel: 4 },
    { order: 9,  conditions: JSON.stringify({ education: "SMK", cert: "editing" }),    predictedLevel: 4 },
    { order: 10, conditions: JSON.stringify({ education: "SMK" }),                     predictedLevel: 3 },
    { order: 11, conditions: JSON.stringify({ education: "SMA" }),                     predictedLevel: 3 },
    { order: 12, conditions: JSON.stringify({ education: "SMP" }),                     predictedLevel: 2 },
    { order: 13, conditions: JSON.stringify({ education: "SD" }),                      predictedLevel: 1 },
  ]});
  console.log("Mapping rules seeded (13)");
}

// ── Exam Questions level 6 ────────────────────────────────────────────────────
const qCount = await prisma.examQuestion.count({ where: { kkniLevel: 6 } });
if (qCount === 0) {
  await prisma.examQuestion.createMany({ data: [
    { competencyCode: "K3",     kkniLevel: 6, question: "APD wajib di ruang editing termasuk?",
      options: JSON.stringify(["Grounding & sirkulasi udara", "Helm proyek", "Sepatu boot", "Rompi las"]), answerKey: 0 },
    { competencyCode: "K3",     kkniLevel: 6, question: "Tujuan utama K3 di tempat kerja adalah?",
      options: JSON.stringify(["Meningkatkan produktivitas", "Mencegah kecelakaan & penyakit kerja", "Mengurangi biaya produksi", "Meningkatkan kualitas output"]), answerKey: 1 },
    { competencyCode: "MUTU",   kkniLevel: 6, question: "Kontrol mutu output video mengecek?",
      options: JSON.stringify(["Warna baju editor", "Level audio & color consistency", "Merk komputer", "Suhu ruangan saja"]), answerKey: 1 },
    { competencyCode: "MUTU",   kkniLevel: 6, question: "Bitrate tinggi pada video berarti?",
      options: JSON.stringify(["File lebih kecil", "Kualitas lebih rendah", "Kualitas lebih tinggi & file lebih besar", "Tidak ada perbedaan"]), answerKey: 2 },
    { competencyCode: "INSTAL", kkniLevel: 6, question: "Sebelum instalasi video player, pastikan?",
      options: JSON.stringify(["Kompatibilitas driver & codec", "Warna kabel", "Jumlah monitor genap", "Merk mouse"]), answerKey: 0 },
    { competencyCode: "MATERI", kkniLevel: 6, question: "Menyiapkan materi sesuai format berarti?",
      options: JSON.stringify(["Menyamakan resolusi/framerate/codec", "Menghapus semua audio", "Selalu 4K", "Abaikan aspect ratio"]), answerKey: 0 },
    { competencyCode: "MATERI", kkniLevel: 6, question: "Frame rate 25fps paling umum digunakan untuk?",
      options: JSON.stringify(["Film bioskop", "Broadcast PAL (Indonesia/Eropa)", "Animasi game", "Foto still"]), answerKey: 1 },
    { competencyCode: "EDIT",   kkniLevel: 6, question: "Teknik dasar menyambung 2 klip disebut?",
      options: JSON.stringify(["Render", "Cut/transition", "Export", "Ingest"]), answerKey: 1 },
    { competencyCode: "EDIT",   kkniLevel: 6, question: "J-cut adalah?",
      options: JSON.stringify(["Audio mendahului video", "Video tanpa audio", "Efek warna", "Format file"]), answerKey: 0 },
    { competencyCode: "EDIT",   kkniLevel: 6, question: "Color grading bertujuan untuk?",
      options: JSON.stringify(["Menghapus noise audio", "Menyesuaikan tampilan warna & suasana visual", "Mempercepat render", "Mengompres file"]), answerKey: 1 },
    { competencyCode: "EXPORT", kkniLevel: 6, question: "Untuk broadcast TV, export umumnya?",
      options: JSON.stringify(["GIF", "H.264/MXF sesuai spec stasiun", "Screenshot", "ZIP"]), answerKey: 1 },
    { competencyCode: "EXPORT", kkniLevel: 6, question: "Codec H.265 (HEVC) dibanding H.264?",
      options: JSON.stringify(["Kualitas lebih rendah", "File lebih besar", "Kompresi lebih efisien, kualitas sama", "Tidak didukung platform modern"]), answerKey: 2 },
  ]});
  console.log("Exam questions seeded (level 6)");
}

// ── Exam Questions level 1-5 ──────────────────────────────────────────────────
const qCountLow = await prisma.examQuestion.count({ where: { kkniLevel: { lt: 6 } } });
if (qCountLow === 0) {
  await prisma.examQuestion.createMany({ data: [
    { competencyCode: "K3", kkniLevel: 1, question: "Jika melihat tumpahan cairan di lantai kerja, tindakan pertama adalah?",
      options: JSON.stringify(["Biarkan saja", "Segera bersihkan agar tidak licin", "Tutup dengan karpet", "Pasang tanda & laporkan ke atasan"]), answerKey: 3 },
    { competencyCode: "K3", kkniLevel: 1, question: "Alat Pelindung Diri (APD) digunakan untuk?",
      options: JSON.stringify(["Memperindah penampilan", "Melindungi diri dari bahaya kerja", "Membedakan jabatan", "Mempercepat pekerjaan"]), answerKey: 1 },
    { competencyCode: "K3", kkniLevel: 2, question: "Prosedur kerja adalah?",
      options: JSON.stringify(["Cara berpakaian di tempat kerja", "Langkah-langkah yang harus diikuti saat bekerja", "Jadwal istirahat", "Peraturan gaji"]), answerKey: 1 },
    { competencyCode: "K3", kkniLevel: 2, question: "Jika terjadi kebakaran kecil, langkah pertama adalah?",
      options: JSON.stringify(["Langsung kabur", "Gunakan APAR (alat pemadam api ringan)", "Panggil pemadam kebakaran dulu", "Siram dengan air seadanya"]), answerKey: 1 },
    { competencyCode: "K3", kkniLevel: 3, question: "Simbol bahaya segitiga kuning di tempat kerja berarti?",
      options: JSON.stringify(["Area parkir", "Peringatan bahaya/potensi risiko", "Pintu darurat", "Toilet"]), answerKey: 1 },
    { competencyCode: "K3", kkniLevel: 3, question: "Hazard identification bertujuan untuk?",
      options: JSON.stringify(["Menilai kinerja karyawan", "Mengidentifikasi potensi bahaya sebelum terjadi kecelakaan", "Menghitung gaji lembur", "Membuat laporan bulanan"]), answerKey: 1 },
    { competencyCode: "K3", kkniLevel: 4, question: "Risk assessment dalam K3 mencakup?",
      options: JSON.stringify(["Identifikasi bahaya, penilaian risiko, pengendalian risiko", "Hanya identifikasi bahaya", "Hanya pengendalian risiko", "Membuat jadwal kerja"]), answerKey: 0 },
    { competencyCode: "MUTU", kkniLevel: 4, question: "Quality control pada proses produksi bertujuan?",
      options: JSON.stringify(["Mempercepat produksi saja", "Memastikan produk memenuhi standar yang ditetapkan", "Mengurangi jumlah karyawan", "Meningkatkan jam kerja"]), answerKey: 1 },
    { competencyCode: "K3", kkniLevel: 5, question: "Sistem Manajemen K3 (SMK3) diatur dalam?",
      options: JSON.stringify(["UU No. 1 Tahun 1970 & PP No. 50 Tahun 2012", "UU No. 13 Tahun 2003 saja", "Peraturan Menteri Keuangan", "Perpres No. 8 Tahun 2012"]), answerKey: 0 },
    { competencyCode: "MUTU", kkniLevel: 5, question: "ISO 9001 adalah standar internasional untuk?",
      options: JSON.stringify(["Keselamatan produk", "Sistem manajemen mutu (quality management system)", "Standar lingkungan hidup", "Standar keuangan"]), answerKey: 1 },
  ]});
  console.log("Exam questions seeded (level 1-5, 10 soal)");
}

// ── Learning Resources ────────────────────────────────────────────────────────
const resCount = await prisma.learningResource.count();
if (resCount === 0) {
  await prisma.learningResource.createMany({ data: [
    { title: "Dasar-Dasar K3 Tempat Kerja", type: "course", competencyCode: "K3", level: 3, provider: "Kemnaker RI", description: "Panduan keselamatan kerja sesuai standar nasional", duration: "4 jam" },
    { title: "Adobe Premiere Pro: Complete Guide", type: "video", competencyCode: "EDIT", level: 6, provider: "Udemy", url: "https://www.udemy.com", description: "Belajar editing profesional dari nol", duration: "20 jam" },
    { title: "DaVinci Resolve Color Grading", type: "video", competencyCode: "EDIT", level: 6, provider: "YouTube", description: "Color grading & correction untuk video editor", duration: "8 jam" },
    { title: "Video Export & Delivery Standards", type: "article", competencyCode: "EXPORT", level: 6, provider: "No Film School", description: "Panduan export video untuk berbagai platform & broadcast", duration: "1 jam" },
    { title: "Sertifikasi BNSP Video Editor", type: "certification", competencyCode: "EDIT", level: 6, provider: "BNSP", description: "Uji kompetensi resmi SKKNI J.591200", duration: "2 hari" },
    { title: "Manajemen Mutu Produksi Video", type: "course", competencyCode: "MUTU", level: 4, provider: "Coursera", description: "Kontrol kualitas dalam produksi konten digital", duration: "6 jam" },
    { title: "Setup Workstation Video Editing", type: "video", competencyCode: "INSTAL", level: 5, provider: "Linus Tech Tips", description: "Instalasi & optimasi workstation untuk editing video berat", duration: "3 jam" },
    { title: "Memahami Format & Codec Video", type: "article", competencyCode: "MATERI", level: 5, provider: "Videomaker", description: "Panduan lengkap format video, codec, resolusi, dan framerate", duration: "2 jam" },
  ]});
  console.log("Learning resources seeded (8)");
}

// ── Demo Users ────────────────────────────────────────────────────────────────
const userCount = await prisma.user.count();
if (userCount === 0) {
  const hash = (p) => bcrypt.hashSync(p, 10);
  await prisma.user.createMany({ data: [
    { name: "Budi Editor",    email: "user@demo.id",  passwordHash: hash("demo123"), role: "user",  department: "Produksi",  position: "Video Editor",        education: "S1",  certifications: JSON.stringify(["Adobe Premiere Pro", "DaVinci Resolve"]), experienceYears: 3 },
    { name: "Siti HRD",       email: "hrd@demo.id",   passwordHash: hash("demo123"), role: "hrd",   department: "HRD",       position: "HR Manager",           certifications: "[]" },
    { name: "Admin Sistem",   email: "admin@demo.id", passwordHash: hash("demo123"), role: "admin", department: "IT",        position: "System Administrator", certifications: "[]" },
    { name: "Andi Sinema",    email: "andi@demo.id",  passwordHash: hash("demo123"), role: "user",  department: "Produksi",  position: "Junior Editor",        education: "SMK", certifications: JSON.stringify(["editing"]), experienceYears: 1, currentKkniLevel: 3, readinessScore: 40, status: "not_ready" },
    { name: "Dewi Kreatif",   email: "dewi@demo.id",  passwordHash: hash("demo123"), role: "user",  department: "Marketing", position: "Content Creator",      education: "D3",  certifications: JSON.stringify(["Adobe Premiere"]), experienceYears: 2, currentKkniLevel: 5, readinessScore: 65, status: "in_progress" },
    { name: "Reza Sutradara", email: "reza@demo.id",  passwordHash: hash("demo123"), role: "user",  department: "Produksi",  position: "Senior Editor",        education: "S1",  certifications: JSON.stringify(["Adobe Premiere Pro", "After Effects", "DaVinci Resolve"]), experienceYears: 5, currentKkniLevel: 6, readinessScore: 90, status: "ready" },
  ]});
  console.log("Users seeded (6: 3 demo + 3 workers)");
}

// Bahan Skill Gap demo (radar/gap/learning path) dari fixture — hanya mengisi bila DB fresh
// (anti-clobber di dalam restoreSkillGap), agar clone baru tidak menampilkan Skill Gap kosong.
try { await restoreSkillGap(); } catch (e) { console.error("Skill-gap restore gagal (non-fatal):", e.message); }

await prisma.$disconnect();
console.log("Seed selesai ✓");
