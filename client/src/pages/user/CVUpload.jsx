import { useState, useRef } from "react";
import { useMutation } from "@tanstack/react-query";
import toast from "react-hot-toast";
import api from "../../api/client.js";

const LEVEL_COLORS = ["","#64748b","#6b7280","#3b82f6","#06b6d4","#0ea5e9","#2563eb","#8b5cf6","#7c3aed","#6d28d9"];

export default function CVUpload() {
  const [result, setResult] = useState(null);
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef();

  const parse = useMutation({
    mutationFn: (pdfBase64) => api.post("/user/cv-parse", { pdfBase64 }),
    onSuccess: (data) => { setResult(data); toast.success("CV berhasil dianalisis!"); },
    onError: (err) => toast.error(err || "Gagal membaca CV"),
  });

  const handleFile = (file) => {
    if (!file || file.type !== "application/pdf") return toast.error("Harap upload file PDF");
    const reader = new FileReader();
    reader.onload = (e) => parse.mutate(e.target.result);
    reader.readAsDataURL(file);
  };

  const onDrop = (e) => { e.preventDefault(); setDragging(false); handleFile(e.dataTransfer.files[0]); };

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div>
        <h2 className="text-xl font-bold text-white">Upload CV</h2>
        <p className="text-slate-400 text-sm mt-1">Unggah CV PDF — sistem akan mengekstrak profil dan memprediksi level KKNI secara otomatis.</p>
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
            <p className="text-slate-500 text-sm mt-1">Mengekstrak teks & mengklasifikasi KKNI</p>
          </>
        ) : (
          <>
            <p className="text-white font-semibold">Seret & lepas CV di sini</p>
            <p className="text-slate-500 text-sm mt-1">atau klik untuk pilih file PDF</p>
          </>
        )}
      </div>

      {/* Result */}
      {result && (
        <div className="space-y-4">
          {/* Predicted level */}
          <div className="card p-6">
            <div className="flex items-center gap-4">
              <div
                className="w-16 h-16 rounded-2xl flex items-center justify-center text-2xl font-black flex-shrink-0"
                style={{ background: `${LEVEL_COLORS[result.predictedLevel]}22`, color: LEVEL_COLORS[result.predictedLevel] }}
              >
                {result.predictedLevel}
              </div>
              <div>
                <p className="text-xs text-slate-500 mb-0.5">Level KKNI Terprediksi</p>
                <p className="text-xl font-bold text-white">{result.levelInfo?.title || `KKNI Level ${result.predictedLevel}`}</p>
                <p className="text-sm text-slate-400">{result.levelInfo?.jobGroup}</p>
              </div>
            </div>
          </div>

          {/* Extracted profile */}
          <div className="card p-6">
            <h3 className="font-semibold text-white mb-4">Profil Diekstrak dari CV</h3>
            <div className="grid sm:grid-cols-3 gap-4">
              <div className="bg-slate-900/60 rounded-xl p-4">
                <p className="text-xs text-slate-500 mb-1">Pendidikan</p>
                <p className="font-semibold text-white">{result.profile?.education || "—"}</p>
              </div>
              <div className="bg-slate-900/60 rounded-xl p-4">
                <p className="text-xs text-slate-500 mb-1">Pengalaman</p>
                <p className="font-semibold text-white">{result.profile?.experienceYears || 0} tahun</p>
              </div>
              <div className="bg-slate-900/60 rounded-xl p-4">
                <p className="text-xs text-slate-500 mb-1">Karakter CV</p>
                <p className="font-semibold text-white">{(result.textChars || 0).toLocaleString()}</p>
              </div>
            </div>
            {result.profile?.certifications?.length > 0 && (
              <div className="mt-4">
                <p className="text-xs text-slate-500 mb-2">Sertifikasi/Keahlian Terdeteksi</p>
                <div className="flex flex-wrap gap-2">
                  {result.profile.certifications.map((c) => (
                    <span key={c} className="text-xs bg-brand-600/20 text-brand-400 border border-brand-500/30 rounded-lg px-2.5 py-1">{c}</span>
                  ))}
                </div>
              </div>
            )}
          </div>

          <button
            onClick={() => { setResult(null); inputRef.current && (inputRef.current.value = ""); }}
            className="btn-outline w-full"
          >
            Upload CV Lain
          </button>
        </div>
      )}
    </div>
  );
}
