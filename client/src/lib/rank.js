// Sistem "Skill Rank" (gamifikasi) — memetakan 9 jenjang internal ke tier ala esports.
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
  return rankOf(level)?.name || "—";
}
// mis. "Gold · Rank 3"
export function rankLabel(level) {
  const r = rankOf(level);
  return r ? `${r.name} · Rank ${r.level}` : "Belum ada rank";
}
export function rankColor(level) {
  return rankOf(level)?.color || "#94a3b8";
}
