import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import toast from "react-hot-toast";
import {
  Coins, ShoppingBag, GraduationCap, BookOpen, Bot, Sparkles, Ticket,
  Loader2, CheckCircle2, Plus,
} from "lucide-react";
import api from "../../api/client.js";
import { useCoins } from "../../hooks/useCoins.js";
import { useLang } from "../../lib/i18n.jsx";
import BuyCoinsModal from "../../components/BuyCoinsModal.jsx";

const ITEM_ICONS = { graduation: GraduationCap, book: BookOpen, bot: Bot, sparkle: Sparkles };

export default function Toko() {
  const { t } = useLang();
  const [items, setItems] = useState(null);
  const [redemptions, setRedemptions] = useState([]);
  const [busy, setBusy] = useState(null);
  const [buyOpen, setBuyOpen] = useState(false);
  const { balance, refresh, setBalance } = useCoins();

  async function load() {
    try {
      const [s, rd] = await Promise.all([api.get("/shop"), api.get("/shop/redemptions")]);
      setItems(s.items ?? []);
      if (typeof s.balance === "number") setBalance(s.balance);
      setRedemptions(rd.items ?? []);
    } catch { /* abaikan */ }
  }
  useEffect(() => { load(); refresh(); /* eslint-disable-next-line */ }, []);

  async function redeem(item) {
    if (busy) return;
    if ((balance ?? 0) < item.cost) { toast.error(t("Butuh {n} Koin.", { n: item.cost })); return; }
    setBusy(item.id);
    try {
      const d = await api.post("/shop/redeem", { itemId: item.id });
      if (typeof d.balance === "number") setBalance(d.balance);
      toast.success(t("Kelas terbuka! Kode: {code}", { code: d.code }));
      await load();
    } catch (e) {
      toast.error(typeof e === "string" ? e : t("Gagal menukar"));
    } finally {
      setBusy(null);
    }
  }

  const cats = items ? [...new Set(items.map((i) => i.category))] : [];

  return (
    <div className="space-y-6">
      {/* Hero saldo */}
      <div className="rounded-2xl bg-gradient-to-br from-amber-500 via-amber-500/90 to-orange-500 text-white p-6 shadow-lg flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1"><ShoppingBag className="w-5 h-5" /><h1 className="text-xl font-bold text-white">{t("Toko & Kelas")}</h1></div>
          <p className="text-sm text-white/80 max-w-lg">{t("Kumpulkan Koin dari belajar di Kelas, ujian, & misi harian - lalu tukar dengan kelas premium & materi eksklusif untuk mempercepat kenaikan Skill Rank-mu.")}</p>
        </div>
        <div className="text-right">
          <div className="flex items-center gap-2 justify-end"><Coins className="w-7 h-7" /><span className="text-4xl font-bold font-mono">{balance ?? "…"}</span></div>
          <p className="text-xs text-white/70 uppercase tracking-wider mb-2">{t("Saldo Koin Talenta")}</p>
          <button onClick={() => setBuyOpen(true)}
            className="inline-flex items-center gap-1.5 rounded-full bg-white text-orange-600 font-semibold text-sm px-4 py-1.5 shadow hover:bg-white/90 transition-colors">
            <Plus className="w-4 h-4" /> {t("Beli Koin")}
          </button>
        </div>
      </div>

      <BuyCoinsModal open={buyOpen} onClose={() => setBuyOpen(false)} onSuccess={(bal) => { setBalance(bal); load(); }} />

      {/* Kelas saya */}
      {redemptions.length > 0 && (
        <div className="card p-4">
          <p className="text-sm font-semibold flex items-center gap-2 mb-2" style={{ color: "var(--text-base)" }}><Ticket className="w-4 h-4 text-brand-600" /> {t("Kelas Saya")}</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {redemptions.map((rd) => (
              <div key={rd.id} className="flex items-center justify-between gap-2 rounded-lg p-2.5" style={{ border: "1px dashed var(--border-2)" }}>
                <div className="min-w-0">
                  <p className="text-sm font-medium truncate" style={{ color: "var(--text-base)" }}>{rd.itemName}</p>
                  <p className="text-[11px] font-mono" style={{ color: "var(--text-4)" }}>{rd.code}</p>
                </div>
                <span className="text-[10px] font-semibold px-2 py-1 rounded-full bg-emerald-500/10 text-emerald-500 shrink-0">{rd.status}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Katalog kelas premium */}
      {!items ? (
        <div className="text-center py-8 text-sm" style={{ color: "var(--text-4)" }}>{t("Memuat katalog…")}</div>
      ) : cats.map((cat) => (
        <div key={cat} className="space-y-2">
          <h2 className="text-sm font-semibold uppercase tracking-wider" style={{ color: "var(--text-3)" }}>{cat}</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {items.filter((i) => i.category === cat).map((item) => {
              const Icon = ITEM_ICONS[item.icon] ?? Coins;
              const affordable = (balance ?? 0) >= item.cost;
              return (
                <div key={item.id} className="card p-4 flex flex-col">
                  <div className="flex items-start gap-3 mb-2">
                    <div className="rounded-lg bg-brand-600/10 p-2 shrink-0"><Icon className="w-5 h-5 text-brand-600" /></div>
                    <p className="text-sm font-semibold leading-snug" style={{ color: "var(--text-base)" }}>{item.name}</p>
                  </div>
                  <p className="text-xs flex-1" style={{ color: "var(--text-3)" }}>{item.desc}</p>
                  <div className="flex items-center justify-between gap-2 mt-3">
                    <span className="flex items-center gap-1 font-mono font-bold text-amber-600"><Coins className="w-4 h-4" /> {item.cost}</span>
                    {item.owned ? (
                      <span className="flex items-center gap-1 text-sm font-medium text-emerald-500"><CheckCircle2 className="w-4 h-4" /> {t("Dimiliki")}</span>
                    ) : (
                      <button onClick={() => redeem(item)} disabled={!affordable || busy === item.id} className="btn-primary text-xs py-1.5 px-3 disabled:opacity-50">
                        {busy === item.id ? <Loader2 className="w-4 h-4 animate-spin" /> : affordable ? t("Tukar") : t("Koin kurang")}
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ))}

      <p className="text-xs text-center" style={{ color: "var(--text-4)" }}>
        {t("Ingin belajar materi & ikuti kursus AvatarEdu? Semua ada di")}{" "}
        <Link to="/app/kelas" className="text-brand-600 hover:underline">{t("Kelas")}</Link>. {t("Menyelesaikan kelas memberi Koin untuk ditukar di sini.")}
      </p>
    </div>
  );
}
