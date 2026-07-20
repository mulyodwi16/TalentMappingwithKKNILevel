import { useState, useEffect, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import toast from "react-hot-toast";
import {
  Sparkles, Target, Loader2, RefreshCw, CheckCircle2, CircleDashed, CircleDot,
  GraduationCap, ChevronDown, Star, Compass, TrendingUp, AlertTriangle,
  FileText, PenLine, Award, MapPin, MessageCircle, ArrowRight, ScanLine,
} from "lucide-react";
import api from "../../api/client.js";
import { rankName, rankColor } from "../../lib/rank.js";
import RankIcon from "../../components/RankIcon.jsx";
import { useLang, dateLocale } from "../../lib/i18n.jsx";

const DIFF = {
  beginner:     { label: "Pemula",   cls: "bg-emerald-500/15 text-emerald-500 border-emerald-500/30" },
  intermediate: { label: "Menengah", cls: "bg-amber-500/15 text-amber-500 border-amber-500/30" },
  advanced:     { label: "Mahir",    cls: "bg-violet-500/15 text-violet-400 border-violet-500/30" },
};

const PROGRESS = {
  todo:  { label: "Belum Mulai", Icon: CircleDashed, color: "var(--text-4)", chip: "bg-[var(--bg-raised)] text-[var(--text-4)]" },
  doing: { label: "Dikerjakan",  Icon: CircleDot,    color: "#f59e0b",       chip: "bg-amber-500/15 text-amber-500" },
  done:  { label: "Selesai",     Icon: CheckCircle2, color: "#10b981",       chip: "bg-emerald-500/15 text-emerald-500" },
};

const VERDICT = {
  on_track:  { label: "Di Jalur yang Tepat", Icon: TrendingUp,    ring: "#10b981", chip: "bg-emerald-500/15 text-emerald-500" },
  needs_work:{ label: "Perlu Pengerjaan",    Icon: Compass,       ring: "#f59e0b", chip: "bg-amber-500/15 text-amber-500" },
  not_ready: { label: "Perlu Peningkatan",   Icon: AlertTriangle, ring: "#ef4444", chip: "bg-red-500/15 text-red-400" },
};

// Fitur aplikasi untuk mengerjakan tiap langkah (permintaan #4: link ke fitur terkait).
const FEATURE = {
  kelas:    { label: "Buka Kelas",     to: "/app/kelas",     Icon: GraduationCap },
  ujian:    { label: "Ke Ujian",       to: "/app/exam",      Icon: PenLine },
  cv:       { label: "Unggah CV",      to: "/app/cv-upload", Icon: FileText },
  evidence: { label: "Tambah Bukti",   to: "/app/profile",   Icon: Award },
  peta:     { label: "Peta Posisi",    to: "/app/jobs",      Icon: MapPin },
  mentor:   { label: "Tanya AI Mentor", to: "/app/mentor",   Icon: MessageCircle },
};

// ── Ilustrasi hero: perjalanan belajar (jalur berliku + milestone) ──────────────
function JourneyArt({ done = 0, total = 0 }) {
  const { t } = useLang();
  const pct = total ? done / total : 0;
  return (
    <svg viewBox="0 0 400 120" className="w-full h-auto" role="img" aria-label={t("Ilustrasi perjalanan belajar")}>
      <defs>
        <linearGradient id="lp-path" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#10b981" />
          <stop offset="1" stopColor="rgb(var(--brand-500))" />
        </linearGradient>
        <radialGradient id="lp-goal" cx="0.5" cy="0.5" r="0.5">
          <stop offset="0" stopColor="rgb(var(--brand-400))" /><stop offset="1" stopColor="rgb(var(--brand-600))" />
        </radialGradient>
      </defs>
      {/* jalur dasar */}
      <path d="M20 96 C 90 96, 90 40, 150 40 S 230 92, 290 66 S 360 26, 384 26"
        fill="none" stroke="var(--border-2)" strokeWidth="5" strokeLinecap="round" strokeDasharray="2 10" />
      {/* jalur progres */}
      <path d="M20 96 C 90 96, 90 40, 150 40 S 230 92, 290 66 S 360 26, 384 26"
        fill="none" stroke="url(#lp-path)" strokeWidth="5" strokeLinecap="round"
        pathLength="1" strokeDasharray="1" strokeDashoffset={1 - pct}
        style={{ transition: "stroke-dashoffset 1s ease" }} />
      {/* titik awal */}
      <circle cx="20" cy="96" r="7" fill="#10b981" />
      <text x="20" y="116" textAnchor="middle" fontSize="9" fill="var(--text-4)">{t("Mulai")}</text>
      {/* milestone tengah */}
      <circle cx="150" cy="40" r="5" fill="rgb(var(--brand-500))" opacity={pct > 0.3 ? 1 : 0.4} />
      <circle cx="290" cy="66" r="5" fill="rgb(var(--brand-500))" opacity={pct > 0.6 ? 1 : 0.4} />
      {/* tujuan (bendera/rank) */}
      <circle cx="384" cy="26" r="11" fill="url(#lp-goal)" />
      <path d="M380 20 h9 v6 h-9 z" fill="#fff" opacity="0.9" />
      <text x="384" y="52" textAnchor="middle" fontSize="9" fill="var(--text-4)">{t("Target")}</text>
    </svg>
  );
}

// ── Kursus AvatarEdu yang cocok untuk sebuah langkah (lazy saat dibuka) ─────────
function StepCourses({ query }) {
  const { t } = useLang();
  const { data, isLoading, isError } = useQuery({
    queryKey: ["lp-courses", query],
    queryFn: () => api.get(`/avataredu/courses?q=${encodeURIComponent(query)}&per_page=3`),
    staleTime: 5 * 60 * 1000,
    enabled: !!query,
  });
  const courses = data?.data || [];
  if (isLoading) return <p className="text-xs py-2" style={{ color: "var(--text-4)" }}>{t("Mencari kursus…")}</p>;
  if (isError || courses.length === 0) return <p className="text-xs py-2" style={{ color: "var(--text-4)" }}>{t("Belum ada kursus cocok di AvatarEdu. Coba")} <Link to="/app/kelas" className="text-brand-500 hover:underline">{t("Kelas")}</Link>.</p>;
  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-1">
      {courses.map((c) => (
        <Link key={c.slug} to="/app/kelas"
          className="rounded-lg border p-2.5 flex flex-col gap-1 hover:border-brand-500/50 transition-colors"
          style={{ background: "var(--bg-raised)", borderColor: "var(--border)" }}>
          <div className="flex items-center gap-1.5 text-[11px]" style={{ color: "var(--text-4)" }}>
            <GraduationCap className="w-3 h-3 text-brand-500" />
            {c.average_rating > 0 && <span className="flex items-center gap-0.5 text-amber-400"><Star className="w-2.5 h-2.5 fill-amber-400" />{c.average_rating.toFixed(1)}</span>}
            {c.duration_hours ? <span>{t("{n} jam", { n: c.duration_hours })}</span> : null}
          </div>
          <p className="text-xs font-medium line-clamp-2" style={{ color: "var(--text-base)" }}>{c.title}</p>
          <span className="text-[11px] text-brand-500 mt-auto inline-flex items-center gap-1">{t("Buka di Kelas")} <ArrowRight className="w-3 h-3" /></span>
        </Link>
      ))}
    </div>
  );
}

function StepCard({ step, index }) {
  const { t } = useLang();
  const [open, setOpen] = useState(false);
  const diff = DIFF[step.difficulty] || DIFF.beginner;
  const pc = PROGRESS[step.progress] || PROGRESS.todo;
  const done = step.progress === "done";
  const feat = FEATURE[step.feature] || FEATURE.ujian;
  // Tautkan langsung ke unit terkait bila ada kode (Kelas & Ujian menerima ?unit=).
  const featTo = step.unitCode && (step.feature === "kelas" || step.feature === "ujian")
    ? `${feat.to}?unit=${encodeURIComponent(step.unitCode)}` : feat.to;

  return (
    <div className="relative pl-10">
      <span className="absolute left-3 top-6 bottom-0 w-px" style={{ background: "var(--border)" }} />
      <span className="absolute left-0 top-1 w-6 h-6 rounded-full grid place-items-center text-xs font-black transition-colors"
        style={{ background: done ? "#10b981" : step.progress === "doing" ? "#f59e0b" : "var(--bg-muted)",
                 color: step.progress === "todo" ? "var(--text-3)" : "#fff" }}>
        {done ? "✓" : index + 1}
      </span>

      <div className="card p-4 space-y-2.5 mb-3" style={done ? { borderColor: "#10b98155" } : undefined}>
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <p className={`text-sm font-bold ${done ? "line-through opacity-70" : ""}`} style={{ color: "var(--text-base)" }}>{step.title}</p>
          <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full border ${diff.cls}`}>{t(diff.label)}</span>
        </div>

        {step.objective && <p className="text-xs" style={{ color: "var(--text-2)" }}>{step.objective}</p>}
        {step.why && (
          <div className="rounded-lg px-3 py-2 text-xs border-l-2 border-brand-500" style={{ background: "var(--bg-raised)", color: "var(--text-3)" }}>
            <span className="font-semibold text-brand-500">{t("Kenapa:")} </span>{step.why}
          </div>
        )}

        <div className="flex items-center gap-3 flex-wrap text-xs" style={{ color: "var(--text-4)" }}>
          {step.competencyRef && <span className="truncate max-w-[55%]">◈ {step.competencyRef}</span>}
          {step.estEffort && <span>◷ {step.estEffort}</span>}
        </div>

        {/* Status TERLACAK OTOMATIS (bukan manual) */}
        <div className="flex items-center justify-between gap-2 pt-1 flex-wrap">
          <div className="flex items-center gap-2">
            <span className={`text-[11px] font-semibold px-2 py-1 rounded-md inline-flex items-center gap-1 ${pc.chip}`}>
              <pc.Icon className="w-3 h-3" /> {t(pc.label)}
            </span>
            {step.progressNote && <span className="text-[11px]" style={{ color: pc.color }}>{step.progressNote}</span>}
          </div>
          <div className="flex items-center gap-2">
            {step.courseQuery && (
              <button onClick={() => setOpen((o) => !o)} className="text-[11px] text-brand-500 flex items-center gap-1 hover:underline">
                <GraduationCap className="w-3.5 h-3.5" /> {t("Kursus")}
                <ChevronDown className={`w-3 h-3 transition-transform ${open ? "rotate-180" : ""}`} />
              </button>
            )}
            {!done && (
              <Link to={featTo} className="text-[11px] font-semibold text-white bg-brand-600 hover:bg-brand-700 px-2.5 py-1 rounded-md inline-flex items-center gap-1">
                <feat.Icon className="w-3.5 h-3.5" /> {t(feat.label)} <ArrowRight className="w-3 h-3" />
              </Link>
            )}
          </div>
        </div>

        {open && step.courseQuery && <StepCourses query={step.courseQuery} />}
      </div>
    </div>
  );
}

// Panel transparansi: data user yang dipertimbangkan AI (permintaan #4).
function ConsideredData({ inputs }) {
  const { t } = useLang();
  if (!inputs) return null;
  const a = inputs.activity || {};
  const items = [
    { Icon: FileText, label: t("CV"), val: inputs.cv?.hasCv ? t("{n} keahlian", { n: inputs.cv.skills?.length || 0 }) : t("Belum ada"), ok: inputs.cv?.hasCv, to: "/app/cv-upload" },
    { Icon: GraduationCap, label: t("Kelas diikuti"), val: t("{n} kelas", { n: a.classesTaken || 0 }), ok: (a.classesTaken || 0) > 0, to: "/app/kelas" },
    { Icon: PenLine, label: t("Ujian diambil"), val: `${a.examAttempts || 0}×`, ok: (a.examAttempts || 0) > 0, to: "/app/exam" },
    { Icon: CheckCircle2, label: t("Unit lulus"), val: `${inputs.passedUnits?.length || 0}`, ok: (inputs.passedUnits?.length || 0) > 0, to: "/app/exam" },
    { Icon: Award, label: t("Sertifikat"), val: `${a.certCount || 0}`, ok: (a.certCount || 0) > 0, to: "/app/profile" },
    { Icon: Sparkles, label: t("Bukti eksternal"), val: `${a.evidenceCount || 0}`, ok: (a.evidenceCount || 0) > 0, to: "/app/profile" },
    { Icon: Target, label: t("Kompetensi target"), val: inputs.competency?.title ? t("Dipilih") : t("Belum"), ok: !!inputs.competency, to: "/app/profile" },
    { Icon: AlertTriangle, label: t("Gap terdeteksi"), val: `${inputs.gaps?.length || 0}`, ok: true, to: "/app/skill-gap" },
  ];
  return (
    <div className="card p-4">
      <div className="flex items-center gap-2 mb-3">
        <ScanLine className="w-4 h-4 text-brand-500" />
        <h3 className="text-sm font-bold" style={{ color: "var(--text-base)" }}>{t("Data yang dipertimbangkan AI")}</h3>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        {items.map((it) => (
          <Link key={it.label} to={it.to} className="rounded-lg p-2.5 flex items-start gap-2 hover:bg-[var(--bg-muted)] transition-colors" style={{ background: "var(--bg-raised)" }}>
            <it.Icon className="w-4 h-4 mt-0.5 shrink-0" style={{ color: it.ok ? "#10b981" : "var(--text-4)" }} />
            <div className="min-w-0">
              <p className="text-[11px]" style={{ color: "var(--text-4)" }}>{it.label}</p>
              <p className="text-xs font-semibold truncate" style={{ color: it.ok ? "var(--text-base)" : "var(--text-4)" }}>{it.val}</p>
            </div>
          </Link>
        ))}
      </div>
      <p className="text-[11px] mt-3" style={{ color: "var(--text-4)" }}>
        {t("AI menyusun rencana dari seluruh data di atas. Makin lengkap datamu, makin personal rencananya. Progres tiap langkah")} <b>{t("dilacak otomatis")}</b> {t("dari aktivitas ini.")}
      </p>
    </div>
  );
}

function AiCheckCard({ aiCheck, inputs, source }) {
  const { t } = useLang();
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
            <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${v.chip}`}>{t(v.label)}</span>
            <span className="text-[11px] px-2 py-0.5 rounded-full" style={{ background: "var(--bg-raised)", color: "var(--text-4)" }}>
              {source === "ai" ? t("✦ Analisis AI") : t("Analisis otomatis")}
            </span>
          </div>
          {aiCheck?.headline && <p className="text-sm font-semibold mt-1.5" style={{ color: "var(--text-base)" }}>{aiCheck.headline}</p>}
        </div>
      </div>

      {aiCheck?.message && <p className="text-sm leading-relaxed" style={{ color: "var(--text-2)" }}>{aiCheck.message}</p>}

      {aiCheck?.focus?.length > 0 && (
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="text-[11px] font-semibold" style={{ color: "var(--text-4)" }}>{t("Fokus:")}</span>
          {aiCheck.focus.map((f, i) => (
            <span key={i} className="text-[11px] px-2 py-0.5 rounded-full" style={{ background: "var(--bg-raised)", color: "var(--text-3)" }}>{f}</span>
          ))}
        </div>
      )}

      <div className="flex items-center gap-4 flex-wrap pt-1 border-t" style={{ borderColor: "var(--border)" }}>
        {cur != null && (
          <div className="flex items-center gap-2 pt-3">
            <span className="text-xs" style={{ color: "var(--text-4)" }}>Rank</span>
            <RankIcon level={cur} size={22} title={rankName(cur)} />
            <span className="text-sm font-bold" style={{ color: rankColor(cur) }}>{rankName(cur)}</span>
            <ArrowRight size={14} style={{ color: "var(--text-4)" }} />
            <RankIcon level={tgt} size={22} title={rankName(tgt)} />
            <span className="text-sm font-bold" style={{ color: rankColor(tgt) }}>{rankName(tgt)}</span>
          </div>
        )}
        <div className="flex items-center gap-2 pt-3">
          <span className="text-xs" style={{ color: "var(--text-4)" }}>{t("Kesiapan")}</span>
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
  const { lang, t } = useLang();
  const qc = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ["learning-path"],
    queryFn: () => api.get("/learning-path/"),
  });

  const generate = useMutation({
    mutationFn: () => api.post("/learning-path/generate", {}, { timeout: 90_000 }),
    onSuccess: (res) => {
      // stale ikut dinolkan: rencana ini baru saja disusun dari data terkini.
      qc.setQueryData(["learning-path"], (old) => ({ ...(old || {}), ...res, stale: false, llmAvailable: old?.llmAvailable }));
      toast.success(res.source === "ai" ? t("Learning Path disusun oleh AI") : t("Learning Path disusun"));
    },
    onError: (e) => toast.error(typeof e === "string" ? e : t("Gagal menyusun rencana")),
  });

  const plan = data?.plan;
  const inputs = data?.inputs;
  const noGaps = !inputs?.gaps?.length;
  const noComp = !inputs?.competency;
  const done = plan?.steps?.filter((s) => s.progress === "done").length || 0;
  const total = plan?.steps?.length || 0;

  // OTOMATIS: begitu kompetensi dipilih & belum ada rencana, susun sendiri (tanpa tombol manual).
  // JUGA disusun ulang saat `stale` - ada nilai unit yang lebih baru dari rencana ini (mis.
  // baru selesai tes penempatan), jadi rencana lama bisa menyuruh mengulang unit yang sudah
  // dikuasai. Kunci penjaga memakai waktu penyusunan supaya tiap versi rencana hanya dicoba
  // sekali: kalau AI gagal, halaman tidak terjebak memanggil ulang tanpa henti.
  const autoKey = useRef(null);
  useEffect(() => {
    if (isLoading || generate.isPending) return;
    const compId = inputs?.competency?.id || null;
    if (!compId) return;
    const key = plan ? (data?.stale ? `stale:${compId}:${data.generatedAt}` : null) : `new:${compId}`;
    if (key && autoKey.current !== key) {
      autoKey.current = key;
      generate.mutate();
    }
  }, [isLoading, plan, data?.stale, data?.generatedAt, inputs?.competency?.id, generate.isPending]); // eslint-disable-line react-hooks/exhaustive-deps

  if (isLoading) return <div className="flex items-center justify-center h-64" style={{ color: "var(--text-4)" }}>{t("Memuat…")}</div>;

  return (
    <div className="space-y-6">
      {/* Header + ilustrasi */}
      <div className="card p-5 relative overflow-hidden">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-center">
          <div>
            <h2 className="text-xl font-bold flex items-center gap-2" style={{ color: "var(--text-base)" }}>
              <Sparkles className="w-5 h-5 text-brand-500" /> {t("Learning Path Personal")}
            </h2>
            <p className="text-sm mt-1.5" style={{ color: "var(--text-3)" }}>
              {t("Rencana belajar terurut dari")} <b>{t("seluruh datamu")}</b> {t("- CV, kelas yang diikuti, ujian, keahlian, dan kompetensi target - disusun & dicek AI. Progres")} <b>{t("dilacak otomatis")}</b>.
            </p>
            {plan && (
              <div className="flex items-center gap-2 mt-3">
                <div className="w-40 h-2 rounded-full overflow-hidden" style={{ background: "var(--bg-raised)" }}>
                  <div className="h-full bg-emerald-500 rounded-full transition-all" style={{ width: total ? `${(done / total) * 100}%` : 0 }} />
                </div>
                <span className="text-xs font-semibold" style={{ color: "var(--text-3)" }}>{t("{a}/{b} selesai", { a: done, b: total })}</span>
              </div>
            )}
          </div>
          <JourneyArt done={done} total={total} />
        </div>
      </div>

      {/* Data yang dipertimbangkan AI */}
      <ConsideredData inputs={inputs} />

      {/* Target profesi OTOMATIS dari kompetensi (tanpa input manual, #6) + tombol susun */}
      <div className="card p-4 space-y-3">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div className="min-w-0">
            <p className="text-xs font-semibold flex items-center gap-1.5" style={{ color: "var(--text-3)" }}>
              <Target className="w-3.5 h-3.5 text-brand-500" /> {t("Profesi target (otomatis dari kompetensi)")}
            </p>
            <p className="text-base font-bold mt-1 truncate" style={{ color: "var(--text-base)" }}>
              {inputs?.competency?.title || t("Belum ada kompetensi dipilih")}
            </p>
            <p className="text-[11px] mt-0.5" style={{ color: "var(--text-4)" }}>
              {t("Rencana tersusun & tersinkron otomatis dari kompetensi SKKNI pilihanmu & seluruh datamu - tanpa tombol manual.")}
            </p>
          </div>
          {generate.isPending ? (
            <span className="text-xs flex items-center gap-2 whitespace-nowrap" style={{ color: "var(--text-4)" }}>
              <Loader2 className="w-4 h-4 animate-spin" /> {t("Menyusun otomatis…")}
            </span>
          ) : plan ? (
            // Escape hatch opsional & AMAN (tak me-reset progres - unit lulus tetap tercakup).
            // `stale` = ada nilai unit yang lebih baru dari rencana ini (mis. baru selesai tes
            // penempatan), jadi ajakannya ditegaskan - bukan sekadar tautan samar.
            <button onClick={() => generate.mutate()} disabled={noComp}
              className={`flex items-center gap-1 whitespace-nowrap disabled:opacity-50 ${data?.stale ? "btn-outline text-xs px-3 py-1.5 border-brand-500 text-brand-600" : "text-[11px] hover:underline"}`}
              style={data?.stale ? undefined : { color: "var(--text-4)" }}>
              <RefreshCw className="w-3.5 h-3.5" /> {data?.stale ? t("Ada data baru - susun ulang") : t("Susun ulang")}
            </button>
          ) : !noComp ? (
            <span className="text-xs flex items-center gap-2 whitespace-nowrap" style={{ color: "var(--text-4)" }}>
              <Loader2 className="w-4 h-4 animate-spin" /> {t("Menyusun otomatis…")}
            </span>
          ) : null}
        </div>
        {noComp && (
          <p className="text-xs" style={{ color: "var(--text-4)" }}>
            {t("Tip:")} <Link to="/app/profile" className="text-brand-500 hover:underline">{t("pilih kompetensi SKKNI")}</Link> {t("dulu agar Learning Path bisa disusun otomatis.")}
          </p>
        )}
      </div>

      {!plan ? (
        <div className="card p-10 text-center">
          {noComp ? (
            <>
              <Compass className="w-10 h-10 mx-auto mb-3 text-brand-500" />
              <h3 className="font-bold mb-1" style={{ color: "var(--text-base)" }}>{t("Belum Ada Learning Path")}</h3>
              <p className="text-sm mb-5 max-w-md mx-auto" style={{ color: "var(--text-3)" }}>
                {t("Pilih kompetensi SKKNI dulu di Profil - begitu terpilih, AI langsung menyusun langkah bertahap menuju profesi targetmu secara otomatis.")}
              </p>
              <Link to="/app/profile" className="btn-outline inline-flex items-center gap-2">{t("Pilih Kompetensi")} <ArrowRight size={16} /></Link>
            </>
          ) : (
            <>
              <Loader2 className="w-10 h-10 mx-auto mb-3 text-brand-500 animate-spin" />
              <h3 className="font-bold mb-1" style={{ color: "var(--text-base)" }}>{t("Menyusun Learning Path…")}</h3>
              <p className="text-sm max-w-md mx-auto" style={{ color: "var(--text-3)" }}>
                {t("AI sedang menganalisis")} {noGaps ? t("kompetensi pilihanmu") : t("{n} gap kompetensi", { n: inputs.gaps.length })}
                {" "}{t("dan seluruh datamu untuk menyusun langkah otomatis. Sebentar ya…")}
              </p>
            </>
          )}
        </div>
      ) : (
        <>
          <AiCheckCard aiCheck={plan.aiCheck} inputs={inputs} source={data?.source} />

          <h3 className="text-sm font-bold flex items-center gap-2" style={{ color: "var(--text-base)" }}>
            {t("Langkah Belajar ({n})", { n: total })}
            <span className="text-[11px] font-normal px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-500 inline-flex items-center gap-1">
              <ScanLine className="w-3 h-3" /> {t("progres otomatis")}
            </span>
          </h3>

          <div>
            {plan.steps.map((s, i) => <StepCard key={s.id} step={s} index={i} />)}
          </div>

          {data?.generatedAt && (
            <p className="text-[11px] text-center" style={{ color: "var(--text-4)" }}>
              {data.source === "ai" ? t("Disusun oleh AI") : t("Disusun otomatis")} · {new Date(data.generatedAt).toLocaleString(dateLocale(lang))}.
              {" "}{t("Progres tersinkron otomatis dari aktivitasmu - tak perlu memperbarui manual.")}
            </p>
          )}
        </>
      )}
    </div>
  );
}
