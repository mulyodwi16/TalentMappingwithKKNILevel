import { useState, useRef, useEffect } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import toast from "react-hot-toast";
import {
  Linkedin, Instagram, Globe, Link2, Award, Plus, Trash2, Save, Loader2, ShieldCheck, Info,
} from "lucide-react";
import api from "../../api/client.js";
import { rankName } from "../../lib/rank.js";

const LEVEL_COLORS = ["","#64748b","#6b7280","#3b82f6","#06b6d4","#0ea5e9","#2563eb","#8b5cf6","#7c3aed","#6d28d9"];

export default function CVUpload() {
  const [result, setResult] = useState(null);
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef();

  const parse = useMutation({
    mutationFn: ({ pdfBase64, fileName }) => api.post("/user/cv-parse", { pdfBase64, fileName }),
    onSuccess: (data) => { setResult(data); toast.success("CV berhasil dianalisis & disimpan ke profil!"); },
    onError: (err) => toast.error(err || "Gagal membaca CV"),
  });

  const handleFile = (file) => {
    if (!file || file.type !== "application/pdf") return toast.error("Harap upload file PDF");
    const reader = new FileReader();
    reader.onload = (e) => parse.mutate({ pdfBase64: e.target.result, fileName: file.name });
    reader.readAsDataURL(file);
  };

  const onDrop = (e) => { e.preventDefault(); setDragging(false); handleFile(e.dataTransfer.files[0]); };

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div>
        <h2 className="text-xl font-bold" style={{ color: "var(--text-base)" }}>Upload CV & Data Validasi</h2>
        <p className="text-sm mt-1" style={{ color: "var(--text-4)" }}>Unggah CV PDF untuk ekstraksi profil & prediksi Skill Rank, lalu lengkapi data pendukung validasi (portofolio, medsos, sertifikat).</p>
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
            <p className="text-brand-400 font-semibold">Menganalisis CV…</p>
            <p className="text-sm mt-1" style={{ color: "var(--text-4)" }}>Mengekstrak teks & mengklasifikasi Skill Rank</p>
          </>
        ) : (
          <>
            <p className="font-semibold" style={{ color: "var(--text-base)" }}>Letakkan file CV (PDF) di sini</p>
            <p className="text-sm mt-1" style={{ color: "var(--text-4)" }}>atau klik area ini untuk memilih file</p>
          </>
        )}
      </div>

      {/* Result */}
      {result && (
        <div className="space-y-4">
          <div className="card p-6">
            <div className="flex items-center gap-4">
              <div className="w-16 h-16 rounded-2xl flex items-center justify-center text-2xl font-black flex-shrink-0"
                style={{ background: `${LEVEL_COLORS[result.predictedLevel]}22`, color: LEVEL_COLORS[result.predictedLevel] }}>
                {result.predictedLevel}
              </div>
              <div>
                <p className="text-xs mb-0.5" style={{ color: "var(--text-4)" }}>Skill Rank Terprediksi (seed pendidikan)</p>
                <p className="text-xl font-bold" style={{ color: "var(--text-base)" }}>{rankName(result.predictedLevel)}<span className="text-sm font-normal" style={{ color: "var(--text-4)" }}> · {result.levelInfo?.title}</span></p>
                <p className="text-sm" style={{ color: "var(--text-4)" }}>{result.levelInfo?.jobGroup}</p>
              </div>
            </div>
            <p className="text-[11px] mt-3 flex items-start gap-1.5" style={{ color: "var(--text-4)" }}>
              <Info className="w-3.5 h-3.5 shrink-0 mt-0.5" /> CV jadi <b>bahan pembanding</b> & mengangkat seed rank — tapi rank & kompetensi sebenarnya <b>divalidasi lewat ujian</b>, bukan dari CV.
            </p>
          </div>

          <div className="card p-6">
            <h3 className="font-semibold mb-4" style={{ color: "var(--text-base)" }}>Profil Diekstrak dari CV</h3>
            <div className="grid sm:grid-cols-3 gap-4">
              <div className="rounded-xl p-4" style={{ background: "var(--bg-raised)" }}>
                <p className="text-xs mb-1" style={{ color: "var(--text-4)" }}>Pendidikan</p>
                <p className="font-semibold" style={{ color: "var(--text-base)" }}>{result.profile?.education || "—"}</p>
              </div>
              <div className="rounded-xl p-4" style={{ background: "var(--bg-raised)" }}>
                <p className="text-xs mb-1" style={{ color: "var(--text-4)" }}>Pengalaman</p>
                <p className="font-semibold" style={{ color: "var(--text-base)" }}>{result.profile?.experienceYears || 0} tahun</p>
              </div>
              <div className="rounded-xl p-4" style={{ background: "var(--bg-raised)" }}>
                <p className="text-xs mb-1" style={{ color: "var(--text-4)" }}>Karakter CV</p>
                <p className="font-semibold" style={{ color: "var(--text-base)" }}>{(result.textChars || 0).toLocaleString()}</p>
              </div>
            </div>
            {result.profile?.certifications?.length > 0 && (
              <div className="mt-4">
                <p className="text-xs mb-2" style={{ color: "var(--text-4)" }}>Sertifikasi/Keahlian Terdeteksi</p>
                <div className="flex flex-wrap gap-2">
                  {result.profile.certifications.map((c) => (
                    <span key={c} className="text-xs bg-brand-600/20 text-brand-400 border border-brand-500/30 rounded-lg px-2.5 py-1">{c}</span>
                  ))}
                </div>
              </div>
            )}
          </div>

          <button onClick={() => { setResult(null); inputRef.current && (inputRef.current.value = ""); }} className="btn-outline w-full">
            Upload CV Lain
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
  const { data } = useQuery({ queryKey: ["cv-links"], queryFn: () => api.get("/user/cv-links") });
  const [links, setLinks] = useState({ linkedin: "", instagram: "", portfolio: "", other: "" });
  const [certs, setCerts] = useState([]);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!data) return;
    setLinks({ linkedin: "", instagram: "", portfolio: "", other: "", ...(data.links || {}) });
    setCerts(data.extraCertifications || []);
  }, [data]);

  const LINK_FIELDS = [
    { key: "linkedin", label: "LinkedIn", Icon: Linkedin, ph: "https://linkedin.com/in/…" },
    { key: "instagram", label: "Instagram / Medsos", Icon: Instagram, ph: "https://instagram.com/…" },
    { key: "portfolio", label: "Portofolio", Icon: Globe, ph: "https://behance.net / dribbble / website…" },
    { key: "other", label: "Tautan lain", Icon: Link2, ph: "GitHub, YouTube, Google Drive…" },
  ];

  async function save() {
    setBusy(true);
    try {
      await api.put("/user/cv-links", { ...links, certifications: certs.filter((c) => c.name.trim()) });
      toast.success("Data pendukung validasi disimpan");
    } catch (e) {
      toast.error(typeof e === "string" ? e : "Gagal menyimpan");
    } finally { setBusy(false); }
  }

  return (
    <div className="card p-6 space-y-4">
      <div>
        <h3 className="font-semibold flex items-center gap-2" style={{ color: "var(--text-base)" }}>
          <ShieldCheck className="w-4 h-4 text-brand-500" /> Data Pendukung Validasi
        </h3>
        <p className="text-xs mt-1" style={{ color: "var(--text-4)" }}>
          Portofolio, media sosial, & sertifikat memperkuat <b>klaim skill</b>-mu — dipakai AI saat kamu mengajukan bukti di <Link to="/app/jobs" className="text-brand-500 hover:underline">Peta Posisi</Link>. Ingat: kompetensi baru <b>sah setelah lulus ujian</b>.
        </p>
      </div>

      {/* Tautan */}
      <div className="grid sm:grid-cols-2 gap-3">
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
          <span className="text-xs font-semibold flex items-center gap-1.5" style={{ color: "var(--text-3)" }}><Award className="w-3.5 h-3.5 text-amber-500" /> Sertifikat (resmi/eksternal)</span>
          <button onClick={() => setCerts((c) => [...c, { ...EMPTY_CERT }])} className="text-xs text-brand-500 hover:underline flex items-center gap-1"><Plus className="w-3 h-3" /> Tambah</button>
        </div>
        {certs.length === 0 ? (
          <p className="text-xs" style={{ color: "var(--text-4)" }}>Belum ada. Tambahkan sertifikat resmi (mis. BNSP, vendor) sebagai bukti pendukung.</p>
        ) : (
          <div className="space-y-2">
            {certs.map((c, i) => (
              <div key={i} className="grid sm:grid-cols-[1fr_1fr_1fr_auto] gap-2 items-center">
                <input value={c.name} onChange={(e) => setCerts((arr) => arr.map((x, j) => j === i ? { ...x, name: e.target.value } : x))} placeholder="Nama sertifikat" className="input text-xs" />
                <input value={c.issuer} onChange={(e) => setCerts((arr) => arr.map((x, j) => j === i ? { ...x, issuer: e.target.value } : x))} placeholder="Penerbit (mis. BNSP)" className="input text-xs" />
                <input value={c.url} onChange={(e) => setCerts((arr) => arr.map((x, j) => j === i ? { ...x, url: e.target.value } : x))} placeholder="Tautan (opsional)" className="input text-xs" />
                <button onClick={() => setCerts((arr) => arr.filter((_, j) => j !== i))} className="p-1.5 rounded hover:bg-red-500/10 justify-self-start" style={{ color: "var(--text-4)" }} title="Hapus"><Trash2 className="w-3.5 h-3.5" /></button>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="flex items-center gap-3">
        <button onClick={save} disabled={busy} className="btn-primary text-sm flex items-center gap-1.5">
          {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} Simpan Data Pendukung
        </button>
        <p className="text-[11px]" style={{ color: "var(--text-4)" }}>Untuk verifikasi sertifikat sebagai penaik rank, gunakan <Link to="/app/profile" className="text-brand-500 hover:underline">Bukti Eksternal</Link> di Profil.</p>
      </div>
    </div>
  );
}
