import { useEffect } from "react";
import { Link } from "react-router-dom";
import { Coins } from "lucide-react";
import { useCoins } from "../hooks/useCoins.js";
import { useLang } from "../lib/i18n.jsx";

// Pill saldo Koin Talenta - tampil di topbar (khusus User). Menautkan ke Toko.
export default function CoinPill() {
  const { t } = useLang();
  const { balance, refresh } = useCoins();
  useEffect(() => { refresh(); }, [refresh]);
  return (
    <Link
      to="/app/toko"
      title={t("Koin Talenta · klik untuk ke Toko")}
      className="group inline-flex items-center gap-1.5 rounded-full border border-amber-500/40 bg-amber-500/10 px-2.5 py-1.5 hover:bg-amber-500/20 hover:border-amber-500/60 transition-colors"
    >
      <Coins className="w-4 h-4 text-amber-500 shrink-0" />
      <span className="text-xs font-medium text-amber-600 hidden sm:inline">{t("Koin")}</span>
      <span className="font-mono font-bold text-sm text-amber-600">{balance ?? "…"}</span>
    </Link>
  );
}
