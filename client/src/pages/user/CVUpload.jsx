import { useState, useRef, useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import toast from "react-hot-toast";
import {
  Linkedin, Instagram, Globe, Link2, Award, Plus, Trash2, Save, Loader2, ShieldCheck, Info,
} from "lucide-react";
import api from "../../api/client.js";
import { rankName, rankColor } from "../../lib/rank.js";
import RankIcon from "../../components/RankIcon.jsx";
import { useLang, getLang, dateLocale } from "../../lib/i18n.jsx";

const fmtDate = (d) => (d ? new Date(d).toLocaleDateString(dateLocale(getLang()), { day: "numeric", month: "short", year: "numeric" }) : "-");

export default function CVUpload() {
  const { t } = useLang();
  const qc = useQueryClient();
  const [result, setResult] = useState(null);
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef();

  // CV yang pernah diunggah tetap tampil walau pindah halaman (tersimpan di profil,
  // bukan hanya di state layar ini). Sumbernya /user/overview yang sudah dipakai bersama.
  const { data: ov } = useQuery({ queryKey: ["overview"], queryFn: () => api.get("/user/overview") });
  const saved = ov?.cv?.parsedAt
    ? {
        profile: {
          education: ov.cv.education,
          experienceYears: ov.cv.experienceYears,
          certifications: ov.cv.certifications || [],
        },
        predictedLevel: ov.rank?.effective,
        levelInfo: ov.rankInfo,
        fileName: ov.cv.fileName,
        parsedAt: ov.cv.parsedAt,
      }
    : null;
  const shown = result || saved;

  const parse = useMutation({
    mutationFn: ({ pdfBase64, fileName }) => api.post("/user/cv-parse", { pdfBase64, fileName }),
    onSuccess: (data) => {
      setResult(data);
      qc.invalidateQueries({ queryKey: ["overview"] });
      toast.success(t("CV berhasil dianalisis & disimpan ke profil!"));
    },
    onError: (err) => toast.error(err || t("Gagal membaca CV")),
  });

  const handleFile = (file) => {
    if (!file || file.type !== "application/pdf") return toast.error(t("Harap upload file PDF"));
    const reader = new FileReader();
    reader.onload = (e) => parse.mutate({ pdfBase64: e.target.result, fileName: file.name });
    reader.readAsDataURL(file);
  };

  const onDrop = (e) => { e.preventDefault(); setDragging(false); handleFile(e.dataTransfer.files[0]); };

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div>
        <h2 className="text-xl font-bold" style={{ color: "var(--text-base)" }}>{t("Upload CV & Data Validasi")}</h2>
        <p className="text-sm mt-1" style={{ color: "var(--text-4)" }}>{t("Unggah CV PDF untuk ekstraksi profil & prediksi Skill Rank, lalu lengkapi data pendukung validasi (portofolio, medsos, sertifikat).")}</p>
      </div>

      {/* Drop zone */}
      <div
        className={`card p-10 text-center border-2 border-dashed cursor-pointer transition-all ${
          dragging ? "border-brand-500 bg-brand-600/5" : "border-slate-700 hover:border-slate-500"
        }`}
        onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
        onClick={() => inputRef.current?.click()}
      >
        <input ref={inputRef} type="file" accept=".pdf" hidden onChange={(e) => handleFile(e.target.files[0])} />
        <div className="text-5xl mb-4">{parse.isPending ? "⏳" : "📄"}</div>
        {parse.isPending ? (
          <>
            <p className="text-brand-400 font-semibold">{t("Menganalisis CV…")}</p>
            <p className="text-sm mt-1" style={{ color: "var(--text-4)" }}>{t("Mengekstrak teks & mengklasifikasi Skill Rank")}</p>
          </>
        ) : (
          <>
            <p className="font-semibold" style={{ color: "var(--text-base)" }}>{t("Letakkan file CV (PDF) di sini")}</p>
            <p className="text-sm mt-1" style={{ color: "var(--text-4)" }}>{t("atau klik area ini untuk memilih file")}</p>
          </>
        )}
      </div>

      {/* Result */}
      {shown && (
        <div className="space-y-4">
          <div className="card p-6">
            {/* Rank ditampilkan lewat emblem (visual utama); namanya di bawah sebagai penjelas. */}
            <div className="flex flex-col items-center text-center gap-2">
              <p className="text-xs" style={{ color: "var(--text-4)" }}>{t("Skill Rank Terprediksi (perkiraan dari pendidikan)")}</p>
              <RankIcon level={shown.predictedLevel} size={84} title={rankName(shown.predictedLevel)} />
              <div className="min-w-0">
                <p className="text-xl font-bold" style={{ color: rankColor(shown.predictedLevel) }}>{rankName(shown.predictedLevel)}</p>
                <p className="text-sm" style={{ color: "var(--text-3)" }}>{shown.levelInfo?.title}</p>
                <p className="text-xs mt-0.5" style={{ color: "var(--text-4)" }}>{shown.levelInfo?.jobGroup}</p>
              </div>
            </div>
            <p className="text-[11px] mt-3 flex items-start gap-1.5" style={{ color: "var(--text-4)" }}>
              <Info className="w-3.5 h-3.5 shrink-0 mt-0.5" />
              <span>{t("CV jadi")} <b>{t("bahan pembanding")}</b> {t("& mengangkat rank awal - tapi rank & kompetensi sebenarnya")} <b>{t("divalidasi lewat ujian")}</b>{t(", bukan dari CV.")}</span>
            </p>
          </div>

          <div className="card p-6">
            <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1 mb-4">
              <h3 className="font-semibold" style={{ color: "var(--text-base)" }}>{t("Profil Diekstrak dari CV")}</h3>
              {(shown.fileName || ov?.cv?.fileName) && (
                <span className="text-xs truncate max-w-full" style={{ color: "var(--text-4)" }}>{shown.fileName || ov?.cv?.fileName}</span>
              )}
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="rounded-xl p-4" style={{ background: "var(--bg-raised)" }}>
                <p className="text-xs mb-1" style={{ color: "var(--text-4)" }}>{t("Pendidikan")}</p>
                <p className="font-semibold" style={{ color: "var(--text-base)" }}>{shown.profile?.education || "-"}</p>
              </div>
              <div className="rounded-xl p-4" style={{ background: "var(--bg-raised)" }}>
                <p className="text-xs mb-1" style={{ color: "var(--text-4)" }}>{t("Pengalaman")}</p>
                <p className="font-semibold" style={{ color: "var(--text-base)" }}>{t("{n} tahun", { n: shown.profile?.experienceYears || 0 })}</p>
              </div>
              <div className="rounded-xl p-4" style={{ background: "var(--bg-raised)" }}>
                <p className="text-xs mb-1" style={{ color: "var(--text-4)" }}>{t("Terakhir diperbarui")}</p>
                <p className="font-semibold" style={{ color: "var(--text-base)" }}>{fmtDate(shown.parsedAt || ov?.cv?.parsedAt)}</p>
              </div>
            </div>
            {shown.profile?.certifications?.length > 0 && (
              <div className="mt-4">
                <p className="text-xs mb-2" style={{ color: "var(--text-4)" }}>{t("Sertifikasi/Keahlian Terdeteksi")}</p>
                <div className="flex flex-wrap gap-2">
                  {shown.profile.certifications.map((c) => (
                    <span key={c} className="text-xs bg-brand-600/20 text-brand-400 border border-brand-500/30 rounded-lg px-2.5 py-1">{c}</span>
                  ))}
                </div>
              </div>
            )}
          </div>

          <button onClick={() => inputRef.current?.click()} className="btn-outline w-full">
            {t("Upload CV Lain")}
          </button>
        </div>
      )}

      {/* Data pendukung validasi (#2) */}
      <SupportingData />
    </div>
  );
}

const EMPTY_CERT = { name: "", issuer: "", url: "" };

function SupportingData() {
  const { t } = useLang();
  const { data } = useQuery({ queryKey: ["cv-links"], queryFn: () => api.get("/user/cv-links") });
  const [links, setLinks] = useState({ linkedin: "", instagram: "", portfolio: "", other: "" });
  const [certs, setCerts] = useState([]);
  const [busy, setBusy] = useState(false);
  const hydrated = useRef(false);
  const [baseline, setBaseline] = useState("");

  const snapshot = JSON.stringify({ links, certs: certs.filter((c) => c.name?.trim()) });
  const dirty = baseline !== "" && snapshot !== baseline;

  // Isi form dari data tersimpan HANYA sekali. Tanpa penjaga ini, setiap refetch
  // (mis. balik fokus ke tab) menimpa isian yang sedang diketik tapi belum disimpan.
  useEffect(() => {
    if (!data || hydrated.current) return;
    const l = { linkedin: "", instagram: "", portfolio: "", other: "", ...(data.links || {}) };
    const c = data.extraCertifications || [];
    setLinks(l);
    setCerts(c);
    setBaseline(JSON.stringify({ links: l, certs: c.filter((x) => x.name?.trim()) }));
    hydrated.current = true;
  }, [data]);

  const LINK_FIELDS = [
    { key: "linkedin", label: "LinkedIn", Icon: Linkedin, ph: "https://linkedin.com/in/…" },
    { key: "instagram", label: t("Instagram / Medsos"), Icon: Instagram, ph: "https://instagram.com/…" },
    { key: "portfolio", label: t("Portofolio"), Icon: Globe, ph: "https://behance.net / dribbble / website…" },
    { key: "other", label: t("Tautan lain"), Icon: Link2, ph: "GitHub, YouTube, Google Drive…" },
  ];

  async function save() {
    setBusy(true);
    try {
      await api.put("/user/cv-links", { ...links, certifications: certs.filter((c) => c.name.trim()) });
      setBaseline(snapshot);
      toast.success(t("Data pendukung validasi disimpan"));
    } catch (e) {
      toast.error(typeof e === "string" ? e : t("Gagal menyimpan"));
    } finally { setBusy(false); }
  }

  return (
    <div className="card p-6 space-y-4">
      <div>
        <h3 className="font-semibold flex items-center gap-2" style={{ color: "var(--text-base)" }}>
          <ShieldCheck className="w-4 h-4 text-brand-500" /> {t("Data Pendukung Validasi")}
          {dirty && (
            <span className="text-[11px] font-medium rounded-full px-2 py-0.5 bg-amber-500/15 text-amber-500 border border-amber-500/30">
              {t("Belum disimpan")}
            </span>
          )}
        </h3>
        <p className="text-xs mt-1" style={{ color: "var(--text-4)" }}>
          {t("Portofolio, media sosial, & sertifikat memperkuat")} <b>{t("klaim skill")}</b>{t("-mu - dipakai AI saat kamu mengajukan bukti di")} <Link to="/app/jobs" className="text-brand-500 hover:underline">{t("Peta Posisi")}</Link>. {t("Ingat: kompetensi baru")} <b>{t("sah setelah lulus ujian")}</b>.
        </p>
      </div>

      {/* Tautan */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {LINK_FIELDS.map((f) => (
          <label key={f.key} className="block">
            <span className="text-xs font-medium flex items-center gap-1.5 mb-1" style={{ color: "var(--text-3)" }}><f.Icon className="w-3.5 h-3.5 text-brand-500" /> {f.label}</span>
            <input value={links[f.key] || ""} onChange={(e) => setLinks((l) => ({ ...l, [f.key]: e.target.value }))}
              placeholder={f.ph} className="input text-sm w-full" />
          </label>
        ))}
      </div>

      {/* Sertifikat tambahan */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-semibold flex items-center gap-1.5" style={{ color: "var(--text-3)" }}><Award className="w-3.5 h-3.5 text-amber-500" /> {t("Sertifikat (resmi/eksternal)")}</span>
          <button onClick={() => setCerts((c) => [...c, { ...EMPTY_CERT }])} className="text-xs text-brand-500 hover:underline flex items-center gap-1"><Plus className="w-3 h-3" /> {t("Tambah")}</button>
        </div>
        {certs.length === 0 ? (
          <p className="text-xs" style={{ color: "var(--text-4)" }}>{t("Belum ada. Tambahkan sertifikat resmi (mis. BNSP, vendor) sebagai bukti pendukung.")}</p>
        ) : (
          <div className="space-y-2">
            {certs.map((c, i) => (
              <div key={i} className="grid grid-cols-1 sm:grid-cols-[1fr_1fr_1fr_auto] gap-2 items-center">
                <input value={c.name} onChange={(e) => setCerts((arr) => arr.map((x, j) => j === i ? { ...x, name: e.target.value } : x))} placeholder={t("Nama sertifikat")} className="input text-xs" />
                <input value={c.issuer} onChange={(e) => setCerts((arr) => arr.map((x, j) => j === i ? { ...x, issuer: e.target.value } : x))} placeholder={t("Penerbit (mis. BNSP)")} className="input text-xs" />
                <input value={c.url} onChange={(e) => setCerts((arr) => arr.map((x, j) => j === i ? { ...x, url: e.target.value } : x))} placeholder={t("Tautan (opsional)")} className="input text-xs" />
                <button onClick={() => setCerts((arr) => arr.filter((_, j) => j !== i))} className="p-1.5 rounded hover:bg-red-500/10 justify-self-start" style={{ color: "var(--text-4)" }} title={t("Hapus")}><Trash2 className="w-3.5 h-3.5" /></button>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="flex items-center gap-3">
        <button onClick={save} disabled={busy} className="btn-primary text-sm flex items-center gap-1.5">
          {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} {t("Simpan Data Pendukung")}
        </button>
        <p className="text-[11px]" style={{ color: "var(--text-4)" }}>{t("Untuk verifikasi sertifikat sebagai penaik rank, gunakan")} <Link to="/app/profile" className="text-brand-500 hover:underline">{t("Bukti Eksternal")}</Link> {t("di Profil.")}</p>
      </div>
    </div>
  );
}
