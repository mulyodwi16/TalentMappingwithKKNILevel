import { useEffect, useState } from "react";
import { Gift, Coins, Flame, CheckCircle2, Loader2 } from "lucide-react";
import toast from "react-hot-toast";
import api from "../api/client.js";
import { useCoins } from "../hooks/useCoins.js";
import { useLang } from "../lib/i18n.jsx";

// Kartu Login Harian: klaim bonus Koin sekali per hari, dengan streak beruntun.
export default function DailyLoginCard() {
  const { t } = useLang();
  const [daily, setDaily] = useState(null);
  const [claiming, setClaiming] = useState(false);
  const { setBalance, refresh } = useCoins();

  async function load() {
    try { setDaily(await api.get("/coins/daily")); } catch { /* abaikan */ }
  }
  useEffect(() => { load(); }, []);

  async function claim() {
    if (claiming || daily?.claimedToday) return;
    setClaiming(true);
    try {
      const d = await api.post("/coins/daily-claim");
      if (d.ok) {
        if (typeof d.balance === "number") setBalance(d.balance);
        toast.success(t("+{n} Koin! Streak {s} hari 🔥", { n: d.awarded, s: d.streak }));
      } else {
        toast(d.message || t("Sudah diklaim hari ini."));
      }
      await load();
      refresh();
    } catch (e) {
      toast.error(typeof e === "string" ? e : t("Gagal klaim"));
    } finally {
      setClaiming(false);
    }
  }

  const streak = daily?.streak ?? 0;
  const claimed = !!daily?.claimedToday;

  return (
    <div className="card p-5 flex items-center justify-between gap-4">
      <div className="flex items-center gap-3 min-w-0">
        <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center text-white shrink-0">
          <Gift className="w-5 h-5" />
        </div>
        <div className="min-w-0">
          <p className="text-sm font-bold" style={{ color: "var(--text-base)" }}>{t("Bonus Login Harian")}</p>
          <p className="text-xs flex items-center gap-1.5" style={{ color: "var(--text-3)" }}>
            <Flame className="w-3.5 h-3.5 text-orange-500" /> {t("Streak {n} hari", { n: streak })}
            {daily && !claimed && <span className="text-amber-600 font-medium">{t("· +{n} Koin menanti", { n: daily.nextReward })}</span>}
          </p>
        </div>
      </div>
      {claimed ? (
        <span className="flex items-center gap-1.5 text-sm font-medium text-emerald-500 shrink-0">
          <CheckCircle2 className="w-4 h-4" /> {t("Terklaim")}
        </span>
      ) : (
        <button onClick={claim} disabled={claiming || !daily} className="btn-primary text-sm py-2 px-4 shrink-0 flex items-center gap-1.5">
          {claiming ? <Loader2 className="w-4 h-4 animate-spin" /> : <Coins className="w-4 h-4" />}
          {t("Klaim")}
        </button>
      )}
    </div>
  );
}
