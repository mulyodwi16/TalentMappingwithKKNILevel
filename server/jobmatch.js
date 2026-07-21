import { prisma } from "./prisma.js";
import { UNIT_MASTERY } from "./thresholds.js";
import { chatComplete, isLlmConfigured } from "./llm.js";

// Profil skill pengguna untuk mencocokkan dengan kriteria posisi (Peta Posisi).
// PENTING (#5): pisahkan skill yang TERVALIDASI (lulus ujian / sertifikat proyek ini)
// dari yang hanya DIKLAIM (CV, portofolio, pendidikan). Klaim TIDAK dianggap memenuhi
// kompetensi sampai divalidasi lewat ujian - ini menjaga rank/kesiapan tetap terbukti.
export async function buildSkillProfile(userId) {
  const [u, assessments, certs, claims] = await Promise.all([
    prisma.user.findUnique({ where: { id: userId } }),
    prisma.skillAssessment.findMany({ where: { userId } }),
    prisma.certificate.findMany({ where: { userId } }),
    prisma.skillClaim.findMany({ where: { userId, aiDetected: true } }).catch(() => []),
  ]);
  let cvCerts = [];
  try { cvCerts = JSON.parse(u?.certifications || "[]"); } catch { /* ignore */ }
  let cvMeta = {};
  try { cvMeta = JSON.parse(u?.cvMeta || "{}"); } catch { /* ignore */ }

  // TERVALIDASI: unit lulus (skor≥60) + sertifikat hasil ujian proyek ini.
  const validated = new Set();
  assessments.filter((a) => a.currentScore >= UNIT_MASTERY).forEach((a) => a.competencyName && validated.add(a.competencyName));
  certs.forEach((c) => validated.add(c.name));

  // DIKLAIM (belum tervalidasi): sertifikasi/keahlian dari CV + sertifikat tambahan + klaim portofolio.
  const claimed = new Set();
  cvCerts.forEach((c) => typeof c === "string" && claimed.add(c));
  (cvMeta.skills || []).forEach((s) => typeof s === "string" && claimed.add(s));
  (cvMeta.extraCertifications || []).forEach((c) => c?.name && claimed.add(c.name));
  claims.forEach((c) => c.skill && claimed.add(c.skill));

  return {
    level: u?.currentKkniLevel || 0,
    experience: u?.experienceYears || 0,
    validatedSkills: [...validated],
    claimedSkills: [...claimed].filter((s) => !validated.has(s)),
    // gabungan (kompat lama)
    skills: [...new Set([...validated, ...claimed])],
    certifications: [...new Set([...cvCerts, ...certs.map((c) => c.name)])],
  };
}

const norm = (s) => String(s || "").toLowerCase().trim();

// Kata umum yang tak membedakan apa pun - kalau ikut dihitung, hampir semua unit SKKNI
// akan terlihat "cocok" dengan hampir semua syarat posisi.
const STOP = new Set([
  "melakukan", "melaksanakan", "menerapkan", "menguasai", "mampu", "dapat", "bisa", "membuat",
  "dengan", "yang", "dan", "atau", "untuk", "pada", "sesuai", "dalam", "serta", "dari", "hasil",
  "able", "with", "and", "the", "for", "from", "using",
]);
const tokens = (s) => norm(s).split(/[^a-z0-9]+/).filter((w) => w.length >= 4 && !STOP.has(w));

// Nama unit SKKNI berupa kalimat panjang ("Menyunting audio dan atau video sesuai tuntutan
// naskah"), sedangkan HRD menulis syarat singkat ("Menyunting Audio/Video"). Pencocokan
// substring utuh saja MELEWATKAN pasangan itu - kompetensi yang sudah dibuktikan pengguna
// terbaca sebagai "belum ada bukti". Maka dicocokkan juga per kata penting.
function similar(candidate, needle) {
  const c = norm(candidate);
  const n = norm(needle);
  if (!c || !n) return false;
  if (c.includes(n) || n.includes(c)) return true;
  const nt = tokens(n);
  if (!nt.length) return false;
  const hit = nt.filter((w) => c.includes(w)).length;
  // Satu kata kunci harus tepat; lebih dari itu boleh meleset sebagian (min. 2 kata cocok).
  return nt.length === 1 ? hit === 1 : hit >= 2 && hit / nt.length >= 0.7;
}

function has(list, needle) {
  if (!norm(needle)) return false;
  return list.some((s) => similar(s, needle));
}

// Hitung kecocokan profil terhadap sebuah posisi. Skor 0–100 + rincian per-skill.
// Skill dipilah 3: matched (tervalidasi ujian), claimed (terdeteksi CV/portofolio - perlu ujian), missing.
export function matchJob(job, profile) {
  const jobSkills = Array.isArray(job.skills) ? job.skills : safeArr(job.skills);
  const jobCerts = Array.isArray(job.certifications) ? job.certifications : safeArr(job.certifications);
  const validated = profile.validatedSkills || profile.skills || [];
  const claimedList = profile.claimedSkills || [];

  const levelOk = profile.level >= job.kkniLevel;
  const expOk = profile.experience >= job.minExperience;

  const matchedSkills = jobSkills.filter((s) => has(validated, s));               // tervalidasi ujian
  const claimedSkills = jobSkills.filter((s) => !has(validated, s) && has(claimedList, s)); // klaim CV/portofolio
  const missingSkills = jobSkills.filter((s) => !has(validated, s) && !has(claimedList, s)); // belum ada bukti

  const matchedCerts = jobCerts.filter((c) => has(profile.certifications, c) || has(validated, c));
  const missingCerts = jobCerts.filter((c) => !(has(profile.certifications, c) || has(validated, c)));

  // Bobot: level 30, pengalaman 15, skill 40, sertifikasi 15.
  // Skill: tervalidasi = poin penuh, diklaim = SETENGAH (belum divalidasi ujian).
  //
  // Syarat yang TIDAK dicantumkan posisi TIDAK diberi poin gratis, melainkan dikeluarkan dari
  // pembagi. Dulu posisi tanpa daftar skill memberi 40 poin cuma-cuma (dan 15 lagi bila tanpa
  // syarat sertifikat), sehingga SELURUH talenta yang levelnya cukup terbaca 85-100% dan
  // "memenuhi syarat" - corong, ekspor, dan teks undangan semuanya ikut salah.
  const parts = [
    { w: 30, ratio: levelOk ? 1 : Math.max(0, 1 - (job.kkniLevel - profile.level) / 3) },
    { w: 15, ratio: expOk ? 1 : Math.min(1, profile.experience / Math.max(1, job.minExperience)) },
  ];
  if (jobSkills.length) parts.push({ w: 40, ratio: (matchedSkills.length + claimedSkills.length * 0.5) / jobSkills.length });
  if (jobCerts.length) parts.push({ w: 15, ratio: matchedCerts.length / jobCerts.length });
  const totalW = parts.reduce((a, p) => a + p.w, 0);
  const score = Math.round((parts.reduce((a, p) => a + p.w * p.ratio, 0) / totalW) * 100);

  // Posisi tanpa satu pun syarat skill tak bisa dinilai kelayakannya - menyebut semua orang
  // "memenuhi syarat" jauh lebih merugikan daripada mengaku datanya belum lengkap.
  const requirementsSet = jobSkills.length > 0;

  return {
    score: Math.max(0, Math.min(100, score)),
    levelOk, expOk,
    levelGap: Math.max(0, job.kkniLevel - profile.level),
    expGap: Math.max(0, job.minExperience - profile.experience),
    matchedSkills, claimedSkills, missingSkills, matchedCerts, missingCerts,
    requirementsSet,
    // ELIGIBLE hanya bila skill TERVALIDASI ujian menutupi semua syarat (klaim CV tak cukup).
    eligible: requirementsSet && levelOk && expOk && missingSkills.length === 0 && claimedSkills.length === 0,
    // "siap divalidasi": tinggal ujian untuk skill yang sudah diklaim.
    readyToValidate: requirementsSet && levelOk && expOk && missingSkills.length === 0 && claimedSkills.length > 0,
  };
}

export function safeArr(json) { try { const a = JSON.parse(json || "[]"); return Array.isArray(a) ? a : []; } catch { return []; } }

// ── Deteksi bukti skill dari CV + portofolio (Peta Posisi #5) ────────────────
// AI membaca ringkasan CV pengguna + deskripsi/tautan portofolio yang dikirim,
// lalu menilai apakah ADA indikasi kuat penguasaan `skill`. Hasil ini HANYA "klaim
// terdeteksi" - bukan validasi kompetensi (validasi tetap dari lulus ujian).
function heuristicDetect(skill, cvText, detail) {
  const hay = `${cvText} ${detail || ""}`.toLowerCase();
  const k = String(skill || "").toLowerCase();
  const hit = k && (hay.includes(k) || k.split(/\s+/).some((w) => w.length > 3 && hay.includes(w)));
  const enough = (detail || "").trim().length >= 20;
  const detected = hit && enough;
  return {
    detected,
    note: detected
      ? "Terindikasi dari CV/portofolio (deteksi kata kunci)."
      : enough ? "Belum ada indikasi kuat skill ini di CV/portofolio." : "Deskripsi portofolio terlalu singkat untuk dinilai.",
  };
}

export async function detectSkillEvidence({ skill, cvMeta, detail }) {
  const cv = cvMeta || {};
  const links = cv.links || {};
  const linkText = [links.linkedin && `LinkedIn: ${links.linkedin}`, links.instagram && `Instagram: ${links.instagram}`,
    links.portfolio && `Portofolio: ${links.portfolio}`, links.other && `Lain: ${links.other}`].filter(Boolean).join(" · ");
  const cvText = [
    cv.education, `pengalaman ${cv.experienceYears || 0} tahun`,
    ...(cv.skills || []), ...(cv.certifications || []),
    ...((cv.extraCertifications || []).map((c) => `${c.name}${c.issuer ? ` (${c.issuer})` : ""}`)),
    linkText,
  ].filter(Boolean).join(", ");

  if (!isLlmConfigured()) return heuristicDetect(skill, cvText, detail);

  const sys = {
    role: "system",
    content:
      `Kamu penilai bukti kompetensi di platform karier TalentaAI. Diberi RINGKASAN CV + DESKRIPSI PORTOFOLIO, ` +
      `nilai apakah ada INDIKASI KUAT & RELEVAN bahwa pengguna menguasai skill target. ` +
      `Bersikap KRITIS: klaim umum/tanpa bukti konkret = tidak terdeteksi. ` +
      `Ingat, ini hanya deteksi klaim awal - validasi sebenarnya lewat ujian, jadi jangan terlalu longgar. ` +
      `Balas HANYA JSON: {"detected":true|false,"confidence":0-100,"note":"1 kalimat alasan singkat (Indonesia)"}.`,
  };
  const usr = {
    role: "user",
    content:
      `SKILL TARGET: ${skill}\n\n` +
      `RINGKASAN CV: ${cvText || "(kosong)"}\n\n` +
      `DESKRIPSI/PORTOFOLIO YANG DIKIRIM: ${detail || "(tidak ada)"}`,
  };
  try {
    const r = await chatComplete([sys, usr], { temperature: 0.2, maxTokens: 300 });
    const m = r.content.match(/\{[\s\S]*\}/);
    const j = m ? JSON.parse(m[0]) : {};
    const detected = j.detected === true && (Number(j.confidence) || 0) >= 55;
    return { detected, confidence: Number(j.confidence) || 0, note: String(j.note || "").slice(0, 240) || (detected ? "Terdeteksi." : "Tidak terdeteksi.") };
  } catch {
    return heuristicDetect(skill, cvText, detail);
  }
}
