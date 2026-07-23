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

// ── Jembatan AI: syarat posisi vs unit yang SUDAH dibuktikan ─────────────────
// `similar()` di atas hanya melihat KATA. Nama unit SKKNI ditulis sebagai kalimat prosedural
// ("Menerapkan prinsip kerja sama dalam tim") sedangkan syarat posisi ditulis sebagai istilah
// pasar ("Bisa bekerjasama dalam tim") - maknanya sama, katanya tidak cukup beririsan, dan
// pengguna melihat "belum ada bukti" untuk sesuatu yang sudah dia lulusi.
//
// Maka: cocokkan deterministik DULU, dan HANYA sisanya yang ditanyakan ke AI.
//
// INVARIAN YANG TIDAK BOLEH GOYAH: ini bukan jalan pintas menuju "kompetensi tanpa ujian".
// Buktinya tetap unit yang LULUS UJIAN - AI hanya menjembatani perbedaan istilah. Karena itu
// AI WAJIB menyebut unit mana yang menutupi, dan jawabannya DIVERIFIKASI ulang di sini: unit
// yang disebut harus benar-benar ada di daftar tervalidasi. Kalau AI mengarang nama unit,
// jawabannya dibuang. Tanpa penjagaan ini, satu halusinasi langsung menaikkan skor kecocokan.
const NEGATIF = { covered: false, unit: null, note: "" };

// Sidik jari daftar unit tervalidasi - dipakai sebagai bagian kunci cache supaya hasilnya
// otomatis kedaluwarsa begitu pengguna lulus unit baru.
function fingerprint(list) {
  return list.map((s) => norm(s)).sort().join("|");
}

// Cache HANYA di memori: hasilnya turunan dari data yang bisa berubah, dan menyimpannya di
// basis data berarti menambah tabel yang harus diinvalidasi sendiri. Konsekuensi jujurnya -
// cache hilang saat server restart, jadi pembukaan pertama sesudah deploy memanggil AI lagi.
const jembatanCache = new Map();
const CACHE_MAX = 500;

function cacheSet(key, val) {
  if (jembatanCache.size >= CACHE_MAX) jembatanCache.delete(jembatanCache.keys().next().value);
  jembatanCache.set(key, val);
}

// Panggilan LLM sungguhan. Kembalikan array mentah hasil parse (atau lempar bila LLM mati /
// balasannya bukan JSON) - `bridgeMissingSkills` yang memvalidasi isinya.
async function defaultAsk(validated, perlu, lang) {
  if (!isLlmConfigured()) throw new Error("LLM tak terkonfigurasi");
  const r = await chatComplete([{ role: "user", content: PROMPT[lang === "en" ? "en" : "id"](validated, perlu) }],
    { temperature: 0.1, maxTokens: 180 * perlu.length + 400 });
  const m = r.content.match(/\[[\s\S]*\]/);
  return JSON.parse(m ? m[0] : r.content);
}

const PROMPT = {
  id: (units, reqs) =>
    `Kamu penilai kesetaraan kompetensi di TalentaAI. Pengguna sudah LULUS UJIAN untuk unit-unit ` +
    `kompetensi SKKNI berikut (nama resminya panjang & formal):\n${units.map((u, i) => `${i + 1}. ${u}`).join("\n")}\n\n` +
    `Perekrut menulis syarat posisi dengan bahasa pasar yang lebih singkat. Untuk TIAP syarat di bawah, ` +
    `tentukan apakah salah satu unit di atas SUDAH mencakup maksudnya.\n` +
    `SYARAT:\n${reqs.map((s, i) => `${i + 1}. ${s}`).join("\n")}\n\n` +
    `Aturan: bersikap KRITIS. Cocokkan MAKSUD pekerjaannya, bukan kemiripan kata. Alat/aplikasi ` +
    `spesifik (mis. "menguasai Adobe Premiere") TIDAK tercakup oleh unit umum tentang menyunting video. ` +
    `Kalau ragu, jawab tidak tercakup - lebih baik pengguna diminta membuktikan daripada diberi ` +
    `pengakuan palsu.\n` +
    `Balas HANYA JSON array: [{"syarat":"<salin persis>","unit":"<salin PERSIS nama unit dari daftar, atau null>","alasan":"<1 kalimat singkat>"}]`,
  en: (units, reqs) =>
    `You assess competency equivalence for TalentaAI. The user has PASSED EXAMS for these Indonesian ` +
    `SKKNI competency units (their official names are long and formal):\n${units.map((u, i) => `${i + 1}. ${u}`).join("\n")}\n\n` +
    `Recruiters phrase job requirements in shorter market language. For EACH requirement below, decide ` +
    `whether one of the units above already covers what it means.\n` +
    `REQUIREMENTS:\n${reqs.map((s, i) => `${i + 1}. ${s}`).join("\n")}\n\n` +
    `Rules: be STRICT. Match the work being described, not word similarity. A specific tool or app ` +
    `(e.g. "proficient in Adobe Premiere") is NOT covered by a general unit about editing video. ` +
    `When in doubt, answer not covered - better to ask the user to prove it than to grant false credit.\n` +
    `Reply with JSON array ONLY: [{"syarat":"<copy exactly>","unit":"<copy the unit name EXACTLY from the list, or null>","alasan":"<one short sentence>"}]`,
};

// Kembalikan Map<syarat, {unit, note}> untuk syarat yang MEMANG tercakup unit tervalidasi.
// `ask` bisa disuntik di tes supaya perilakunya bisa diperiksa TANPA menembak LLM (mahal &
// tak deterministik) - di produksi ia default ke chatComplete sungguhan.
export async function bridgeMissingSkills(missing, validated, lang = "id", ask = defaultAsk) {
  const out = new Map();
  if (!missing?.length || !validated?.length) return out;

  const fp = fingerprint(validated);
  const perlu = [];
  for (const s of missing) {
    const key = `${lang}|${fp}|${norm(s)}`;
    if (jembatanCache.has(key)) {
      const v = jembatanCache.get(key);
      if (v.covered) out.set(s, v);
    } else perlu.push(s);
  }
  if (!perlu.length) return out;

  // Satu panggilan untuk SEMUA syarat sisa: lebih murah, dan modelnya melihat seluruh
  // daftar unit sekaligus sehingga tak menilai tiap syarat dalam ruang hampa.
  let arr = [];
  try {
    arr = await ask(validated, perlu, lang);
    if (!Array.isArray(arr)) arr = [];
  } catch (e) {
    console.warn("[jobmatch] jembatan AI gagal:", e.message);
    return out;   // gagal = perilaku lama (deterministik saja), bukan galat ke pengguna
  }

  const sah = new Map(validated.map((u) => [norm(u), u]));
  const jawab = new Map(arr.map((x) => [norm(x?.syarat), x]));

  for (const s of perlu) {
    const key = `${lang}|${fp}|${norm(s)}`;
    const x = jawab.get(norm(s));
    const unit = x?.unit ? sah.get(norm(x.unit)) : null;   // ← penjaga anti-halusinasi
    if (!unit) { cacheSet(key, NEGATIF); continue; }
    const v = { covered: true, unit, note: String(x.alasan || "").slice(0, 200) };
    cacheSet(key, v);
    out.set(s, v);
  }
  return out;
}

// Versi `matchJob` yang memakai jembatan AI untuk syarat yang belum terdeteksi.
// Sengaja TERPISAH dari `matchJob`: kolam talenta HRD memanggil pencocokan N pengguna x M
// posisi sekaligus, dan menaruh panggilan AI di jalur itu berarti ratusan permintaan per
// pembukaan halaman. Yang ini dipakai di layar detail posisi - satu pengguna, satu posisi.
export async function matchJobDeep(job, profile, lang = "id", ask = defaultAsk) {
  const base = matchJob(job, profile);
  if (!base.missingSkills.length) return base;

  const validated = profile.validatedSkills || profile.skills || [];
  const bridged = await bridgeMissingSkills(base.missingSkills, validated, lang, ask);
  if (!bridged.size) return base;

  // Hitung ulang lewat `matchJob` yang SAMA dengan menambahkan nama syarat sebagai alias
  // tervalidasi - jangan menyalin rumus skornya ke sini, dua salinan pasti akan berbeda.
  const deep = matchJob(job, { ...profile, validatedSkills: [...validated, ...bridged.keys()] });
  deep.bridged = [...bridged.entries()].map(([skill, v]) => ({ skill, unit: v.unit, note: v.note }));
  return deep;
}

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
