import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Target, CheckCircle2, Circle, Coins, Loader2, ArrowRight } from "lucide-react";
import toast from "react-hot-toast";
import api from "../api/client.js";
import { useCoins } from "../hooks/useCoins.js";

// Panel Misi Harian: 3 tugas → klaim bonus Koin.
export default function DailyMissions() {
  const [daily, setDaily] = useState(null);
  const [claiming, setClaiming] = useState(false);
  const { setBalance, refresh } = useCoins();

  async function load() {
    try { setDaily(await api.get("/missions/daily")); } catch { /* abaikan */ }
  }
  useEffect(() => { load(); }, []);

  async function claim() {
    if (!daily?.allDone || daily.claimed || claiming) return;
    setClaiming(true);
    try {
      const d = await api.post("/missions/daily/claim");
      if (d.ok) { if (typeof d.balance === "number") setBalance(d.balance); toast.success(`+${d.awarded} Koin — misi harian lengkap!`); }
      await load(); refresh();
    } catch (e) {
      toast.error(typeof e === "string" ? e : "Gagal klaim");
    } finally { setClaiming(false); }
  }

  if (!daily) return null;
  const doneCount = daily.tasks.filter((t) => t.done).length;

  return (
    <div className="card p-5">
      <div className="flex items-center justify-between mb-3">
        <p className="text-sm font-bold flex items-center gap-2" style={{ color: "var(--text-base)" }}>
          <Target className="w-4 h-4 text-brand-600" /> Misi Harian
        </p>
        <span className="flex items-center gap-1 text-xs font-medium text-amber-600">
          <Coins className="w-3.5 h-3.5" /> +{daily.reward}
        </span>
      </div>

      <div className="flex items-center gap-2 mb-3">
        <div className="h-1.5 flex-1 rounded-full overflow-hidden" style={{ backgroundColor: "var(--bg-muted)" }}>
          <div className="h-full rounded-full bg-brand-600 transition-all" style={{ width: `${(doneCount / daily.tasks.length) * 100}%` }} />
        </div>
        <span className="text-[11px] font-mono" style={{ color: "var(--text-4)" }}>{doneCount}/{daily.tasks.length}</span>
      </div>

      <div className="space-y-2">
        {daily.tasks.map((t) => (
          <Link key={t.key} to={t.href}>
            <div className="flex items-center gap-2.5 rounded-lg p-2 transition-colors hover:bg-brand-50" style={{ border: "1px solid var(--border)" }}>
              {t.done ? <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" /> : <Circle className="w-4 h-4 shrink-0" style={{ color: "var(--text-4)" }} />}
              <span className={`text-sm flex-1 ${t.done ? "line-through" : ""}`} style={{ color: t.done ? "var(--text-4)" : "var(--text-2)" }}>{t.label}</span>
              {!t.done && <ArrowRight className="w-3.5 h-3.5 shrink-0" style={{ color: "var(--text-4)" }} />}
            </div>
          </Link>
        ))}
      </div>

      {daily.claimed ? (
        <div className="flex items-center justify-center gap-2 rounded-lg bg-emerald-500/10 text-emerald-500 text-sm py-2 mt-3">
          <CheckCircle2 className="w-4 h-4" /> Bonus misi hari ini sudah diklaim
        </div>
      ) : (
        <button onClick={claim} disabled={!daily.allDone || claiming} className="btn-primary w-full mt-3 text-sm py-2 flex items-center justify-center gap-1.5 disabled:opacity-50">
          {claiming ? <Loader2 className="w-4 h-4 animate-spin" /> : <Coins className="w-4 h-4" />}
          {daily.allDone ? `Klaim ${daily.reward} Koin` : `Selesaikan semua misi (${doneCount}/${daily.tasks.length})`}
        </button>
      )}
    </div>
  );
}
