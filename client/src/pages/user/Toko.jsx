import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import toast from "react-hot-toast";
import {
  Coins, ShoppingBag, GraduationCap, BookOpen, Bot, Sparkles, Ticket,
  Loader2, CheckCircle2, Star,
} from "lucide-react";
import api from "../../api/client.js";
import { useCoins } from "../../hooks/useCoins.js";

const ITEM_ICONS = { graduation: GraduationCap, book: BookOpen, bot: Bot, sparkle: Sparkles };
const LEVEL_BADGE = {
  beginner:     { label: "Pemula",   cls: "bg-emerald-500/20 text-emerald-400" },
  intermediate: { label: "Menengah", cls: "bg-amber-500/20 text-amber-400" },
  advanced:     { label: "Mahir",    cls: "bg-brand-500/20 text-brand-400" },
};

// ── Kursus AvatarEdu yang bisa langsung diikuti (memberi Koin saat mulai) ─────
function AvatarEduCatalog({ onEarned }) {
  const [query, setQuery] = useState("kompetensi kerja");
  const [preview, setPreview] = useState(null);
  const [embedUrls, setEmbedUrls] = useState({});
  const [busy, setBusy] = useState(null);

  const { data, isLoading, isError } = useQuery({
    queryKey: ["toko-avataredu", query],
    queryFn: () => api.get(`/avataredu/courses?q=${encodeURIComponent(query)}&per_page=6`),
    staleTime: 5 * 60 * 1000,
    enabled: !!query,
  });
  const courses = data?.data || [];

  async function follow(c) {
    if (busy) return;
    setBusy(c.slug);
    try {
      // 1) beri koin (sekali per kursus), 2) buka preview embed.
      const r = await api.post("/coins/course-start", { slug: c.slug });
      if (r.awarded > 0) { toast.success(`+${r.awarded} Koin — selamat belajar!`); onEarned?.(r.balance); }
      if (!embedUrls[c.slug]) {
        const d = await api.get(`/avataredu/embed-url/${encodeURIComponent(c.slug)}`);
        setEmbedUrls((p) => ({ ...p, [c.slug]: d.url }));
      }
      setPreview(c.slug);
    } catch (e) {
      toast.error(typeof e === "string" ? e : "Gagal membuka kursus");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 flex-wrap">
        <h2 className="text-sm font-semibold uppercase tracking-wider" style={{ color: "var(--text-3)" }}>Kursus & Kelas AvatarEdu</h2>
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Cari kursus…"
          className="input text-xs py-1.5 w-auto ml-auto max-w-[200px]"
        />
      </div>

      {isLoading ? (
        <div className="text-center py-8 text-sm" style={{ color: "var(--text-4)" }}>Memuat kursus…</div>
      ) : isError || courses.length === 0 ? (
        <div className="text-center py-6 text-sm" style={{ color: "var(--text-4)" }}>Tidak ada kursus ditemukan.</div>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {courses.map((c) => {
            const lv = LEVEL_BADGE[c.level] || LEVEL_BADGE.beginner;
            const isOpen = preview === c.slug;
            return (
              <div key={c.slug} className="card overflow-hidden flex flex-col">
                {c.thumbnail_url && <img src={c.thumbnail_url} alt={c.title} className="w-full h-32 object-cover" loading="lazy" />}
                <div className="p-4 flex flex-col flex-1 gap-2">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${lv.cls}`}>{lv.label}</span>
                    {c.category && <span className="text-xs" style={{ color: "var(--text-4)" }}>{c.category.name}</span>}
                  </div>
                  <p className="text-sm font-semibold line-clamp-2" style={{ color: "var(--text-base)" }}>{c.title}</p>
                  <div className="flex items-center gap-3 text-xs" style={{ color: "var(--text-4)" }}>
                    {c.average_rating > 0 && <span className="flex items-center gap-0.5 text-amber-400"><Star className="w-3 h-3 fill-amber-400" />{c.average_rating?.toFixed(1)}</span>}
                    {c.duration_hours ? <span>{c.duration_hours} jam</span> : null}
                    {c.total_lessons ? <span>{c.total_lessons} materi</span> : null}
                  </div>
                  <p className="text-sm font-bold text-brand-600 mt-auto">{c.formatted_price || "Gratis"}</p>
                  <button onClick={() => follow(c)} disabled={busy === c.slug} className="btn-primary text-xs py-1.5 w-full flex items-center justify-center gap-1.5">
                    {busy === c.slug ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <GraduationCap className="w-3.5 h-3.5" />}
                    {isOpen ? "Sedang diikuti" : "Ikuti Kelas"}
                  </button>
                </div>
                {isOpen && embedUrls[c.slug] && (
                  <div className="border-t" style={{ borderColor: "var(--border)" }}>
                    <iframe src={embedUrls[c.slug]} width="100%" height="460" style={{ border: 0 }} allow="fullscreen" title={c.title} />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
      <p className="text-xs" style={{ color: "var(--text-4)" }}>
        Mengikuti kursus baru memberi <b className="text-amber-600">Koin</b>. Powered by{" "}
        <a href="https://avataredu.ai" target="_blank" rel="noopener noreferrer" className="text-brand-600 hover:underline">AvatarEdu.ai</a>.
      </p>
    </div>
  );
}

export default function Toko() {
  const [items, setItems] = useState(null);
  const [redemptions, setRedemptions] = useState([]);
  const [busy, setBusy] = useState(null);
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
    if ((balance ?? 0) < item.cost) { toast.error(`Butuh ${item.cost} Koin.`); return; }
    setBusy(item.id);
    try {
      const d = await api.post("/shop/redeem", { itemId: item.id });
      if (typeof d.balance === "number") setBalance(d.balance);
      toast.success(`Kelas terbuka! Kode: ${d.code}`);
      await load();
    } catch (e) {
      toast.error(typeof e === "string" ? e : "Gagal menukar");
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
          <div className="flex items-center gap-2 mb-1"><ShoppingBag className="w-5 h-5" /><h1 className="text-xl font-bold text-white">Toko & Kelas</h1></div>
          <p className="text-sm text-white/80 max-w-lg">Ikuti kursus untuk menambah Koin, atau tukar Koin dengan kelas premium & materi eksklusif untuk mempercepat kenaikan jenjang KKNI-mu.</p>
        </div>
        <div className="text-right">
          <div className="flex items-center gap-2 justify-end"><Coins className="w-7 h-7" /><span className="text-4xl font-bold font-mono">{balance ?? "…"}</span></div>
          <p className="text-xs text-white/70 uppercase tracking-wider">Saldo Koin Talenta</p>
        </div>
      </div>

      {/* Kelas saya */}
      {redemptions.length > 0 && (
        <div className="card p-4">
          <p className="text-sm font-semibold flex items-center gap-2 mb-2" style={{ color: "var(--text-base)" }}><Ticket className="w-4 h-4 text-brand-600" /> Kelas Saya</p>
          <div className="grid sm:grid-cols-2 gap-2">
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
        <div className="text-center py-8 text-sm" style={{ color: "var(--text-4)" }}>Memuat katalog…</div>
      ) : cats.map((cat) => (
        <div key={cat} className="space-y-2">
          <h2 className="text-sm font-semibold uppercase tracking-wider" style={{ color: "var(--text-3)" }}>{cat}</h2>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
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
                      <span className="flex items-center gap-1 text-sm font-medium text-emerald-500"><CheckCircle2 className="w-4 h-4" /> Dimiliki</span>
                    ) : (
                      <button onClick={() => redeem(item)} disabled={!affordable || busy === item.id} className="btn-primary text-xs py-1.5 px-3 disabled:opacity-50">
                        {busy === item.id ? <Loader2 className="w-4 h-4 animate-spin" /> : affordable ? "Tukar" : "Koin kurang"}
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ))}

      {/* Kursus AvatarEdu */}
      <AvatarEduCatalog onEarned={(bal) => typeof bal === "number" && setBalance(bal)} />
    </div>
  );
}
