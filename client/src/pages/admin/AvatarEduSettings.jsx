import { useEffect, useState } from "react";
import { Eye, GraduationCap, Loader2, RefreshCw, Save, Search, Star } from "lucide-react";
import toast from "react-hot-toast";
import api from "../../api/client.js";
import { useLang, dateLocale } from "../../lib/i18n.jsx";

// Pengaturan AvatarEdu. Dua lapis:
//   1. Katalog - salinan course partner, tiap course punya sakelar tampil/sembunyi.
//      Ini cara utama; sebelumnya admin hanya bisa menebak slug secara manual.
//   2. Pengaturan lanjutan - kata kunci & slug manual, dipakai bila katalog belum dikurasi.
export default function AvatarEduSettings() {
  const { lang, t } = useLang();
  const [cfg, setCfg] = useState(null);
  const [saving, setSaving] = useState(false);
  const [preview, setPreview] = useState(null);
  const [loadingPreview, setLoadingPreview] = useState(false);

  const [cat, setCat] = useState(null);
  const [syncing, setSyncing] = useState(false);
  const [q, setQ] = useState("");
  const [busyId, setBusyId] = useState(null);

  const loadCatalog = () => api.get("/admin/avataredu/courses").then(setCat).catch(() => setCat(null));

  useEffect(() => {
    api.get("/admin/avataredu").then(setCfg).catch(() => setCfg({ enabled: true, featuredQuery: "", featuredSlugs: [] }));
    loadCatalog();
  }, []);

  async function save() {
    setSaving(true);
    try {
      const saved = await api.put("/admin/avataredu", {
        enabled: cfg.enabled,
        featuredQuery: cfg.featuredQuery,
        featuredSlugs: (Array.isArray(cfg.featuredSlugs) ? cfg.featuredSlugs : String(cfg.featuredSlugs || "").split(",")).map((s) => String(s).trim()).filter(Boolean),
      });
      setCfg(saved);
      toast.success(t("Pengaturan disimpan"));
    } catch (e) { toast.error(typeof e === "string" ? e : t("Gagal simpan")); }
    finally { setSaving(false); }
  }

  async function testPreview() {
    setLoadingPreview(true);
    try { setPreview((await api.get("/avataredu/featured"))?.data || []); }
    catch (e) { toast.error(typeof e === "string" ? e : t("Gagal memuat")); }
    finally { setLoadingPreview(false); }
  }

  async function sync() {
    setSyncing(true);
    try {
      const r = await api.post("/admin/avataredu/sync", {});
      await loadCatalog();
      toast.success(t("{n} course tersalin dari AvatarEdu", { n: r.synced }));
    } catch (e) { toast.error(typeof e === "string" ? e : t("Gagal menyalin katalog")); }
    finally { setSyncing(false); }
  }

  // Sakelar dioptimis dulu supaya terasa responsif, lalu dipulihkan bila server menolak.
  async function toggle(course) {
    const next = !course.published;
    setBusyId(course.id);
    setCat((c) => ({ ...c, courses: c.courses.map((x) => (x.id === course.id ? { ...x, published: next } : x)), published: c.published + (next ? 1 : -1) }));
    try { await api.patch(`/admin/avataredu/courses/${course.id}`, { published: next }); }
    catch (e) {
      toast.error(typeof e === "string" ? e : t("Gagal simpan"));
      loadCatalog();
    } finally { setBusyId(null); }
  }

  async function setOrder(course, value) {
    const n = Math.max(0, Math.min(9999, Number(value) || 0));
    setCat((c) => ({ ...c, courses: c.courses.map((x) => (x.id === course.id ? { ...x, displayOrder: n } : x)) }));
    try { await api.patch(`/admin/avataredu/courses/${course.id}`, { displayOrder: n }); }
    catch { loadCatalog(); }
  }

  async function publishAll(published) {
    try {
      await api.post("/admin/avataredu/courses/publish-all", { published });
      await loadCatalog();
      toast.success(published ? t("Semua course dipublikasikan") : t("Semua course disembunyikan"));
    } catch (e) { toast.error(typeof e === "string" ? e : t("Gagal simpan")); }
  }

  if (!cfg) return <div className="text-center py-16" style={{ color: "var(--text-4)" }}>{t("Memuat…")}</div>;
  const slugsStr = Array.isArray(cfg.featuredSlugs) ? cfg.featuredSlugs.join(", ") : (cfg.featuredSlugs || "");

  const courses = (cat?.courses || []).filter((c) => {
    const s = q.trim().toLowerCase();
    if (!s) return true;
    return [c.title, c.categoryName, c.creatorName, c.slug].some((v) => String(v || "").toLowerCase().includes(s));
  });

  return (
    <div className="space-y-6 max-w-5xl">
      <div>
        <h2 className="text-xl font-bold flex items-center gap-2" style={{ color: "var(--text-base)" }}>
          <GraduationCap className="w-5 h-5 text-brand-600" /> {t("Pengaturan Course AvatarEdu")}
        </h2>
        <p className="text-sm mt-1" style={{ color: "var(--text-3)" }}>{t("Atur course yang tampil ke talenta di Kelas & Learning Path.")}</p>
      </div>

      {/* ── Katalog & publikasi ─────────────────────────────────────────────── */}
      <div className="card p-5 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="text-sm font-semibold flex items-center gap-2" style={{ color: "var(--text-base)" }}>
              <Eye className="w-4 h-4 text-brand-600" /> {t("Katalog & publikasi ke talenta")}
            </p>
            <p className="text-xs mt-0.5" style={{ color: "var(--text-4)" }}>
              {cat?.lastSyncAt
                ? t("Disalin terakhir {when}", { when: new Date(cat.lastSyncAt).toLocaleString(dateLocale(lang)) })
                : t("Katalog belum pernah disalin.")}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {cat?.total > 0 && (
              <span className="badge badge-ready">{t("{a}/{b} tampil", { a: cat.published, b: cat.total })}</span>
            )}
            <button onClick={sync} disabled={syncing} className="btn-outline text-xs py-1.5 px-3 flex items-center gap-1.5 disabled:opacity-50">
              {syncing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />} {t("Salin dari AvatarEdu")}
            </button>
            {cat?.total > 0 && (
              <>
                <button onClick={() => publishAll(true)} className="text-xs hover:underline" style={{ color: "var(--text-3)" }}>{t("Tampilkan semua")}</button>
                <button onClick={() => publishAll(false)} className="text-xs hover:underline" style={{ color: "var(--text-3)" }}>{t("Sembunyikan semua")}</button>
              </>
            )}
          </div>
        </div>

        {!cat?.total ? (
          <div className="rounded-xl p-6 text-center text-sm" style={{ border: "1px dashed var(--border-2)", color: "var(--text-4)" }}>
            {cat && !cat.hasKey
              ? t("API key AvatarEdu belum diatur di server - hubungi pengelola server.")
              : t("Salin katalog dulu untuk memilih course mana yang tampil ke talenta.")}
          </div>
        ) : (
          <>
            <div className="relative">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2" style={{ color: "var(--text-4)" }} />
              <input value={q} onChange={(e) => setQ(e.target.value)} className="input text-sm pl-9" placeholder={t("Cari judul, kategori, atau pembuat…")} />
            </div>

            <div className="overflow-x-auto -mx-1">
              <table className="w-full text-sm" style={{ minWidth: 640 }}>
                <thead>
                  <tr style={{ borderBottom: "1px solid var(--border)" }}>
                    {[t("Course"), t("Kategori"), t("Level"), t("Harga"), t("Urutan"), t("Tampil")].map((h) => (
                      <th key={h} className="text-left font-semibold text-[11px] uppercase tracking-wider py-2 px-2 whitespace-nowrap" style={{ color: "var(--text-4)" }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {courses.map((c) => (
                    <tr key={c.id} style={{ borderBottom: "1px solid var(--border)" }}>
                      <td className="py-2.5 px-2">
                        <div className="flex items-center gap-2.5 min-w-0">
                          {c.thumbnailUrl
                            ? <img src={c.thumbnailUrl} alt="" className="w-11 h-8 rounded object-cover shrink-0" />
                            : <span className="w-11 h-8 rounded shrink-0" style={{ background: "var(--bg-muted)" }} />}
                          <div className="min-w-0">
                            <p className="font-medium truncate" style={{ color: "var(--text-base)" }}>{c.title}</p>
                            <p className="text-[11px] truncate" style={{ color: "var(--text-4)" }}>{c.creatorName || c.slug}</p>
                          </div>
                        </div>
                      </td>
                      <td className="py-2.5 px-2">
                        {c.categoryName && <span className="badge badge-in-progress whitespace-nowrap">{c.categoryName}</span>}
                      </td>
                      <td className="py-2.5 px-2 whitespace-nowrap" style={{ color: "var(--text-3)" }}>{c.level || "-"}</td>
                      <td className="py-2.5 px-2 whitespace-nowrap tabular-nums" style={{ color: "var(--text-3)" }}>{c.formattedPrice || "-"}</td>
                      <td className="py-2.5 px-2">
                        <input
                          type="number" min={0} max={9999} value={c.displayOrder}
                          onChange={(e) => setOrder(c, e.target.value)}
                          className="input text-sm py-1 px-2 w-16 tabular-nums"
                          aria-label={t("Urutan")}
                        />
                      </td>
                      <td className="py-2.5 px-2">
                        <button
                          onClick={() => toggle(c)} disabled={busyId === c.id}
                          role="switch" aria-checked={c.published}
                          aria-label={c.published ? t("Sembunyikan dari talenta") : t("Tampilkan ke talenta")}
                          className={`w-11 h-6 rounded-full p-0.5 transition-colors disabled:opacity-50 ${c.published ? "bg-brand-600" : ""}`}
                          style={c.published ? {} : { background: "var(--bg-muted)", border: "1px solid var(--border-2)" }}
                        >
                          <span className={`block w-5 h-5 rounded-full bg-white shadow transition-transform ${c.published ? "translate-x-5" : ""}`} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {courses.length === 0 && (
                <p className="text-sm text-center py-6" style={{ color: "var(--text-4)" }}>{t("Tidak ada course yang cocok.")}</p>
              )}
            </div>

            <p className="text-xs" style={{ color: "var(--text-4)" }}>
              {t("Course yang ditampilkan muncul di Kelas & Dashboard talenta. Urutan kecil tampil lebih dulu.")}
            </p>
          </>
        )}
      </div>

      {/* ── Pengaturan lanjutan ─────────────────────────────────────────────── */}
      <div className="card p-5 space-y-4">
        <p className="text-sm font-semibold" style={{ color: "var(--text-base)" }}>{t("Pengaturan lanjutan")}</p>

        <label className="flex items-center justify-between gap-3">
          <div>
            <p className="text-sm font-semibold" style={{ color: "var(--text-base)" }}>{t("Aktifkan integrasi AvatarEdu")}</p>
            <p className="text-xs" style={{ color: "var(--text-4)" }}>{t("Jika nonaktif, course unggulan tidak ditampilkan.")}</p>
          </div>
          <input type="checkbox" checked={cfg.enabled} onChange={(e) => setCfg({ ...cfg, enabled: e.target.checked })} className="w-5 h-5 accent-indigo-600" />
        </label>

        <div>
          <label className="text-sm font-semibold flex items-center gap-1.5" style={{ color: "var(--text-base)" }}><Search className="w-4 h-4" /> {t("Kata kunci pencarian default")}</label>
          <p className="text-xs mb-1.5" style={{ color: "var(--text-4)" }}>{t("Dipakai bila katalog belum dikurasi & daftar slug kosong.")}</p>
          <input value={cfg.featuredQuery || ""} onChange={(e) => setCfg({ ...cfg, featuredQuery: e.target.value })} className="input text-sm" placeholder={t("kompetensi kerja, video editing…")} />
        </div>

        <div>
          <label className="text-sm font-semibold flex items-center gap-1.5" style={{ color: "var(--text-base)" }}><Star className="w-4 h-4" /> {t("Slug course unggulan (pisah koma)")}</label>
          <p className="text-xs mb-1.5" style={{ color: "var(--text-4)" }}>{t("Cadangan bila katalog belum disalin. Katalog yang dikurasi selalu menang.")}</p>
          <input value={slugsStr} onChange={(e) => setCfg({ ...cfg, featuredSlugs: e.target.value.split(",") })} className="input text-sm" placeholder="digital-marketing-dasar, ethics-360-…" />
        </div>

        <div className="flex gap-2">
          <button onClick={save} disabled={saving} className="btn-primary text-sm py-2 px-4 flex items-center gap-1.5">
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} {t("Simpan")}
          </button>
          <button onClick={testPreview} disabled={loadingPreview} className="btn-outline text-sm py-2 px-4">{loadingPreview ? t("Memuat…") : t("Uji Pratinjau")}</button>
        </div>
      </div>

      {preview && (
        <div className="card p-5">
          <p className="text-sm font-semibold mb-3" style={{ color: "var(--text-base)" }}>{t("Pratinjau course unggulan ({n})", { n: preview.length })}</p>
          {preview.length === 0 ? <p className="text-sm" style={{ color: "var(--text-4)" }}>{t("Tidak ada course - cek kata kunci/slug atau API key.")}</p> : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {preview.map((c) => (
                <div key={c.slug} className="rounded-lg p-3" style={{ border: "1px solid var(--border)" }}>
                  <p className="text-sm font-medium" style={{ color: "var(--text-base)" }}>{c.title}</p>
                  <p className="text-xs" style={{ color: "var(--text-4)" }}>{c.slug}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
