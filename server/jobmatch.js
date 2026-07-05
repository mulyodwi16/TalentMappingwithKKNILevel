import { prisma } from "./prisma.js";
import { chatComplete, isLlmConfigured } from "./llm.js";

// Profil skill pengguna untuk mencocokkan dengan kriteria posisi (Peta Posisi).
// PENTING (#5): pisahkan skill yang TERVALIDASI (lulus ujian / sertifikat proyek ini)
// dari yang hanya DIKLAIM (CV, portofolio, pendidikan). Klaim TIDAK dianggap memenuhi
// kompetensi sampai divalidasi lewat ujian — ini menjaga rank/kesiapan tetap terbukti.
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
  assessments.filter((a) => a.currentScore >= 60).forEach((a) => a.competencyName && validated.add(a.competencyName));
  certs.forEach((c) => validated.add(c.name));

  // DIKLAIM (belum tervalidasi): sertifikasi/keahlian dari CV + klaim portofolio terdeteksi AI.
  const claimed = new Set();
  cvCerts.forEach((c) => typeof c === "string" && claimed.add(c));
  (cvMeta.skills || []).forEach((s) => typeof s === "string" && claimed.add(s));
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
function has(list, needle) {
  const n = norm(needle);
  if (!n) return false;
  return list.some((s) => { const x = norm(s); return x.includes(n) || n.includes(x); });
}

// Hitung kecocokan profil terhadap sebuah posisi. Skor 0–100 + rincian per-skill.
// Skill dipilah 3: matched (tervalidasi ujian), claimed (terdeteksi CV/portofolio — perlu ujian), missing.
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
  const wLevel = 30, wExp = 15, wSkill = 40, wCert = 15;
  const skillScore = jobSkills.length
    ? ((matchedSkills.length + claimedSkills.length * 0.5) / jobSkills.length) * wSkill
    : wSkill;
  const certScore = jobCerts.length ? (matchedCerts.length / jobCerts.length) * wCert : wCert;
  const score = Math.round(
    (levelOk ? wLevel : Math.max(0, wLevel - (job.kkniLevel - profile.level) * 10)) +
    (expOk ? wExp : (profile.experience / Math.max(1, job.minExperience)) * wExp) +
    skillScore + certScore
  );

  return {
    score: Math.max(0, Math.min(100, score)),
    levelOk, expOk,
    levelGap: Math.max(0, job.kkniLevel - profile.level),
    expGap: Math.max(0, job.minExperience - profile.experience),
    matchedSkills, claimedSkills, missingSkills, matchedCerts, missingCerts,
    // ELIGIBLE hanya bila skill TERVALIDASI ujian menutupi semua syarat (klaim CV tak cukup).
    eligible: levelOk && expOk && missingSkills.length === 0 && claimedSkills.length === 0,
    // "siap divalidasi": tinggal ujian untuk skill yang sudah diklaim.
    readyToValidate: levelOk && expOk && missingSkills.length === 0 && claimedSkills.length > 0,
  };
}

export function safeArr(json) { try { const a = JSON.parse(json || "[]"); return Array.isArray(a) ? a : []; } catch { return []; } }

// ── Deteksi bukti skill dari CV + portofolio (Peta Posisi #5) ────────────────
// AI membaca ringkasan CV pengguna + deskripsi/tautan portofolio yang dikirim,
// lalu menilai apakah ADA indikasi kuat penguasaan `skill`. Hasil ini HANYA "klaim
// terdeteksi" — bukan validasi kompetensi (validasi tetap dari lulus ujian).
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
  const cvText = [
    cv.education, `pengalaman ${cv.experienceYears || 0} tahun`,
    ...(cv.skills || []), ...(cv.certifications || []),
  ].filter(Boolean).join(", ");

  if (!isLlmConfigured()) return heuristicDetect(skill, cvText, detail);

  const sys = {
    role: "system",
    content:
      `Kamu penilai bukti kompetensi di platform karier TalentaAI. Diberi RINGKASAN CV + DESKRIPSI PORTOFOLIO, ` +
      `nilai apakah ada INDIKASI KUAT & RELEVAN bahwa pengguna menguasai skill target. ` +
      `Bersikap KRITIS: klaim umum/tanpa bukti konkret = tidak terdeteksi. ` +
      `Ingat, ini hanya deteksi klaim awal — validasi sebenarnya lewat ujian, jadi jangan terlalu longgar. ` +
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
