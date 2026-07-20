// Sistem "Skill Rank" (gamifikasi) - memetakan 9 jenjang internal (selaras KKNI) ke tier
// ala esports. Cermin dari client/src/lib/rank.js. Jaga tetap sinkron.
export const RANKS = [
  { level: 1, name: "Bronze" },
  { level: 2, name: "Silver" },
  { level: 3, name: "Gold" },
  { level: 4, name: "Platinum" },
  { level: 5, name: "Emerald" },
  { level: 6, name: "Diamond" },
  { level: 7, name: "Master" },
  { level: 8, name: "Grandmaster" },
  { level: 9, name: "Legend" },
];

export function rankName(level) {
  return RANKS.find((r) => r.level === level)?.name || "Unranked";
}
// mis. "Diamond (Rank 6)"
export function rankLabel(level) {
  const r = RANKS.find((x) => x.level === level);
  return r ? `${r.name} (Rank ${r.level})` : "Unranked";
}
