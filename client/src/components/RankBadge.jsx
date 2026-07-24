import { rankOf } from "../lib/rank.js";
import { useLang } from "../lib/i18n.jsx";

// Badge tier Skill Rank berwarna sesuai tier. `level` = jenjang KKNI (3..9). Frasa nomornya
// dibuat SAMA dengan tempat lain ("setara level KKNI 6") - pemanggil yang butuh chip pendek
// memakai `showNum={false}`, bukan singkatan sendiri yang bikin istilahnya bercabang.
export default function RankBadge({ level, showNum = true }) {
  const { t } = useLang();
  const r = rankOf(level);
  if (!r) return <span className="badge" style={{ backgroundColor: "var(--bg-muted)", color: "var(--text-4)" }}>{t("Belum ada rank")}</span>;
  return (
    <span className="badge" style={{ backgroundColor: `${r.color}22`, color: r.color, border: `1px solid ${r.color}55` }}>
      {r.name}{showNum ? ` · ${t("setara level KKNI {n}", { n: r.level })}` : ""}
    </span>
  );
}
