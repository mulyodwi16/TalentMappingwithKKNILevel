import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Radar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, ResponsiveContainer, Tooltip } from "recharts";
import { Link } from "react-router-dom";
import {
  Target, TrendingUp, CheckCircle2, GraduationCap, PenLine, Sparkles, ArrowRight,
  Trophy, AlertTriangle, Lightbulb, Route,
} from "lucide-react";
import api from "../../api/client.js";
import { markMission } from "../../lib/missions.js";

const norm = (s) => String(s || "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

const CustomTooltip = ({ active, payload }) => {
  if (!active || !payload?.length) return null;
  const d = payload[0]?.payload;
  return (
    <div className="card p-3 text-xs shadow-xl">
      <p className="font-semibold mb-1" style={{ color: "var(--text-base)" }}>{d?.fullName}</p>
      <p className="text-brand-500">Aktual: {d?.aktual}%</p>
      <p style={{ color: "var(--text-4)" }}>Target: {d?.target}%</p>
      {d?.gap > 0 && <p className="text-red-400">Gap: {d?.gap}%</p>}
    </div>
  );
};

function StatCard({ icon: Icon, value, label, color }) {
  return (
    <div className="card p-5 flex items-center gap-4">
      <div className="w-12 h-12 rounded-2xl grid place-items-center shrink-0" style={{ background: `${color}1f`, color }}>
        <Icon className="w-6 h-6" />
      </div>
      <div>
        <p className="text-2xl font-black tabular-nums" style={{ color: "var(--text-base)" }}>{value}</p>
        <p className="text-xs" style={{ color: "var(--text-4)" }}>{label}</p>
      </div>
    </div>
  );
}

// Kartu gap kaya: skor + bar + langkah belajar dari Learning Path (penjelasan detail).
function GapCard({ a, step }) {
  const met = a.gap === 0;
  const feat = step?.feature === "kelas" ? { to: "/app/kelas", label: "Pelajari di Kelas", Icon: GraduationCap } : { to: "/app/exam", label: "Validasi via Ujian", Icon: PenLine };
  const featTo = step?.unitCode ? `${feat.to}?unit=${encodeURIComponent(step.unitCode)}` : feat.to;
  return (
    <div className="card p-4 space-y-3" style={met ? { borderColor: "#10b98144" } : undefined}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-2 min-w-0">
          {met ? <CheckCircle2 className="w-4 h-4 text-emerald-500 mt-0.5 shrink-0" /> : <AlertTriangle className="w-4 h-4 text-amber-500 mt-0.5 shrink-0" />}
          <p className="text-sm font-semibold" style={{ color: "var(--text-base)" }}>{a.competencyName}</p>
        </div>
        <div className="text-right shrink-0">
          <span className="text-lg font-black tabular-nums" style={{ color: met ? "#10b981" : a.currentScore >= 40 ? "#f59e0b" : "#ef4444" }}>{a.currentScore}%</span>
          {!met && <span className="text-[11px] text-red-400 block">-{a.gap}% ke target {a.requiredScore}%</span>}
        </div>
      </div>

      {/* Bar aktual vs gap */}
      <div className="h-2.5 rounded-full overflow-hidden relative" style={{ background: "var(--bg-muted)" }}>
        <div className="absolute inset-y-0 left-0 rounded-full" style={{ width: `${a.currentScore}%`, background: met ? "#10b981" : "rgb(var(--brand-600))" }} />
        {!met && <div className="absolute inset-y-0 right-0 bg-red-500/30 rounded-r-full" style={{ width: `${a.gap}%` }} />}
      </div>

      {met ? (
        <p className="text-[11px] text-emerald-500 flex items-center gap-1"><Trophy className="w-3 h-3" /> Tervalidasi lewat ujian — kompetensi terpenuhi.</p>
      ) : step ? (
        <div className="rounded-lg p-3 space-y-2" style={{ background: "var(--bg-raised)" }}>
          <p className="text-xs font-semibold flex items-center gap-1.5" style={{ color: "var(--text-3)" }}><Route className="w-3.5 h-3.5 text-brand-500" /> Langkah dari Learning Path</p>
          {step.objective && <p className="text-xs" style={{ color: "var(--text-2)" }}>{step.objective}</p>}
          {step.why && <p className="text-[11px] flex gap-1" style={{ color: "var(--text-4)" }}><Lightbulb className="w-3 h-3 shrink-0 mt-0.5 text-amber-500" />{step.why}</p>}
          <div className="flex items-center gap-2 flex-wrap pt-0.5">
            <Link to={featTo} className="text-[11px] font-semibold text-white bg-brand-600 hover:bg-brand-700 px-2.5 py-1 rounded inline-flex items-center gap-1">
              <feat.Icon className="w-3 h-3" /> {feat.label} <ArrowRight className="w-3 h-3" />
            </Link>
            {step.estEffort && <span className="text-[11px]" style={{ color: "var(--text-4)" }}>◷ {step.estEffort}</span>}
          </div>
        </div>
      ) : (
        <div className="flex items-center gap-2 flex-wrap">
          <Link to="/app/kelas" className="text-[11px] font-semibold text-brand-500 hover:underline inline-flex items-center gap-1"><GraduationCap className="w-3 h-3" /> Pelajari di Kelas</Link>
          <Link to="/app/learning-path" className="text-[11px] text-brand-500 hover:underline inline-flex items-center gap-1"><Sparkles className="w-3 h-3" /> Susun rencana AI</Link>
        </div>
      )}
    </div>
  );
}

export default function SkillGap() {
  useEffect(() => { markMission("open_skillgap"); }, []);
  const { data: assessments = [], isLoading } = useQuery({
    queryKey: ["assessments"],
    queryFn: () => api.get("/user/skill-assessments"),
  });
  // Ambil Learning Path untuk memperkaya tiap gap dengan langkah belajar (#3).
  const { data: lp } = useQuery({ queryKey: ["learning-path"], queryFn: () => api.get("/learning-path/") });
  const steps = lp?.plan?.steps || [];
  const stepFor = (a) => steps.find((s) =>
    (s.unitCode && s.unitCode === a.competencyCode) || (s.competencyRef && norm(s.competencyRef) === norm(a.competencyName)) || (s.title && norm(s.title).includes(norm(a.competencyName)))
  );

  const radarData = assessments.map((a) => ({
    competency: a.competencyName?.split(" ").slice(0, 2).join(" ") || a.competencyCode,
    aktual: a.currentScore, target: a.requiredScore, gap: a.gap, fullName: a.competencyName,
  }));

  const sorted = [...assessments].sort((a, b) => b.gap - a.gap);
  const gaps = assessments.filter((a) => a.gap > 0);
  const avgReadiness = assessments.length ? Math.round(assessments.reduce((s, a) => s + a.currentScore, 0) / assessments.length) : 0;

  if (isLoading) return <div className="flex items-center justify-center h-64" style={{ color: "var(--text-4)" }}>Memuat…</div>;

  if (assessments.length === 0) {
    return (
      <div className="max-w-xl mx-auto text-center py-16">
        <div className="w-14 h-14 rounded-2xl bg-brand-500/15 grid place-items-center mx-auto mb-4"><Target className="w-7 h-7 text-brand-500" /></div>
        <h2 className="text-xl font-bold mb-2" style={{ color: "var(--text-base)" }}>Belum Ada Data Skill Gap</h2>
        <p className="text-sm mb-6" style={{ color: "var(--text-4)" }}>Selesaikan ujian kompetensi untuk melihat analisis gap & rencana menutupnya.</p>
        <Link to="/app/exam" className="btn-primary">Mulai Ujian →</Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold flex items-center gap-2" style={{ color: "var(--text-base)" }}><Target className="w-5 h-5 text-brand-500" /> Analisis Skill Gap</h2>
        <p className="text-sm mt-1" style={{ color: "var(--text-4)" }}>Perbandingan kompetensimu dengan standar target — lengkap dengan <b>langkah menutupnya</b> dari Learning Path.</p>
      </div>

      {/* Stats */}
      <div className="grid sm:grid-cols-3 gap-4">
        <StatCard icon={TrendingUp} value={`${avgReadiness}%`} label="Rata-rata Kompetensi" color="#2563eb" />
        <StatCard icon={AlertTriangle} value={gaps.length} label="Kompetensi Gap" color="#ef4444" />
        <StatCard icon={CheckCircle2} value={assessments.length - gaps.length} label="Kompetensi Terpenuhi" color="#10b981" />
      </div>

      <div className="grid lg:grid-cols-2 gap-6 items-start">
        {/* Radar */}
        <div className="card p-6">
          <h3 className="font-semibold mb-4" style={{ color: "var(--text-base)" }}>Radar Kompetensi</h3>
          <ResponsiveContainer width="100%" height={300}>
            <RadarChart data={radarData}>
              <PolarGrid stroke="var(--border)" />
              <PolarAngleAxis dataKey="competency" tick={{ fill: "var(--text-4)", fontSize: 11 }} />
              <PolarRadiusAxis angle={90} domain={[0, 100]} tick={{ fill: "var(--text-4)", fontSize: 9 }} />
              <Radar name="Target" dataKey="target" stroke="#64748b" fill="#64748b" fillOpacity={0.2} />
              <Radar name="Aktual" dataKey="aktual" stroke="rgb(var(--brand-500))" fill="rgb(var(--brand-500))" fillOpacity={0.4} />
              <Tooltip content={<CustomTooltip />} />
            </RadarChart>
          </ResponsiveContainer>
          <div className="flex gap-4 justify-center mt-2 text-xs">
            <span className="flex items-center gap-1.5" style={{ color: "var(--text-3)" }}><span className="w-3 h-3 rounded-sm bg-brand-600/60 inline-block" />Aktual</span>
            <span className="flex items-center gap-1.5" style={{ color: "var(--text-3)" }}><span className="w-3 h-3 rounded-sm bg-slate-500/50 inline-block" />Target</span>
          </div>
        </div>

        {/* Ringkasan + CTA */}
        <div className="card p-6 flex flex-col">
          <h3 className="font-semibold mb-3" style={{ color: "var(--text-base)" }}>Ringkasan Kesiapan</h3>
          <div className="flex items-end gap-2 mb-1">
            <span className="text-4xl font-black" style={{ color: avgReadiness >= 80 ? "#10b981" : avgReadiness >= 50 ? "#f59e0b" : "#ef4444" }}>{avgReadiness}%</span>
            <span className="text-sm mb-1.5" style={{ color: "var(--text-4)" }}>rata-rata dari {assessments.length} kompetensi</span>
          </div>
          <div className="h-2.5 rounded-full overflow-hidden mb-4" style={{ background: "var(--bg-muted)" }}>
            <div className="h-full rounded-full transition-all" style={{ width: `${avgReadiness}%`, background: avgReadiness >= 80 ? "#10b981" : avgReadiness >= 50 ? "#f59e0b" : "#ef4444" }} />
          </div>
          <p className="text-sm" style={{ color: "var(--text-3)" }}>
            {gaps.length === 0
              ? "Semua kompetensi target sudah terpenuhi 🎉 Pertahankan & tambah bukti eksternal untuk naik ke tingkat ahli."
              : `Ada ${gaps.length} kompetensi yang masih di bawah target. Tiap gap di bawah punya langkah konkret dari Learning Path.`}
          </p>
          <div className="mt-auto pt-4 flex flex-wrap gap-2">
            <Link to="/app/learning-path" className="btn-primary text-sm flex items-center gap-1.5"><Sparkles className="w-4 h-4" /> Buka Learning Path</Link>
            <Link to="/app/kelas" className="btn-outline text-sm flex items-center gap-1.5"><GraduationCap className="w-4 h-4" /> Ke Kelas</Link>
          </div>
        </div>
      </div>

      {/* Detail gap + rencana (prioritas) */}
      <div>
        <h3 className="font-semibold mb-3 flex items-center gap-2" style={{ color: "var(--text-base)" }}>
          <Route className="w-4 h-4 text-brand-500" /> Detail Gap & Rencana Menutupnya
          {!lp?.plan && <Link to="/app/learning-path" className="text-[11px] font-normal text-brand-500 hover:underline">(susun Learning Path untuk langkah detail →)</Link>}
        </h3>
        <div className="grid md:grid-cols-2 gap-3 items-start">
          {sorted.map((a) => <GapCard key={a.id} a={a} step={stepFor(a)} />)}
        </div>
      </div>
    </div>
  );
}
