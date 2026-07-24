// Sistem "Skill Rank" (gamifikasi) di atas jenjang KKNI (Perpres 8/2012). Cermin dari
// client/src/lib/rank.js - jaga tetap sinkron (dijaga server/tests/rank-sync.test.js).
// `level` = NOMOR JENJANG KKNI, bukan nomor urut tier; daftarnya mulai 3 karena KKNI 1-2
// setara SD/SMP (di bawah usia kerja) dan lantainya sudah dikunci `RANK_FLOOR`.
export const KKNI_FLOOR = 3;
export const RANKS = [
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
// Frasa baku penyebutan jenjang - cermin `KKNI_TERM` di client/src/lib/rank.js.
export const KKNI_TERM = (level) => `setara level KKNI ${level}`;

// mis. "Diamond (setara level KKNI 6)" - nomornya jenjang KKNI, bukan urutan tier.
export function rankLabel(level) {
  const r = RANKS.find((x) => x.level === level);
  return r ? `${r.name} (${KKNI_TERM(r.level)})` : "Unranked";
}
