import { useState, useEffect, useCallback, useRef } from "react";
import toast from "react-hot-toast";
import { Search, Loader2, X, CheckCircle2 } from "lucide-react";
import api from "../api/client.js";
import CompetencyPreparing from "./CompetencyPreparing.jsx";
import { useLang } from "../lib/i18n.jsx";

// Modal pencarian & pemilihan kompetensi SKKNI - kategori + infinite scroll (muat per 100,
// item di luar layar di-hide via content-visibility agar hemat, scroll tetap jalan sampai habis).
// Dipakai di Profil (ganti kompetensi) & Register wizard (fase 2).
// selectOnly=true → hanya kembalikan item terpilih (TIDAK memanggil /skkni/choose).
// Dipakai di Register wizard yang menunda semua penyimpanan sampai fase akhir.
const PAGE = 100;
export default function SkkniPicker({ onClose, onChosen, selectOnly = false }) {
  const { t } = useLang();
  const [q, setQ] = useState("");
  const [cats, setCats] = useState([]);
  const [activeCat, setActiveCat] = useState("all");
  const [items, setItems] = useState([]);
  const [total, setTotal] = useState(0);
  const [searching, setSearching] = useState(false);   // pencarian/replace awal
  const [loadingMore, setLoadingMore] = useState(false);
  const [choosing, setChoosing] = useState(null);
  const [preparing, setPreparing] = useState(null);    // {docId, title, chosen} - menunggu skill siap
  const listRef = useRef(null);
  // Simpan q/kategori terbaru untuk loadMore tanpa stale closure.
  const stateRef = useRef({ q: "", cat: "all", len: 0, total: 0, loading: false });
  stateRef.current = { q, cat: activeCat, len: items.length, total, loading: searching || loadingMore };

  const fetchPage = (term, category, offset) =>
    api.get(`/skkni/search?q=${encodeURIComponent(term || "")}&category=${encodeURIComponent(category || "all")}&offset=${offset}`);

  const search = useCallback(async (term, category) => {
    setSearching(true);
    try {
      const d = await fetchPage(term, category, 0);
      setItems(d.items || []);
      setTotal(d.total ?? (d.items?.length || 0));
      if (listRef.current) listRef.current.scrollTop = 0;
    } catch (e) {
      toast.error(typeof e === "string" ? e : "Gagal mencari"); // di luar scope t (useCallback tanpa dep) - fallback ID
    } finally {
      setSearching(false);
    }
  }, []);

  const loadMore = useCallback(async () => {
    const st = stateRef.current;
    if (st.loading || st.len >= st.total) return;
    setLoadingMore(true);
    try {
      const d = await fetchPage(st.q, st.cat, st.len);
      setItems((prev) => [...prev, ...(d.items || [])]);
      if (typeof d.total === "number") setTotal(d.total);
    } catch { /* diam */ } finally {
      setLoadingMore(false);
    }
  }, []);

  function onScroll(e) {
    const el = e.currentTarget;
    if (el.scrollHeight - el.scrollTop - el.clientHeight < 240) loadMore();
  }

  useEffect(() => {
    api.get("/skkni/categories").then((d) => setCats(d.categories || [])).catch(() => {});
    search("", "all");
  }, [search]);

  function pickCat(key) { setActiveCat(key); search(q, key); }

  async function choose(item) {
    if (choosing) return;
    if (selectOnly) { onChosen(item); return; } // wizard: pilih dulu, simpan saat finalisasi
    setChoosing(item.id);
    try {
      const r = await api.post("/skkni/choose", { docId: item.id });
      if (r.ready) {
        toast.success(t("Kompetensi target: {title} ({n} skill)", { title: r.chosen?.title, n: r.chosen?.unitCount }));
        onChosen(r.chosen);
        return;
      }
      // Skill-nya masih ditarik dari data resmi SKKNI: tahan modal di layar tunggu
      // supaya user tak menutupnya lalu melihat analisis yang masih kosong.
      setPreparing({ docId: item.id, title: r.chosen?.title || item.title, chosen: r.chosen });
    } catch (e) {
      toast.error(typeof e === "string" ? e : t("Gagal menetapkan kompetensi"));
    } finally {
      setChoosing(null);
    }
  }

  const chip = (key, label, count) => (
    <button key={key} onClick={() => pickCat(key)}
      className={`text-xs px-2.5 py-1 rounded-full whitespace-nowrap transition-colors ${activeCat === key ? "bg-brand-600 text-white" : "hover:bg-[var(--bg-muted)]"}`}
      style={activeCat === key ? {} : { border: "1px solid var(--border)", color: "var(--text-3)" }}>
      {label}{count != null ? ` · ${count}` : ""}
    </button>
  );

  return (
    <div className="is-modal fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(0,0,0,0.5)" }} onClick={onClose}>
      <div className="w-full max-w-lg rounded-2xl p-5 max-h-[85vh] flex flex-col" style={{ background: "var(--bg-surface)", border: "1px solid var(--border)" }} onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-3">
          <div>
            <h3 className="font-semibold flex items-center gap-2" style={{ color: "var(--text-base)" }}><Search className="w-4 h-4 text-brand-600" /> {t("Pilih Kompetensi Target")}</h3>
            <p className="text-[11px] mt-0.5" style={{ color: "var(--text-4)" }}>{t("Pilih bidang/profesi sesuai tujuan kariermu - jadi acuan semua fitur.")}</p>
          </div>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-red-50 hover:text-red-500" style={{ color: "var(--text-4)" }}><X className="w-4 h-4" /></button>
        </div>

        {preparing ? (
          <CompetencyPreparing
            docId={preparing.docId}
            title={preparing.title}
            onReady={() => onChosen(preparing.chosen)}
            onSkip={() => onChosen(preparing.chosen)}
            onPickOther={() => setPreparing(null)}
          />
        ) : (
        <>
        <form onSubmit={(e) => { e.preventDefault(); search(q, activeCat); }} className="flex gap-2 mb-3">
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={t("Cari profesi (mis. perawat, akuntansi, desain)…")} className="input text-sm flex-1" autoFocus />
          <button type="submit" className="btn-primary text-sm px-3" disabled={searching}>{searching ? <Loader2 className="w-4 h-4 animate-spin" /> : t("Cari")}</button>
        </form>

        {/* Chip kategori (wrap, tanpa scrollbar) */}
        <div className="flex flex-wrap gap-1.5 mb-3">
          {chip("all", t("Semua"))}
          {cats.map((c) => chip(c.key, c.label, c.count))}
        </div>

        <div ref={listRef} onScroll={onScroll} className="flex-1 overflow-y-auto space-y-1.5 -mx-1 px-1">
          {searching ? (
            <p className="text-sm text-center py-8" style={{ color: "var(--text-4)" }}>{t("Memuat…")}</p>
          ) : items.length === 0 ? (
            <p className="text-sm text-center py-8" style={{ color: "var(--text-4)" }}>{t("Tidak ada hasil di kategori ini. Coba kata kunci atau kategori lain.")}</p>
          ) : items.map((it) => (
            <button key={it.id} onClick={() => choose(it)} disabled={!!choosing}
              className="w-full text-left rounded-xl p-3 transition-colors hover:bg-[var(--bg-muted)] disabled:opacity-60 flex items-start gap-2"
              style={{ border: "1px solid var(--border)", contentVisibility: "auto", containIntrinsicSize: "auto 68px" }}>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium" style={{ color: "var(--text-base)" }}>{it.title}</p>
                <p className="text-[11px] flex items-center gap-1.5" style={{ color: "var(--text-4)" }}>
                  <span className="px-1.5 py-0.5 rounded" style={{ background: "var(--bg-muted)" }}>{it.category}</span>
                  {it.unitsCached ? <span className="text-emerald-500">{t("{n} skill siap", { n: it.unitCount })}</span> : <span>{t("Standar SKKNI")}</span>}
                </p>
              </div>
              {choosing === it.id ? <Loader2 className="w-4 h-4 animate-spin text-brand-600 shrink-0 mt-0.5" />
                : it.unitsCached ? <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" /> : null}
            </button>
          ))}
          {!searching && items.length > 0 && (
            <p className="text-[11px] text-center pt-2 pb-1" style={{ color: "var(--text-4)" }}>
              {loadingMore ? t("Memuat lagi…") : items.length >= total ? t("{n} kompetensi (semua ditampilkan)", { n: total }) : t("{a} dari {b} - scroll untuk memuat lagi", { a: items.length, b: total })}
            </p>
          )}
        </div>
        </>
        )}
      </div>
    </div>
  );
}
