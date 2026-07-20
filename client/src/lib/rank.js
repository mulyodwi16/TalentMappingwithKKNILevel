// Sistem "Skill Rank" (gamifikasi) - memetakan 9 jenjang internal ke tier ala esports.
// Struktur 9-level tetap SELARAS KKNI di dalam; ini murni lapisan tampilan (display).
export const RANKS = [
  { level: 1, name: "Bronze",      color: "#b8763e" },
  { level: 2, name: "Silver",      color: "#9aa4b2" },
  { level: 3, name: "Gold",        color: "#e0b400" },
  { level: 4, name: "Platinum",    color: "#2dd4bf" },
  { level: 5, name: "Emerald",     color: "#10b981" },
  { level: 6, name: "Diamond",     color: "#38bdf8" },
  { level: 7, name: "Master",      color: "#a855f7" },
  { level: 8, name: "Grandmaster", color: "#ec4899" },
  { level: 9, name: "Legend",      color: "#ef4444" },
];

export function rankOf(level) {
  return RANKS.find((r) => r.level === level) || null;
}
export function rankName(level) {
  return rankOf(level)?.name || "-";
}
// mis. "Gold · Rank 3"
export function rankLabel(level) {
  const r = rankOf(level);
  return r ? `${r.name} · Rank ${r.level}` : "Belum ada rank";
}
export function rankColor(level) {
  return rankOf(level)?.color || "#94a3b8";
}

// Batas masteryScore per tier - MIRROR server/rankcalc.js TIERS (jaga tetap sinkron).
// masteryScore = unitLulus*8 + sertifikat*10 + course*4.
export const RANK_TIERS = [
  { min: 160, level: 9 },
  { min: 120, level: 8 },
  { min: 85, level: 7 },
  { min: 55, level: 6 },
  { min: 32, level: 5 },
  { min: 15, level: 4 },
  { min: 0, level: 3 },
];

// Progres "LP bar" dalam tier saat ini: seberapa jauh menuju tier berikutnya.
// Mengembalikan { pct, need, nextLevel, atCap } - pct 0..100 dalam tier berjalan.
export function tierProgress(score = 0, cap = 9) {
  const asc = [...RANK_TIERS].sort((a, b) => a.min - b.min);
  const curFloor = asc.filter((t) => score >= t.min).pop() || asc[0];
  const higher = asc.find((t) => t.min > score);
  // Rank berikutnya melewati cap bobot kompetensi → bar penuh, terkunci.
  if (higher && higher.level > cap) return { pct: 100, need: 0, nextLevel: null, atCap: true };
  if (!higher) return { pct: 100, need: 0, nextLevel: null, atCap: false };
  const span = higher.min - curFloor.min || 1;
  const pct = Math.max(0, Math.min(100, Math.round(((score - curFloor.min) / span) * 100)));
  return { pct, need: higher.min - score, nextLevel: higher.level, atCap: false };
}
