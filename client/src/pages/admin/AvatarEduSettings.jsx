import { useEffect, useState } from "react";
import { GraduationCap, Loader2, Save, Search, Star } from "lucide-react";
import toast from "react-hot-toast";
import api from "../../api/client.js";
import { useLang } from "../../lib/i18n.jsx";

// Pengaturan AvatarEdu: admin mengatur course yang tampil ke pekerja — via kata kunci
// pencarian atau daftar slug course unggulan, plus aktif/nonaktif.
export default function AvatarEduSettings() {
  const { t } = useLang();
  const [cfg, setCfg] = useState(null);
  const [saving, setSaving] = useState(false);
  const [preview, setPreview] = useState(null);
  const [loadingPreview, setLoadingPreview] = useState(false);

  useEffect(() => { api.get("/admin/avataredu").then(setCfg).catch(() => setCfg({ enabled: true, featuredQuery: "", featuredSlugs: [] })); }, []);

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

  if (!cfg) return <div className="text-center py-16" style={{ color: "var(--text-4)" }}>{t("Memuat…")}</div>;
  const slugsStr = Array.isArray(cfg.featuredSlugs) ? cfg.featuredSlugs.join(", ") : (cfg.featuredSlugs || "");

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h2 className="text-xl font-bold flex items-center gap-2" style={{ color: "var(--text-base)" }}><GraduationCap className="w-5 h-5 text-brand-600" /> {t("Pengaturan Course AvatarEdu")}</h2>
        <p className="text-sm mt-1" style={{ color: "var(--text-3)" }}>{t("Atur course yang tampil ke talenta di Kelas & Learning Path.")}</p>
      </div>

      <div className="card p-5 space-y-4">
        <label className="flex items-center justify-between gap-3">
          <div>
            <p className="text-sm font-semibold" style={{ color: "var(--text-base)" }}>{t("Aktifkan integrasi AvatarEdu")}</p>
            <p className="text-xs" style={{ color: "var(--text-4)" }}>{t("Jika nonaktif, course unggulan tidak ditampilkan.")}</p>
          </div>
          <input type="checkbox" checked={cfg.enabled} onChange={(e) => setCfg({ ...cfg, enabled: e.target.checked })} className="w-5 h-5 accent-indigo-600" />
        </label>

        <div>
          <label className="text-sm font-semibold flex items-center gap-1.5" style={{ color: "var(--text-base)" }}><Search className="w-4 h-4" /> {t("Kata kunci pencarian default")}</label>
          <p className="text-xs mb-1.5" style={{ color: "var(--text-4)" }}>{t("Dipakai bila daftar slug unggulan kosong.")}</p>
          <input value={cfg.featuredQuery || ""} onChange={(e) => setCfg({ ...cfg, featuredQuery: e.target.value })} className="input text-sm" placeholder={t("kompetensi kerja, video editing…")} />
        </div>

        <div>
          <label className="text-sm font-semibold flex items-center gap-1.5" style={{ color: "var(--text-base)" }}><Star className="w-4 h-4" /> {t("Slug course unggulan (pisah koma)")}</label>
          <p className="text-xs mb-1.5" style={{ color: "var(--text-4)" }}>{t("Bila diisi, hanya course ini yang jadi unggulan (menimpa kata kunci).")}</p>
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
          {preview.length === 0 ? <p className="text-sm" style={{ color: "var(--text-4)" }}>{t("Tidak ada course — cek kata kunci/slug atau API key.")}</p> : (
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
