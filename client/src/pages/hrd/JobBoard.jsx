import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Compass, Plus, Users, X, Trash2, Loader2, CheckCircle2, Star, Target } from "lucide-react";
import toast from "react-hot-toast";
import api from "../../api/client.js";
import { rankName } from "../../lib/rank.js";

const EMPTY = { title: "", company: "", location: "", department: "", description: "", kkniLevel: 3, minExperience: 0, skills: "", certifications: "", modules: "" };

function matchColor(s) { return s >= 80 ? "#10b981" : s >= 50 ? "#f59e0b" : "#ef4444"; }

function TalentPool({ jobId, onClose }) {
  const { data, isLoading } = useQuery({ queryKey: ["candidates", jobId], queryFn: () => api.get(`/jobs/${jobId}/candidates`) });
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60" onClick={onClose}>
      <div className="w-full max-w-lg rounded-2xl max-h-[80vh] overflow-y-auto" style={{ backgroundColor: "var(--bg-surface)", border: "1px solid var(--border)" }} onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-3 sticky top-0" style={{ backgroundColor: "var(--bg-surface)", borderBottom: "1px solid var(--border)" }}>
          <div>
            <p className="font-bold flex items-center gap-2" style={{ color: "var(--text-base)" }}><Users className="w-4 h-4 text-brand-600" /> Talent Pool</p>
            {data?.job && <p className="text-xs" style={{ color: "var(--text-4)" }}>{data.job.title} · {data.interestedCount} berminat</p>}
          </div>
          <button onClick={onClose} style={{ color: "var(--text-3)" }}><X className="w-5 h-5" /></button>
        </div>
        <div className="p-4 space-y-2">
          <p className="text-xs mb-1" style={{ color: "var(--text-4)" }}>Semua pekerja terurut kecocokan. ⭐ = menyatakan minat pada posisi ini.</p>
          {isLoading ? <p className="text-sm text-center py-6" style={{ color: "var(--text-4)" }}>Memuat…</p>
            : !data?.candidates?.length ? <p className="text-sm text-center py-6" style={{ color: "var(--text-4)" }}>Belum ada pekerja.</p>
            : data.candidates.map((c) => (
              <div key={c.user.id} className="flex items-center justify-between gap-3 rounded-lg p-3" style={{ border: "1px solid var(--border)", backgroundColor: c.interested ? "rgba(245,158,11,0.06)" : "transparent" }}>
                <div className="min-w-0">
                  <p className="text-sm font-semibold truncate flex items-center gap-1.5" style={{ color: "var(--text-base)" }}>
                    {c.interested && <Star className="w-3.5 h-3.5 text-amber-500 fill-amber-500 shrink-0" />}{c.user.name}
                  </p>
                  <p className="text-xs" style={{ color: "var(--text-4)" }}>
                    {c.user.currentKkniLevel ? rankName(c.user.currentKkniLevel) : "Unranked"} · {c.user.experienceYears || 0} th · {c.user.position || "-"}
                    {c.eligible && <span className="text-emerald-500"> · siap ✓</span>}
                  </p>
                  {c.missingSkills?.length > 0 && <p className="text-[11px] mt-0.5" style={{ color: "var(--text-4)" }}>perlu: {c.missingSkills.slice(0, 3).join(", ")}</p>}
                </div>
                <div className="text-center shrink-0">
                  <p className="text-lg font-black" style={{ color: matchColor(c.matchScore) }}>{c.matchScore}%</p>
                  <p className="text-[10px]" style={{ color: "var(--text-4)" }}>cocok</p>
                </div>
              </div>
            ))}
        </div>
      </div>
    </div>
  );
}

export default function JobBoard() {
  const qc = useQueryClient();
  const [form, setForm] = useState(EMPTY);
  const [showForm, setShowForm] = useState(false);
  const [viewing, setViewing] = useState(null);

  const { data: jobs = [], isLoading } = useQuery({ queryKey: ["hrd-jobs"], queryFn: () => api.get("/jobs/mine") });

  const create = useMutation({
    mutationFn: (payload) => api.post("/jobs", payload),
    onSuccess: () => { toast.success("Posisi dipetakan"); setForm(EMPTY); setShowForm(false); qc.invalidateQueries(["hrd-jobs"]); },
    onError: (e) => toast.error(typeof e === "string" ? e : "Gagal"),
  });
  const toggle = useMutation({
    mutationFn: ({ id, status }) => api.put(`/jobs/${id}`, { status }),
    onSuccess: () => qc.invalidateQueries(["hrd-jobs"]),
  });
  const remove = useMutation({
    mutationFn: (id) => api.delete(`/jobs/${id}`),
    onSuccess: () => { toast.success("Posisi dihapus"); qc.invalidateQueries(["hrd-jobs"]); },
  });

  function parseModules(str) {
    return str.split("\n").map((line) => {
      const [title, url] = line.split("|").map((s) => s.trim());
      return title ? { title, url: url || undefined } : null;
    }).filter(Boolean);
  }

  function submit(e) {
    e.preventDefault();
    if (!form.title.trim()) { toast.error("Judul posisi wajib"); return; }
    create.mutate({
      ...form,
      kkniLevel: Number(form.kkniLevel), minExperience: Number(form.minExperience),
      skills: form.skills.split(",").map((s) => s.trim()).filter(Boolean),
      certifications: form.certifications.split(",").map((s) => s.trim()).filter(Boolean),
      modules: parseModules(form.modules),
    });
  }
  const inp = (k, extra = {}) => (
    <input value={form[k]} onChange={(e) => setForm((f) => ({ ...f, [k]: e.target.value }))} className="input text-sm" {...extra} />
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold flex items-center gap-2" style={{ color: "var(--text-base)" }}><Compass className="w-5 h-5 text-brand-600" /> Peta Posisi & Talenta</h2>
          <p className="text-sm mt-1" style={{ color: "var(--text-3)" }}>Petakan posisi target berkriteria + modul belajar. Dapatkan talent pool internal terurut kesiapan.</p>
        </div>
        <button onClick={() => setShowForm((v) => !v)} className="btn-primary text-sm py-2 px-4 flex items-center gap-1.5"><Plus className="w-4 h-4" /> Posisi Baru</button>
      </div>

      {showForm && (
        <form onSubmit={submit} className="card p-5 space-y-3">
          <div className="grid sm:grid-cols-2 gap-3">
            <div><label className="text-xs" style={{ color: "var(--text-3)" }}>Judul posisi *</label>{inp("title", { placeholder: "Video Editor Senior" })}</div>
            <div><label className="text-xs" style={{ color: "var(--text-3)" }}>Perusahaan/Unit</label>{inp("company", { placeholder: "PT Kreatif" })}</div>
            <div><label className="text-xs" style={{ color: "var(--text-3)" }}>Lokasi</label>{inp("location", { placeholder: "Jakarta" })}</div>
            <div><label className="text-xs" style={{ color: "var(--text-3)" }}>Departemen</label>{inp("department", { placeholder: "Produksi" })}</div>
            <div><label className="text-xs" style={{ color: "var(--text-3)" }}>Min. Skill Rank (1=Bronze … 9=Legend)</label>{inp("kkniLevel", { type: "number", min: 1, max: 9 })}</div>
            <div><label className="text-xs" style={{ color: "var(--text-3)" }}>Min. Pengalaman (th)</label>{inp("minExperience", { type: "number", min: 0 })}</div>
          </div>
          <div><label className="text-xs" style={{ color: "var(--text-3)" }}>Keahlian dibutuhkan (pisah koma)</label>{inp("skills", { placeholder: "Menyunting Audio/Video, Export Hasil Editing" })}</div>
          <div><label className="text-xs" style={{ color: "var(--text-3)" }}>Sertifikasi diminta (pisah koma)</label>{inp("certifications", { placeholder: "Menyunting Audio/Video" })}</div>
          <div>
            <label className="text-xs" style={{ color: "var(--text-3)" }}>Modul belajar untuk memenuhi posisi (satu per baris, format <b>Judul | URL</b>)</label>
            <textarea value={form.modules} onChange={(e) => setForm((f) => ({ ...f, modules: e.target.value }))} className="input text-sm" rows={3} placeholder={"Dasar Penyuntingan Video | https://avataredu.ai/...\nSertifikasi K3 Editing"} />
          </div>
          <div><label className="text-xs" style={{ color: "var(--text-3)" }}>Deskripsi</label>
            <textarea value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} className="input text-sm" rows={2} />
          </div>
          <button type="submit" disabled={create.isPending} className="btn-primary text-sm py-2 px-4 flex items-center gap-1.5">
            {create.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />} Petakan Posisi
          </button>
        </form>
      )}

      {isLoading ? (
        <div className="text-center py-10" style={{ color: "var(--text-4)" }}>Memuat…</div>
      ) : jobs.length === 0 ? (
        <div className="card p-10 text-center" style={{ color: "var(--text-3)" }}>Belum ada posisi. Klik <b>Posisi Baru</b> untuk memetakan.</div>
      ) : (
        <div className="grid sm:grid-cols-2 gap-4">
          {jobs.map((j) => (
            <div key={j.id} className="card p-5">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="font-bold" style={{ color: "var(--text-base)" }}>{j.title}</p>
                  <p className="text-xs" style={{ color: "var(--text-4)" }}>{j.company || "-"} · min. {rankName(j.kkniLevel)} · {j.minExperience} th</p>
                </div>
                <span className={`badge ${j.status === "open" ? "badge-ready" : "badge-not-ready"}`}>{j.status === "open" ? "Aktif" : "Ditutup"}</span>
              </div>
              <div className="flex flex-wrap gap-1.5 mt-2">
                {j.skills.map((s) => <span key={s} className="text-xs px-2 py-0.5 rounded-full" style={{ backgroundColor: "var(--bg-muted)", color: "var(--text-3)" }}>{s}</span>)}
              </div>
              {j.modules?.length > 0 && <p className="text-[11px] mt-2" style={{ color: "var(--text-4)" }}>📚 {j.modules.length} modul terlampir</p>}
              <div className="flex items-center gap-2 mt-4">
                <button onClick={() => setViewing(j.id)} className="btn-outline text-xs py-1.5 px-3 flex items-center gap-1.5"><Users className="w-3.5 h-3.5" /> Talent Pool</button>
                {j.interestedCount > 0 && <span className="text-xs flex items-center gap-1 text-amber-600"><Star className="w-3.5 h-3.5 fill-amber-500" /> {j.interestedCount} berminat</span>}
                <button onClick={() => toggle.mutate({ id: j.id, status: j.status === "open" ? "closed" : "open" })} className="btn-outline text-xs py-1.5 px-3">{j.status === "open" ? "Tutup" : "Buka"}</button>
                <button onClick={() => confirm("Hapus posisi ini?") && remove.mutate(j.id)} className="text-xs py-1.5 px-2 rounded-lg text-red-500 hover:bg-red-50 ml-auto"><Trash2 className="w-4 h-4" /></button>
              </div>
            </div>
          ))}
        </div>
      )}

      {viewing && <TalentPool jobId={viewing} onClose={() => setViewing(null)} />}
    </div>
  );
}
