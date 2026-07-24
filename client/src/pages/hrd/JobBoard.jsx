import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Compass, Plus, Users, X, Trash2, Loader2, CheckCircle2, Star, Target, Download, Send } from "lucide-react";
import toast from "react-hot-toast";
import api from "../../api/client.js";
import useAuthStore from "../../store/authStore.js";
import { rankName } from "../../lib/rank.js";
import { useLang } from "../../lib/i18n.jsx";

const EMPTY = { title: "", company: "", location: "", department: "", description: "", kkniLevel: 3, minExperience: 0, skills: "", certifications: "", modules: "" };

function matchColor(s) { return s >= 80 ? "#10b981" : s >= 50 ? "#f59e0b" : "#ef4444"; }

// Status seleksi. "new" sengaja TIDAK dipakai sebagai tombol - itu keadaan awal
// (belum dinilai), bukan keputusan.
const REVIEW_STEPS = [
  { key: "shortlisted", label: "Daftar pendek", cls: "bg-emerald-500/15 text-emerald-500 border-emerald-500/30" },
  { key: "reviewed",    label: "Sudah dilihat", cls: "bg-brand-500/15 text-brand-600 border-brand-500/30" },
  { key: "rejected",    label: "Tidak cocok",   cls: "bg-red-500/15 text-red-500 border-red-500/30" },
  { key: "accepted",    label: "Diterima",      cls: "bg-indigo-500/15 text-indigo-500 border-indigo-500/30" },
];

const FILTERS = [
  { key: "all",        label: "Semua" },
  { key: "eligible",   label: "Memenuhi syarat" },
  { key: "almost",     label: "Tinggal diuji" },
  { key: "interested", label: "Berminat" },
  { key: "shortlist",  label: "Daftar pendek" },
];

function TalentPool({ jobId, onClose }) {
  const { t } = useLang();
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({ queryKey: ["candidates", jobId], queryFn: () => api.get(`/jobs/${jobId}/candidates`) });
  const [filter, setFilter] = useState("all");
  const [minScore, setMinScore] = useState(0);
  const [openId, setOpenId] = useState(null);
  const [note, setNote] = useState("");

  const refresh = () => qc.invalidateQueries({ queryKey: ["candidates", jobId] });

  const mark = useMutation({
    mutationFn: ({ userId, body }) => api.put(`/jobs/${jobId}/candidates/${userId}`, body),
    onSuccess: () => { refresh(); toast.success(t("Status kandidat disimpan")); },
    onError: (e) => toast.error(typeof e === "string" ? e : t("Gagal")),
  });

  const invite = useMutation({
    mutationFn: (userId) => api.post(`/jobs/${jobId}/candidates/${userId}/invite`, {}),
    onSuccess: () => { refresh(); toast.success(t("Undangan terkirim ke talenta")); },
    onError: (e) => toast.error(typeof e === "string" ? e : t("Gagal")),
  });

  // fetch mentah (bukan api client) - interceptor axios mengembalikan JSON, bukan berkas.
  async function exportXlsx() {
    try {
      const res = await fetch(`/api/jobs/${jobId}/candidates/export`, { headers: { Authorization: `Bearer ${useAuthStore.getState().token}` } });
      if (!res.ok) throw new Error("gagal");
      const url = URL.createObjectURL(await res.blob());
      const a = document.createElement("a");
      a.href = url; a.download = "kandidat.xlsx"; a.click();
      URL.revokeObjectURL(url);
      toast.success(t("File diunduh"));
    } catch { toast.error(t("Gagal ekspor")); }
  }

  const all = data?.candidates || [];
  const list = all.filter((c) => {
    if (c.matchScore < minScore) return false;
    if (filter === "eligible") return c.eligible;
    if (filter === "almost") return c.readyToValidate;
    if (filter === "interested") return c.interested;
    if (filter === "shortlist") return c.review?.status === "shortlisted" || c.review?.status === "accepted";
    return true;
  });

  return (
    <div className="is-modal fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60" onClick={onClose}>
      <div className="w-full max-w-2xl rounded-2xl max-h-[85vh] flex flex-col" style={{ backgroundColor: "var(--bg-surface)", border: "1px solid var(--border)" }} onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-3 shrink-0" style={{ borderBottom: "1px solid var(--border)" }}>
          <div className="min-w-0">
            <p className="font-bold flex items-center gap-2" style={{ color: "var(--text-base)" }}><Users className="w-4 h-4 text-brand-600" /> {t("Talent Pool")}</p>
            {data?.job && <p className="text-xs truncate" style={{ color: "var(--text-4)" }}>{data.job.title} · {t("{n} berminat", { n: data.interestedCount })}</p>}
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button onClick={exportXlsx} className="btn-outline text-xs py-1.5 px-3 flex items-center gap-1.5"><Download className="w-3.5 h-3.5" /> {t("Ekspor")}</button>
            <button onClick={onClose} style={{ color: "var(--text-3)" }}><X className="w-5 h-5" /></button>
          </div>
        </div>

        <div className="px-5 py-3 space-y-2 shrink-0" style={{ borderBottom: "1px solid var(--border)" }}>
          <div className="flex flex-wrap gap-1.5">
            {FILTERS.map((f) => (
              <button key={f.key} onClick={() => setFilter(f.key)}
                className={`px-2.5 py-1 rounded-full text-[11px] font-medium transition-colors ${filter === f.key ? "bg-brand-600 text-white" : "hover:bg-brand-500/10"}`}
                style={filter === f.key ? {} : { border: "1px solid var(--border-2)", color: "var(--text-3)" }}>
                {t(f.label)}
              </button>
            ))}
          </div>
          <label className="flex items-center gap-2 text-[11px]" style={{ color: "var(--text-4)" }}>
            {t("Kecocokan minimal")}
            <input type="range" min={0} max={100} step={5} value={minScore} onChange={(e) => setMinScore(Number(e.target.value))} className="flex-1 accent-brand-600" />
            <span className="tabular-nums w-8 text-right">{minScore}%</span>
          </label>
        </div>

        <div className="p-4 space-y-2 overflow-y-auto">
          {isLoading ? <p className="text-sm text-center py-6" style={{ color: "var(--text-4)" }}>{t("Memuat…")}</p>
            : !list.length ? <p className="text-sm text-center py-6" style={{ color: "var(--text-4)" }}>{t("Tidak ada talenta yang cocok dengan saringan ini.")}</p>
            : list.map((c) => {
              const step = REVIEW_STEPS.find((s) => s.key === c.review?.status);
              const open = openId === c.user.id;
              return (
                <div key={c.user.id} className="rounded-lg p-3" style={{ border: "1px solid var(--border)", backgroundColor: c.interested ? "rgba(245,158,11,0.06)" : "transparent" }}>
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold truncate flex items-center gap-1.5" style={{ color: "var(--text-base)" }}>
                        {c.interested && <Star className="w-3.5 h-3.5 text-amber-500 fill-amber-500 shrink-0" />}{c.user.name}
                        {step && <span className={`text-[10px] px-1.5 py-0.5 rounded-full border ${step.cls}`}>{t(step.label)}</span>}
                        {c.review?.invitedAt && <Send className="w-3 h-3 text-brand-500 shrink-0" title={t("Sudah diundang")} />}
                      </p>
                      <p className="text-xs" style={{ color: "var(--text-4)" }}>
                        {c.user.currentKkniLevel ? rankName(c.user.currentKkniLevel) : "Unranked"} · {t("{n} th", { n: c.user.experienceYears || 0 })} · {c.user.position || "-"}
                        {c.eligible && <span className="text-emerald-500">{t(" · siap ✓")}</span>}
                      </p>
                      {/* Yang dicari HRD: yang sudah mengklaim tapi belum dibuktikan lewat ujian. */}
                      {c.claimedSkills?.length > 0 && (
                        <p className="text-[11px] mt-0.5 text-amber-500">{t("belum diuji: {skills}", { skills: c.claimedSkills.slice(0, 3).join(", ") })}</p>
                      )}
                      {c.missingSkills?.length > 0 && <p className="text-[11px] mt-0.5" style={{ color: "var(--text-4)" }}>{t("perlu: {skills}", { skills: c.missingSkills.slice(0, 3).join(", ") })}</p>}
                      {c.review?.note && <p className="text-[11px] mt-1 italic" style={{ color: "var(--text-3)" }}>“{c.review.note}”</p>}
                    </div>
                    <div className="text-center shrink-0">
                      <p className="text-lg font-black" style={{ color: matchColor(c.matchScore) }}>{c.matchScore}%</p>
                      <button onClick={() => { setOpenId(open ? null : c.user.id); setNote(c.review?.note || ""); }}
                        className="text-[10px] hover:underline" style={{ color: "var(--text-4)" }}>
                        {open ? t("tutup") : t("nilai")}
                      </button>
                    </div>
                  </div>

                  {open && (
                    <div className="mt-3 pt-3 space-y-2" style={{ borderTop: "1px solid var(--border)" }}>
                      <div className="flex flex-wrap gap-1.5">
                        {REVIEW_STEPS.map((s) => (
                          <button key={s.key} onClick={() => mark.mutate({ userId: c.user.id, body: { status: s.key } })}
                            className={`px-2.5 py-1 rounded-full text-[11px] border transition-colors ${c.review?.status === s.key ? s.cls : "hover:bg-brand-500/10"}`}
                            style={c.review?.status === s.key ? {} : { borderColor: "var(--border-2)", color: "var(--text-3)" }}>
                            {t(s.label)}
                          </button>
                        ))}
                      </div>
                      <div className="flex gap-2">
                        <input value={note} onChange={(e) => setNote(e.target.value)} className="input text-xs py-1.5 flex-1"
                          placeholder={t("Catatan singkat untuk tim…")} />
                        <button onClick={() => mark.mutate({ userId: c.user.id, body: { note } })} className="btn-outline text-xs py-1.5 px-3">{t("Simpan")}</button>
                      </div>
                      <button onClick={() => invite.mutate(c.user.id)} disabled={invite.isPending}
                        className="btn-primary text-xs py-1.5 px-3 flex items-center gap-1.5 disabled:opacity-50">
                        <Send className="w-3.5 h-3.5" /> {c.review?.invitedAt ? t("Undang lagi") : t("Undang ke posisi ini")}
                      </button>
                      <p className="text-[10px]" style={{ color: "var(--text-4)" }}>
                        {t("Talenta menerima notifikasi berisi kecocokannya dan apa yang masih perlu dikuasai.")}
                      </p>
                    </div>
                  )}
                </div>
              );
            })}
        </div>
      </div>
    </div>
  );
}

export default function JobBoard() {
  const { t } = useLang();
  const qc = useQueryClient();
  const [form, setForm] = useState(EMPTY);
  const [showForm, setShowForm] = useState(false);
  const [viewing, setViewing] = useState(null);

  const { data: jobs = [], isLoading } = useQuery({ queryKey: ["hrd-jobs"], queryFn: () => api.get("/jobs/mine") });

  const create = useMutation({
    mutationFn: (payload) => api.post("/jobs", payload),
    onSuccess: () => { toast.success(t("Posisi dipetakan")); setForm(EMPTY); setShowForm(false); qc.invalidateQueries(["hrd-jobs"]); },
    onError: (e) => toast.error(typeof e === "string" ? e : t("Gagal")),
  });
  const toggle = useMutation({
    mutationFn: ({ id, status }) => api.put(`/jobs/${id}`, { status }),
    onSuccess: () => qc.invalidateQueries(["hrd-jobs"]),
  });
  const remove = useMutation({
    mutationFn: (id) => api.delete(`/jobs/${id}`),
    onSuccess: () => { toast.success(t("Posisi dihapus")); qc.invalidateQueries(["hrd-jobs"]); },
  });

  function parseModules(str) {
    return str.split("\n").map((line) => {
      const [title, url] = line.split("|").map((s) => s.trim());
      return title ? { title, url: url || undefined } : null;
    }).filter(Boolean);
  }

  function submit(e) {
    e.preventDefault();
    if (!form.title.trim()) { toast.error(t("Judul posisi wajib")); return; }
    const skills = form.skills.split(",").map((s) => s.trim()).filter(Boolean);
    // Tanpa daftar kemampuan, tak ada yang bisa dicocokkan - dan semua talenta akan
    // terbaca memenuhi syarat. Ditahan di sini supaya pesannya muncul sebelum kirim.
    if (!skills.length) { toast.error(t("Isi minimal satu kemampuan yang dibutuhkan posisi ini.")); return; }
    create.mutate({
      ...form,
      kkniLevel: Number(form.kkniLevel), minExperience: Number(form.minExperience),
      skills,
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
          <h2 className="text-xl font-bold flex items-center gap-2" style={{ color: "var(--text-base)" }}><Compass className="w-5 h-5 text-brand-600" /> {t("Peta Posisi & Talenta")}</h2>
          <p className="text-sm mt-1" style={{ color: "var(--text-3)" }}>{t("Petakan posisi target berkriteria + modul belajar. Dapatkan talent pool internal terurut kesiapan.")}</p>
        </div>
        <button onClick={() => setShowForm((v) => !v)} className="btn-primary text-sm py-2 px-4 flex items-center gap-1.5"><Plus className="w-4 h-4" /> {t("Posisi Baru")}</button>
      </div>

      {showForm && (
        <form onSubmit={submit} className="card p-5 space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div><label className="text-xs" style={{ color: "var(--text-3)" }}>{t("Judul posisi *")}</label>{inp("title", { placeholder: t("Video Editor Senior") })}</div>
            <div><label className="text-xs" style={{ color: "var(--text-3)" }}>{t("Perusahaan/Unit")}</label>{inp("company", { placeholder: "PT Kreatif" })}</div>
            <div><label className="text-xs" style={{ color: "var(--text-3)" }}>{t("Lokasi")}</label>{inp("location", { placeholder: "Jakarta" })}</div>
            <div><label className="text-xs" style={{ color: "var(--text-3)" }}>{t("Departemen")}</label>{inp("department", { placeholder: t("Produksi") })}</div>
            <div><label className="text-xs" style={{ color: "var(--text-3)" }}>{t("Min. Skill Rank - setara level KKNI 3 (Gold) sampai 9 (Legend)")}</label>{inp("kkniLevel", { type: "number", min: 3, max: 9 })}</div>
            <div><label className="text-xs" style={{ color: "var(--text-3)" }}>{t("Min. Pengalaman (th)")}</label>{inp("minExperience", { type: "number", min: 0 })}</div>
          </div>
          <div>
            <label className="text-xs" style={{ color: "var(--text-3)" }}>{t("Keahlian dibutuhkan (pisah koma) *")}</label>
            {inp("skills", { placeholder: t("Menyunting Audio/Video, Export Hasil Editing") })}
            <p className="text-[11px] mt-1" style={{ color: "var(--text-4)" }}>{t("Wajib diisi - inilah yang dicocokkan dengan kompetensi yang sudah dibuktikan talenta lewat ujian.")}</p>
          </div>
          <div><label className="text-xs" style={{ color: "var(--text-3)" }}>{t("Sertifikasi diminta (pisah koma)")}</label>{inp("certifications", { placeholder: "Menyunting Audio/Video" })}</div>
          <div>
            <label className="text-xs" style={{ color: "var(--text-3)" }}>{t("Modul belajar untuk memenuhi posisi (satu per baris, format")} <b>{t("Judul | URL")}</b>)</label>
            <textarea value={form.modules} onChange={(e) => setForm((f) => ({ ...f, modules: e.target.value }))} className="input text-sm" rows={3} placeholder={t("Dasar Penyuntingan Video | https://avataredu.ai/...\nSertifikasi K3 Editing")} />
          </div>
          <div><label className="text-xs" style={{ color: "var(--text-3)" }}>{t("Deskripsi")}</label>
            <textarea value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} className="input text-sm" rows={2} />
          </div>
          <button type="submit" disabled={create.isPending} className="btn-primary text-sm py-2 px-4 flex items-center gap-1.5">
            {create.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />} {t("Petakan Posisi")}
          </button>
        </form>
      )}

      {isLoading ? (
        <div className="text-center py-10" style={{ color: "var(--text-4)" }}>{t("Memuat…")}</div>
      ) : jobs.length === 0 ? (
        <div className="card p-10 text-center" style={{ color: "var(--text-3)" }}>{t("Belum ada posisi. Klik")} <b>{t("Posisi Baru")}</b> {t("untuk memetakan.")}</div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {jobs.map((j) => (
            <div key={j.id} className="card p-5">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="font-bold" style={{ color: "var(--text-base)" }}>{j.title}</p>
                  <p className="text-xs" style={{ color: "var(--text-4)" }}>{j.company || "-"} · {t("min.")} {rankName(j.kkniLevel)} · {t("{n} th", { n: j.minExperience })}</p>
                </div>
                <span className={`badge ${j.status === "open" ? "badge-ready" : "badge-not-ready"}`}>{j.status === "open" ? t("Aktif") : t("Ditutup")}</span>
              </div>
              <div className="flex flex-wrap gap-1.5 mt-2">
                {j.skills.map((s) => <span key={s} className="text-xs px-2 py-0.5 rounded-full" style={{ backgroundColor: "var(--bg-muted)", color: "var(--text-3)" }}>{s}</span>)}
              </div>
              {/* Posisi lama yang terlanjur kosong: kecocokan tak bisa dinilai, jadi jangan
                  biarkan perekrut membaca daftar kandidatnya seolah sudah tersaring. */}
              {j.skills.length === 0 && (
                <p className="text-[11px] mt-2 rounded-lg px-2 py-1.5" style={{ background: "rgba(245,158,11,0.12)", color: "#b45309" }}>
                  {t("Posisi ini belum mencantumkan kemampuan, jadi kandidatnya belum bisa disaring. Lengkapi dulu.")}
                </p>
              )}
              {j.modules?.length > 0 && <p className="text-[11px] mt-2" style={{ color: "var(--text-4)" }}>{t("📚 {n} modul terlampir", { n: j.modules.length })}</p>}
              <div className="flex items-center gap-2 mt-4">
                <button onClick={() => setViewing(j.id)} className="btn-outline text-xs py-1.5 px-3 flex items-center gap-1.5"><Users className="w-3.5 h-3.5" /> {t("Talent Pool")}</button>
                {j.interestedCount > 0 && <span className="text-xs flex items-center gap-1 text-amber-600"><Star className="w-3.5 h-3.5 fill-amber-500" /> {t("{n} berminat", { n: j.interestedCount })}</span>}
                <button onClick={() => toggle.mutate({ id: j.id, status: j.status === "open" ? "closed" : "open" })} className="btn-outline text-xs py-1.5 px-3">{j.status === "open" ? t("Tutup") : t("Buka")}</button>
                <button onClick={() => confirm(t("Hapus posisi ini?")) && remove.mutate(j.id)} className="text-xs py-1.5 px-2 rounded-lg text-red-500 hover:bg-red-50 ml-auto"><Trash2 className="w-4 h-4" /></button>
              </div>
            </div>
          ))}
        </div>
      )}

      {viewing && <TalentPool jobId={viewing} onClose={() => setViewing(null)} />}
    </div>
  );
}
