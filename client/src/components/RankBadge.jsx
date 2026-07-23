import { rankOf } from "../lib/rank.js";

// Badge tier Skill Rank berwarna sesuai tier. `level` = jenjang KKNI (3..9), dan nomornya
// ditulis "KKNI 3" bukan "R3" supaya asal-usulnya tetap terbaca di tempat sesempit apa pun.
export default function RankBadge({ level, showNum = true }) {
  const r = rankOf(level);
  if (!r) return <span className="badge" style={{ backgroundColor: "var(--bg-muted)", color: "var(--text-4)" }}>Belum ada rank</span>;
  return (
    <span className="badge" style={{ backgroundColor: `${r.color}22`, color: r.color, border: `1px solid ${r.color}55` }}>
      {r.name}{showNum ? ` · KKNI ${r.level}` : ""}
    </span>
  );
}
