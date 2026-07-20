// CV PDF -> structured profile (education, certifications, experience).
// Deterministic heuristics - works offline; LLM can sharpen later. User can edit results.
import { PDFParse } from "pdf-parse";
import { fileURLToPath } from "node:url";

// education patterns, HIGHEST first - first hit wins.
const EDU = [
  ["S3", /\b(s-?3|doktor|ph\.?\s?d|doctoral)\b/i],
  ["S2", /\b(s-?2|magister|master|m\.(sc|kom|t|m|pd))\b/i],
  ["Profesi", /\b(profesi|apoteker|ners|dokter)\b/i],
  ["S1", /\b(s-?1|sarjana|bachelor|s\.(kom|t|e|sos|pd|ds))\b/i],
  ["D4", /\b(d-?4|diploma\s*(iv|4)|sarjana terapan)\b/i],
  ["D3", /\b(d-?3|diploma\s*(iii|3)|a\.?md|ahli madya)\b/i],
  ["D2", /\b(d-?2|diploma\s*(ii|2))\b/i],
  ["D1", /\b(d-?1|diploma\s*(i|1))\b/i],
  ["SMK", /\bsmk\b/i],
  ["SMA", /\b(sma|smu|\bman\b)\b/i],
  ["SMP", /\b(smp|mts)\b/i],
  ["SD", /\bsd\b/i],
];

const CERT_KEYWORDS = [
  "adobe premiere", "premiere pro", "after effects", "davinci resolve", "final cut",
  "avid", "color grading", "motion graphics", "video editor", "video editing", "editing",
  "bnsp", "sertifikasi", "certified", "certificate",
];

export function extractProfile(text) {
  const t = text.toLowerCase();
  let education = "SMA"; // default
  for (const [code, re] of EDU) if (re.test(text)) { education = code; break; }
  const certifications = [...new Set(CERT_KEYWORDS.filter((c) => t.includes(c)))];
  const experienceYears = detectExperience(text);
  return { education, certifications, experienceYears };
}

function detectExperience(text) {
  // explicit "X tahun/years" wins
  const explicit = [...text.matchAll(/(\d{1,2})\s*(tahun|thn|years?)/gi)].map((m) => +m[1]);
  if (explicit.length) return Math.max(...explicit);

  // date ranges: "2019 - 2024", "2019–2024", "2019 s/d 2024", "2019 sampai 2024"
  const cur = new Date().getFullYear();
  const re = /\b(19[7-9]\d|20[0-2]\d)\b\s*(?:[-–-]|s\/d|sampai|hingga|to)\s*(?:\w+\s+)?\b(19[7-9]\d|20[0-2]\d|sekarang|present|now)\b/gi;
  const spans = [...text.matchAll(re)].map((m) => {
    const s = +m[1];
    const e = /sekarang|present|now/i.test(m[2]) ? cur : +m[2];
    return e > s && e - s < 50 ? e - s : 0;
  }).filter(Boolean);

  return spans.length ? Math.max(...spans) : 0;
}

export async function pdfToText(buffer) {
  const r = await new PDFParse({ data: buffer }).getText();
  return r.text;
}

function selfCheck() {
  const a = extractProfile("Riwayat: Sarjana (S1) Teknik Informatika. Sertifikasi Adobe Premiere Pro. Pengalaman 3 tahun sebagai video editor.");
  console.assert(a.education === "S1", "S1 detected, got " + a.education);
  console.assert(a.certifications.includes("adobe premiere") && a.certifications.includes("video editor"), "certs found");
  console.assert(a.experienceYears === 3, "3 years, got " + a.experienceYears);
  const b = extractProfile("Lulusan SMK Multimedia. Bisa editing dasar.");
  console.assert(b.education === "SMK", "SMK detected");
  console.assert(b.certifications.includes("editing"), "editing kw");
  const c = extractProfile("Magister Manajemen (S2), 10 tahun pengalaman.");
  console.assert(c.education === "S2" && c.experienceYears === 10, "S2/10y");
  const d = extractProfile("S1 Komunikasi.\nPT Media Kreatif  2019 – 2024\nContent Producer");
  console.assert(d.experienceYears === 5, "date range 2019-2024=5y, got " + d.experienceYears);
  const e = extractProfile("S2 Manajemen.\nBekerja 2020 - sekarang sebagai HRD Manager.");
  console.assert(e.experienceYears >= 4, "sekarang range, got " + e.experienceYears);
  console.log("cv selfCheck OK", JSON.stringify(a));
}

if (process.argv[1] === fileURLToPath(import.meta.url)) selfCheck();
