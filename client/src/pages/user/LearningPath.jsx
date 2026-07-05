import { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import toast from "react-hot-toast";
import {
  Sparkles, Target, Loader2, RefreshCw, CheckCircle2, CircleDashed, CircleDot,
  GraduationCap, ChevronDown, Star, Compass, TrendingUp, AlertTriangle,
} from "lucide-react";
import api from "../../api/client.js";
import { rankName, rankColor } from "../../lib/rank.js";

const DIFF = {
  beginner:     { label: "Pemula",   cls: "bg-emerald-500/15 text-emerald-500 border-emerald-500/30" },
  intermediate: { label: "Menengah", cls: "bg-amber-500/15 text-amber-500 border-amber-500/30" },
  advanced:     { label: "Mahir",    cls: "bg-violet-500/15 text-violet-400 border-violet-500/30" },
};

const PROGRESS = {
  todo:  { label: "Belum Mulai", Icon: CircleDashed, cls: "text-[var(--text-4)]" },
  doing: { label: "Dikerjakan",  Icon: CircleDot,    cls: "text-amber-500" },
  done:  { label: "Selesai",     Icon: CheckCircle2, cls: "text-emerald-500" },
};

const VERDICT = {
  on_track:  { label: "Di Jalur yang Tepat", Icon: TrendingUp,    ring: "#10b981", chip: "bg-emerald-500/15 text-emerald-500" },
  needs_work:{ label: "Perlu Pengerjaan",    Icon: Compass,       ring: "#f59e0b", chip: "bg-amber-500/15 text-amber-500" },
  not_ready: { label: "Perlu Peningkatan",   Icon: AlertTriangle, ring: "#ef4444", chip: "bg-red-500/15 text-red-400" },
};

// ── Kursus AvatarEdu yang cocok untuk sebuah langkah (lazy saat dibuka) ────────
function StepCourses({ query }) {
  const { data, isLoading, isError } = useQuery({
    queryKey: ["lp-courses", query],
    queryFn: () => api.get(`/avataredu/courses?q=${encodeURIComponent(query)}&per_page=3`),
    staleTime: 5 * 60 * 1000,
    enabled: !!query,
  });
  const courses = data?.data || [];
  if (isLoading) return <p className="text-xs py-2" style={{ color: "var(--text-4)" }}>Mencari kursus…</p>;
  if (isError || courses.length === 0) return <p className="text-xs py-2" style={{ color: "var(--text-4)" }}>Belum ada kursus cocok di AvatarEdu.</p>;
  return (
    <div className="grid sm:grid-cols-3 gap-2 pt-1">
      {courses.map((c) => (
        <Link key={c.slug} to="/app/toko"
          className="rounded-lg border p-2.5 flex flex-col gap-1 hover:border-brand-500/50 transition-colors"
          style={{ background: "var(--bg-raised)", borderColor: "var(--border)" }}>
          <div className="flex items-center gap-1.5 text-[11px]" style={{ color: "var(--text-4)" }}>
            <GraduationCap className="w-3 h-3 text-brand-500" />
            {c.average_rating > 0 && <span className="flex items-center gap-0.5 text-amber-400"><Star className="w-2.5 h-2.5 fill-amber-400" />{c.average_rating.toFixed(1)}</span>}
            {c.duration_hours ? <span>{c.duration_hours} jam</span> : null}
          </div>
          <p className="text-xs font-medium line-clamp-2" style={{ color: "var(--text-base)" }}>{c.title}</p>
          <span className="text-[11px] text-brand-500 mt-auto">Buka di Toko →</span>
        </Link>
      ))}
    </div>
  );
}

function StepCard({ step, index, onProgress, saving }) {
  const [open, setOpen] = useState(false);
  const diff = DIFF[step.difficulty] || DIFF.beginner;
  const pc = PROGRESS[step.progress] || PROGRESS.todo;
  const done = step.progress === "done";
  return (
    <div className="relative pl-10">
      {/* rel garis waktu */}
      <span className="absolute left-3 top-1 bottom-0 w-px" style={{ background: "var(--border)" }} />
      <span className={`absolute left-0 top-0 w-6 h-6 rounded-full grid place-items-center text-xs font-black
        ${done ? "bg-emerald-500 text-white" : "bg-brand-600 text-white"}`}>{done ? "✓" : index + 1}</span>

      <div className="card p-4 space-y-2.5 mb-3">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <p className={`text-sm font-bold ${done ? "line-through opacity-70" : ""}`} style={{ color: "var(--text-base)" }}>{step.title}</p>
          <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full border ${diff.cls}`}>{diff.label}</span>
        </div>

        {step.objective && <p className="text-xs" style={{ color: "var(--text-2)" }}>{step.objective}</p>}
        {step.why && (
          <div className="rounded-lg px-3 py-2 text-xs border-l-2 border-brand-500" style={{ background: "var(--bg-raised)", color: "var(--text-3)" }}>
            <span className="font-semibold text-brand-500">Kenapa: </span>{step.why}
          </div>
        )}

        <div className="flex items-center gap-3 flex-wrap text-xs" style={{ color: "var(--text-4)" }}>
          {step.competencyRef && <span className="truncate max-w-[60%]">◈ {step.competencyRef}</span>}
          {step.estEffort && <span>◷ {step.estEffort}</span>}
        </div>

        <div className="flex items-center justify-between gap-2 pt-1 flex-wrap">
          <div className="flex items-center gap-1.5">
            {Object.entries(PROGRESS).map(([k, v]) => {
              const active = step.progress === k;
              return (
                <button key={k} onClick={() => !active && onProgress(step.id, k)} disabled={saving}
                  className={`text-[11px] px-2 py-1 rounded-md border transition-colors flex items-center gap-1 disabled:opacity-50
                    ${active ? "border-brand-500 bg-brand-500/10 " + v.cls : "border-[var(--border)] text-[var(--text-4)] hover:border-brand-500/40"}`}>
                  <v.Icon className="w-3 h-3" />{v.label}
                </button>
              );
            })}
          </div>
          {step.courseQuery && (
            <button onClick={() => setOpen((o) => !o)} className="text-[11px] text-brand-500 flex items-center gap-1 hover:underline">
              <GraduationCap className="w-3.5 h-3.5" /> Kursus terkait
              <ChevronDown className={`w-3 h-3 transition-transform ${open ? "rotate-180" : ""}`} />
            </button>
          )}
        </div>

        {open && step.courseQuery && <StepCourses query={step.courseQuery} />}
      </div>
    </div>
  );
}

function AiCheckCard({ aiCheck, inputs, source }) {
  const v = VERDICT[aiCheck?.verdict] || VERDICT.needs_work;
  const cur = inputs?.rank?.current, tgt = inputs?.rank?.target;
  const readiness = inputs?.readiness?.total ?? 0;
  return (
    <div className="card p-5 space-y-4" style={{ borderColor: v.ring + "55" }}>
      <div className="flex items-start gap-3">
        <div className="w-10 h-10 rounded-xl grid place-items-center shrink-0" style={{ background: v.ring + "22" }}>
          <v.Icon className="w-5 h-5" style={{ color: v.ring }} />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${v.chip}`}>{v.label}</span>
            <span className="text-[11px] px-2 py-0.5 rounded-full" style={{ background: "var(--bg-raised)", color: "var(--text-4)" }}>
              {source === "ai" ? "✦ Analisis AI" : "Analisis otomatis"}
            </span>
          </div>
          {aiCheck?.headline && <p className="text-sm font-semibold mt-1.5" style={{ color: "var(--text-base)" }}>{aiCheck.headline}</p>}
        </div>
      </div>

      {aiCheck?.message && <p className="text-sm leading-relaxed" style={{ color: "var(--text-2)" }}>{aiCheck.message}</p>}

      {aiCheck?.focus?.length > 0 && (
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="text-[11px] font-semibold" style={{ color: "var(--text-4)" }}>Fokus:</span>
          {aiCheck.focus.map((f, i) => (
            <span key={i} className="text-[11px] px-2 py-0.5 rounded-full" style={{ background: "var(--bg-raised)", color: "var(--text-3)" }}>{f}</span>
          ))}
        </div>
      )}

      {/* Rank saat ini → target + kesiapan */}
      <div className="flex items-center gap-4 flex-wrap pt-1 border-t" style={{ borderColor: "var(--border)" }}>
        {cur != null && (
          <div className="flex items-center gap-2 pt-3">
            <span className="text-xs" style={{ color: "var(--text-4)" }}>Rank</span>
            <span className="text-sm font-bold" style={{ color: rankColor(cur) }}>{rankName(cur)}</span>
            <span style={{ color: "var(--text-4)" }}>→</span>
            <span className="text-sm font-bold" style={{ color: rankColor(tgt) }}>{rankName(tgt)}</span>
          </div>
        )}
        <div className="flex items-center gap-2 pt-3">
          <span className="text-xs" style={{ color: "var(--text-4)" }}>Kesiapan</span>
          <div className="w-28 h-2 rounded-full overflow-hidden" style={{ background: "var(--bg-raised)" }}>
            <div className="h-full rounded-full" style={{ width: `${readiness}%`, background: v.ring }} />
          </div>
          <span className="text-sm font-bold" style={{ color: "var(--text-base)" }}>{readiness}%</span>
        </div>
      </div>
    </div>
  );
}

export default function LearningPath() {
  const qc = useQueryClient();
  const [targetRole, setTargetRole] = useState("");
  const [touched, setTouched] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ["learning-path"],
    queryFn: () => api.get("/learning-path/"),
  });

  // isi input dari server sekali (kecuali user sudah mengetik).
  useEffect(() => {
    if (!touched && data?.targetRole != null) setTargetRole(data.targetRole);
  }, [data?.targetRole, touched]);

  const generate = useMutation({
    mutationFn: () => api.post("/learning-path/generate", { targetRole }, { timeout: 90_000 }),
    onSuccess: (res) => {
      qc.setQueryData(["learning-path"], (old) => ({ ...(old || {}), ...res, llmAvailable: old?.llmAvailable }));
      toast.success(res.source === "ai" ? "Learning Path disusun oleh AI" : "Learning Path disusun");
    },
    onError: (e) => toast.error(typeof e === "string" ? e : "Gagal menyusun rencana"),
  });

  const setStep = useMutation({
    mutationFn: ({ stepId, progress }) => api.put("/learning-path/step", { stepId, progress }),
    onMutate: async ({ stepId, progress }) => {
      qc.setQueryData(["learning-path"], (old) => {
        if (!old?.plan) return old;
        const steps = old.plan.steps.map((s) => (s.id === stepId ? { ...s, progress } : s));
        return { ...old, plan: { ...old.plan, steps } };
      });
    },
    onError: () => { toast.error("Gagal menyimpan progres"); qc.invalidateQueries(["learning-path"]); },
  });

  const plan = data?.plan;
  const inputs = data?.inputs;
  const noGaps = !inputs?.gaps?.length;
  const noComp = !inputs?.competency;
  const done = plan?.steps?.filter((s) => s.progress === "done").length || 0;
  const total = plan?.steps?.length || 0;

  if (isLoading) return <div className="flex items-center justify-center h-64" style={{ color: "var(--text-4)" }}>Memuat…</div>;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-xl font-bold flex items-center gap-2" style={{ color: "var(--text-base)" }}>
          <Sparkles className="w-5 h-5 text-brand-500" /> Learning Path Personal
        </h2>
        <p className="text-sm mt-1" style={{ color: "var(--text-3)" }}>
          Rencana belajar terurut dari hasil ujianmu, kompetensi SKKNI yang dipilih, dan profesi yang kamu targetkan — dicek oleh AI.
        </p>
      </div>

      {/* Target profesi + tombol susun */}
      <div className="card p-4 space-y-3">
        <label className="text-xs font-semibold flex items-center gap-1.5" style={{ color: "var(--text-3)" }}>
          <Target className="w-3.5 h-3.5 text-brand-500" /> Profesi yang kamu targetkan
        </label>
        <div className="flex gap-2 flex-wrap">
          <input
            value={targetRole}
            onChange={(e) => { setTargetRole(e.target.value); setTouched(true); }}
            placeholder={inputs?.competency ? `mis. ${inputs.competency.title.split(" ").slice(0, 3).join(" ")}…` : "mis. Video Editor Profesional"}
            className="input flex-1 min-w-[200px]"
          />
          <button onClick={() => generate.mutate()} disabled={generate.isPending}
            className="btn-primary flex items-center gap-2 whitespace-nowrap">
            {generate.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : plan ? <RefreshCw className="w-4 h-4" /> : <Sparkles className="w-4 h-4" />}
            {generate.isPending ? "Menyusun…" : plan ? "Perbarui Rencana" : "Susun dengan AI"}
          </button>
        </div>
        {noComp && (
          <p className="text-xs" style={{ color: "var(--text-4)" }}>
            Tip: <Link to="/app/profile" className="text-brand-500 hover:underline">pilih kompetensi SKKNI</Link> dan{" "}
            <Link to="/app/exam" className="text-brand-500 hover:underline">ambil ujian</Link> agar rencana lebih personal.
          </p>
        )}
      </div>

      {/* Kosong */}
      {!plan ? (
        <div className="card p-10 text-center">
          <Compass className="w-10 h-10 mx-auto mb-3 text-brand-500" />
          <h3 className="font-bold mb-1" style={{ color: "var(--text-base)" }}>Belum Ada Learning Path</h3>
          <p className="text-sm mb-5 max-w-md mx-auto" style={{ color: "var(--text-3)" }}>
            Klik <b>Susun dengan AI</b> di atas. AI akan menganalisis {noGaps ? "kompetensi pilihanmu" : `${inputs.gaps.length} gap kompetensi`}
            {" "}dan menyusun langkah bertahap menuju profesi targetmu.
          </p>
          {noGaps && <Link to="/app/exam" className="btn-outline">Ambil Ujian Dulu →</Link>}
        </div>
      ) : (
        <>
          <AiCheckCard aiCheck={plan.aiCheck} inputs={inputs} source={data?.source} />

          {/* Progres keseluruhan */}
          <div className="flex items-center justify-between gap-3">
            <h3 className="text-sm font-bold" style={{ color: "var(--text-base)" }}>Langkah Belajar ({total})</h3>
            <div className="flex items-center gap-2">
              <div className="w-32 h-2 rounded-full overflow-hidden" style={{ background: "var(--bg-raised)" }}>
                <div className="h-full bg-emerald-500 rounded-full transition-all" style={{ width: total ? `${(done / total) * 100}%` : 0 }} />
              </div>
              <span className="text-xs font-semibold" style={{ color: "var(--text-3)" }}>{done}/{total} selesai</span>
            </div>
          </div>

          <div>
            {plan.steps.map((s, i) => (
              <StepCard key={s.id} step={s} index={i} saving={setStep.isPending}
                onProgress={(stepId, progress) => setStep.mutate({ stepId, progress })} />
            ))}
          </div>

          {data?.generatedAt && (
            <p className="text-[11px] text-center" style={{ color: "var(--text-4)" }}>
              Disusun {data.source === "ai" ? "oleh AI" : "otomatis"} · {new Date(data.generatedAt).toLocaleString("id-ID")}.
              {" "}Perbarui setelah ujian baru agar rencana menyesuaikan progresmu.
            </p>
          )}
        </>
      )}
    </div>
  );
}
