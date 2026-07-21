import { Lock } from "lucide-react";
import { Link } from "react-router-dom";
import RankIcon from "./RankIcon.jsx";
import { rankName, rankColor } from "../lib/rank.js";
import { useLang } from "../lib/i18n.jsx";

// Kelas & Ujian kini BERJENJANG per tier rank (Fase 2). Server sudah mengurutkan unit dari tier
// bawah ke atas & memberi field `tier` + `tierLocked`. Komponen ini mengubah daftar datar itu
// jadi kelompok per tier dengan header rank - dipakai bersama oleh halaman Kelas & Ujian.

export function groupByTier(units = []) {
  const map = new Map();
  for (const u of units) {
    const t = u.tier ?? 0;
    if (!map.has(t)) map.set(t, []);
    map.get(t).push(u);
  }
  return [...map.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([tier, list]) => ({
      tier,
      units: list,
      total: list.length,
      passed: list.filter((u) => u.passed).length,
      // Tier tergembok bila SEMUA unitnya terkunci tingkat-tier (satu unit bisa saja dibuka Koin).
      locked: list.every((u) => u.tierLocked),
    }));
}

// Header satu tier: emblem rank + nama + progres + status kunci.
export function TierHeader({ tier, total, passed, locked }) {
  const { t } = useLang();
  const col = rankColor(tier);
  return (
    <div className="flex items-center gap-2.5 flex-wrap">
      <RankIcon level={tier} size={26} title={rankName(tier)} />
      <h3 className="text-sm font-bold" style={{ color: col }}>{rankName(tier)}</h3>
      <span className="text-[11px] px-2 py-0.5 rounded-full" style={{ background: "var(--bg-muted)", color: "var(--text-4)" }}>
        {t("{a}/{b} dikuasai", { a: passed, b: total })}
      </span>
      {locked && (
        <span className="text-[11px] px-2 py-0.5 rounded-full inline-flex items-center gap-1" style={{ background: "var(--bg-muted)", color: "var(--text-4)" }}>
          <Lock className="w-3 h-3" /> {t("Terkunci - kuasai {rank} dulu", { rank: rankName(tier - 1) })}
        </span>
      )}
    </div>
  );
}

// Ajakan percepatan untuk tier terkunci: Tes Penempatan membuka tier yang kemampuannya sudah terbukti.
export function TierLockedHint() {
  const { t } = useLang();
  return (
    <p className="text-[11px]" style={{ color: "var(--text-4)" }}>
      {t("Sudah menguasainya?")}{" "}
      <Link to="/app/placement" className="text-brand-500 hover:underline">{t("Tes Penempatan")}</Link>{" "}
      {t("membuka tier ini lebih cepat, atau buka per unit dengan Koin.")}
    </p>
  );
}
