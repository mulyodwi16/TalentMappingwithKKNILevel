import { Link } from "react-router-dom";
import { Check, Lock, ArrowRight } from "lucide-react";
import { rankName, rankColor } from "../lib/rank.js";
import RankIcon from "./RankIcon.jsx";
import { useLang } from "../lib/i18n.jsx";

// Tangga rank per unit: memperlihatkan SYARAT naik rank secara konkret.
// Dulu rank berasal dari skor gabungan yang buram, jadi user tak pernah tahu apa yang
// harus dikuasai. Di sini tiap tier punya daftar unitnya sendiri.
//
// Unit dikelompokkan menurut sifatnya (dasar → teknikal → softskill/mutu), sehingga
// tier atas berisi tanggung jawab yang lebih luas.
const CAT_LABEL = { dasar: "Dasar", teknikal: "Teknikal", lanjutan: "Lanjutan" };

export default function RankLadder({ rank, compact = false }) {
  const { t } = useLang();
  const steps = rank?.ladder || [];
  if (!steps.length) return null;

  const earned = rank?.earned || 0;
  const nextLevel = rank?.next?.level ?? null;

  return (
    <div className="card p-5">
      <div className="flex items-baseline justify-between gap-3 flex-wrap mb-1">
        <h3 className="font-semibold" style={{ color: "var(--text-base)" }}>{t("Tangga Rank")}</h3>
        {rank?.next && (
          <span className="text-xs" style={{ color: "var(--text-4)" }}>
            {t("Menuju")} <b style={{ color: rankColor(rank.next.level) }}>{rankName(rank.next.level)}</b>: {t("kuasai {n} unit lagi", { n: rank.next.need })}
          </span>
        )}
      </div>
      <p className="text-[11px] mb-4" style={{ color: "var(--text-4)" }}>
        {t("Sebuah tier tercapai bila 80% unit sampai tier itu sudah kamu kuasai lewat ujian.")}
      </p>

      <div className="space-y-3">
        {steps.map((s) => {
          // `achieved`, bukan `complete`: sebuah tier hanya boleh tampak tuntas kalau seluruh
          // tier di bawahnya juga tuntas - kalau tidak, centangnya bertabrakan dengan rank nyata.
          const reached = s.achieved ?? s.complete;
          const isNext = s.level === nextLevel;
          const color = rankColor(s.level);
          return (
            <div key={s.level} className="rounded-xl p-3"
              style={{
                background: isNext ? "var(--bg-raised)" : "transparent",
                border: `1px solid ${isNext ? `${color}66` : "var(--border)"}`,
                opacity: !reached && !isNext ? 0.72 : 1,
              }}>
              <div className="flex items-center gap-2.5">
                <RankIcon level={s.level} size={30} title={rankName(s.level)} />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-bold flex items-center gap-1.5" style={{ color }}>
                    {rankName(s.level)}
                    {/* Tangga ini justru tempat paling tepat menyebut jenjangnya: di sinilah
                        pengguna melihat urutannya, jadi asal-usul angkanya harus terbaca. */}
                    <span className="text-[10px] font-medium" style={{ color: "var(--text-4)" }}>
                      {t("setara level KKNI {n}", { n: s.level })}
                    </span>
                    {reached && <Check className="w-3.5 h-3.5 text-emerald-500" />}
                    {s.level === earned && (
                      <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-full"
                        style={{ background: "var(--bg-muted)", color: "var(--text-3)" }}>{t("rank kamu")}</span>
                    )}
                  </p>
                  <div className="h-1 mt-1 rounded-full overflow-hidden" style={{ background: "var(--bg-raised)" }}>
                    <div className="h-full rounded-full" style={{ width: `${(s.done / Math.max(1, s.total)) * 100}%`, background: color }} />
                  </div>
                </div>
                <span className="text-xs font-bold tabular-nums shrink-0" style={{ color: "var(--text-3)" }}>{s.done}/{s.total}</span>
              </div>

              {!compact && (
                <ul className="mt-2 space-y-1">
                  {s.units.map((u) => (
                    <li key={u.code} className="flex items-start gap-1.5 text-[11px]">
                      {u.mastered
                        ? <Check className="w-3 h-3 text-emerald-500 shrink-0 mt-0.5" />
                        : <Lock className="w-3 h-3 shrink-0 mt-0.5" style={{ color: "var(--text-4)" }} />}
                      <span className="min-w-0 flex-1" style={{ color: u.mastered ? "var(--text-3)" : "var(--text-4)" }}>
                        {u.title}
                        {u.category && (
                          <span className="ml-1.5 px-1 py-0.5 rounded" style={{ background: "var(--bg-muted)", color: "var(--text-4)" }}>
                            {t(CAT_LABEL[u.category] || u.category)}
                          </span>
                        )}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          );
        })}
      </div>

      {rank?.weightCap && rank.weightCap < 9 && (
        <p className="text-[11px] mt-3" style={{ color: "var(--text-4)" }}>
          {t("Kompetensi ini maksimal mengantar ke {rank} lewat ujian. Di atas itu butuh bukti eksternal.", { rank: rankName(rank.weightCap) })}
        </p>
      )}

      <Link to="/app/exam" className="text-xs text-brand-500 hover:underline inline-flex items-center gap-1 mt-3">
        {t("Buka Ujian")} <ArrowRight className="w-3 h-3" />
      </Link>
    </div>
  );
}
