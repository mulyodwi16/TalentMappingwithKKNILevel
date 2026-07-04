import { prisma } from "./prisma.js";

// Bangun profil skill pengguna dari CV (pendidikan, sertifikasi), kompetensi yang lulus,
// dan sertifikat kompetensi. Dipakai untuk mencocokkan dengan kriteria lowongan.
export async function buildSkillProfile(userId) {
  const [u, assessments, certs] = await Promise.all([
    prisma.user.findUnique({ where: { id: userId } }),
    prisma.skillAssessment.findMany({ where: { userId } }),
    prisma.certificate.findMany({ where: { userId } }),
  ]);
  let cvCerts = [];
  try { cvCerts = JSON.parse(u?.certifications || "[]"); } catch { /* ignore */ }

  const skills = new Set();
  assessments.filter((a) => a.currentScore >= 60).forEach((a) => a.competencyName && skills.add(a.competencyName));
  certs.forEach((c) => skills.add(c.name));
  cvCerts.forEach((c) => typeof c === "string" && skills.add(c));
  if (u?.education) skills.add(u.education);

  return {
    level: u?.currentKkniLevel || 0,
    experience: u?.experienceYears || 0,
    skills: [...skills],
    certifications: [...new Set([...cvCerts, ...certs.map((c) => c.name)])],
  };
}

const norm = (s) => String(s || "").toLowerCase().trim();
function has(list, needle) {
  const n = norm(needle);
  if (!n) return false;
  return list.some((s) => { const x = norm(s); return x.includes(n) || n.includes(x); });
}

// Hitung kecocokan profil terhadap sebuah lowongan. Kembalikan skor 0–100 + daftar gap.
export function matchJob(job, profile) {
  const jobSkills = Array.isArray(job.skills) ? job.skills : safeArr(job.skills);
  const jobCerts = Array.isArray(job.certifications) ? job.certifications : safeArr(job.certifications);

  const levelOk = profile.level >= job.kkniLevel;
  const expOk = profile.experience >= job.minExperience;
  const matchedSkills = jobSkills.filter((s) => has(profile.skills, s));
  const missingSkills = jobSkills.filter((s) => !has(profile.skills, s));
  const matchedCerts = jobCerts.filter((c) => has(profile.certifications, c) || has(profile.skills, c));
  const missingCerts = jobCerts.filter((c) => !(has(profile.certifications, c) || has(profile.skills, c)));

  // Bobot: level 30, pengalaman 15, skill 40, sertifikasi 15.
  const wLevel = 30, wExp = 15, wSkill = 40, wCert = 15;
  const skillScore = jobSkills.length ? (matchedSkills.length / jobSkills.length) * wSkill : wSkill;
  const certScore = jobCerts.length ? (matchedCerts.length / jobCerts.length) * wCert : wCert;
  const score = Math.round((levelOk ? wLevel : Math.max(0, wLevel - (job.kkniLevel - profile.level) * 10)) + (expOk ? wExp : (profile.experience / Math.max(1, job.minExperience)) * wExp) + skillScore + certScore);

  return {
    score: Math.max(0, Math.min(100, score)),
    levelOk, expOk,
    levelGap: Math.max(0, job.kkniLevel - profile.level),
    expGap: Math.max(0, job.minExperience - profile.experience),
    matchedSkills, missingSkills, matchedCerts, missingCerts,
    eligible: levelOk && expOk && missingSkills.length === 0,
  };
}

export function safeArr(json) { try { const a = JSON.parse(json || "[]"); return Array.isArray(a) ? a : []; } catch { return []; } }
