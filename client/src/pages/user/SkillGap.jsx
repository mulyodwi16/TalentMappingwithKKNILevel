import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Radar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, ResponsiveContainer, Tooltip } from "recharts";
import { Link } from "react-router-dom";
import api from "../../api/client.js";
import { markMission } from "../../lib/missions.js";

const CustomTooltip = ({ active, payload }) => {
  if (!active || !payload?.length) return null;
  const d = payload[0]?.payload;
  return (
    <div className="card p-3 text-xs shadow-xl">
      <p className="font-semibold text-white mb-1">{d?.competency}</p>
      <p className="text-brand-400">Aktual: {d?.aktual}%</p>
      <p className="text-slate-400">Target: {d?.target}%</p>
      <p className="text-red-400">Gap: {d?.gap}%</p>
    </div>
  );
};

export default function SkillGap() {
  useEffect(() => { markMission("open_skillgap"); }, []);
  const { data: assessments = [], isLoading } = useQuery({
    queryKey: ["assessments"],
    queryFn: () => api.get("/user/skill-assessments"),
  });

  const radarData = assessments.map((a) => ({
    competency: a.competencyName?.split(" ").slice(0, 2).join(" ") || a.competencyCode,
    aktual: a.currentScore,
    target: a.requiredScore,
    gap: a.gap,
    fullName: a.competencyName,
  }));

  const gaps = assessments.filter((a) => a.gap > 0).sort((a, b) => b.gap - a.gap);
  const avgReadiness = assessments.length
    ? Math.round(assessments.reduce((sum, a) => sum + a.currentScore, 0) / assessments.length)
    : 0;

  if (isLoading) return <div className="flex items-center justify-center h-64 text-slate-400">Memuat…</div>;

  if (assessments.length === 0) {
    return (
      <div className="max-w-xl mx-auto text-center py-16">
        <div className="text-5xl mb-4">◎</div>
        <h2 className="text-xl font-bold text-white mb-2">Belum Ada Data Skill Gap</h2>
        <p className="text-slate-400 text-sm mb-6">Selesaikan ujian kompetensi untuk melihat analisis gap.</p>
        <Link to="/app/exam" className="btn-primary">Mulai Ujian →</Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Stats */}
      <div className="grid sm:grid-cols-3 gap-4">
        <div className="card p-5 text-center">
          <p className="text-3xl font-black text-white">{avgReadiness}%</p>
          <p className="text-sm text-slate-400 mt-1">Rata-rata Kompetensi</p>
        </div>
        <div className="card p-5 text-center">
          <p className="text-3xl font-black text-red-400">{gaps.length}</p>
          <p className="text-sm text-slate-400 mt-1">Kompetensi Gap</p>
        </div>
        <div className="card p-5 text-center">
          <p className="text-3xl font-black text-emerald-400">{assessments.length - gaps.length}</p>
          <p className="text-sm text-slate-400 mt-1">Kompetensi Terpenuhi</p>
        </div>
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        {/* Radar chart */}
        <div className="card p-6">
          <h3 className="font-semibold text-white mb-6">Radar Kompetensi</h3>
          <ResponsiveContainer width="100%" height={300}>
            <RadarChart data={radarData}>
              <PolarGrid stroke="var(--border)" />
              <PolarAngleAxis dataKey="competency" tick={{ fill: "#94a3b8", fontSize: 11 }} />
              <PolarRadiusAxis angle={90} domain={[0, 100]} tick={{ fill: "#475569", fontSize: 9 }} />
              <Radar name="Target" dataKey="target" stroke="#334155" fill="#334155" fillOpacity={0.3} />
              <Radar name="Aktual" dataKey="aktual" stroke="#2563eb" fill="#2563eb" fillOpacity={0.4} />
              <Tooltip content={<CustomTooltip />} />
            </RadarChart>
          </ResponsiveContainer>
          <div className="flex gap-4 justify-center mt-2 text-xs">
            <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm bg-brand-600/60 inline-block" />Aktual</span>
            <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm bg-slate-600/60 inline-block" />Target</span>
          </div>
        </div>

        {/* Gap details */}
        <div className="card p-6">
          <h3 className="font-semibold text-white mb-4">Detail Gap (Prioritas)</h3>
          <div className="space-y-4 overflow-y-auto max-h-72">
            {assessments
              .sort((a, b) => b.gap - a.gap)
              .map((a) => (
                <div key={a.id}>
                  <div className="flex justify-between text-sm mb-1.5">
                    <span className={`font-medium ${a.gap > 0 ? "text-white" : "text-slate-400"}`}>{a.competencyName}</span>
                    <div className="flex gap-2">
                      <span className="text-brand-400">{a.currentScore}%</span>
                      {a.gap > 0 && <span className="text-red-400">-{a.gap}%</span>}
                      {a.gap === 0 && <span className="text-emerald-400">✓</span>}
                    </div>
                  </div>
                  <div className="h-2 bg-slate-700 rounded-full overflow-hidden relative">
                    <div className="absolute inset-y-0 left-0 bg-brand-600 rounded-full" style={{ width: `${a.currentScore}%` }} />
                    {a.gap > 0 && (
                      <div className="absolute inset-y-0 right-0 bg-red-500/30 rounded-r-full" style={{ width: `${a.gap}%` }} />
                    )}
                  </div>
                </div>
              ))}
          </div>
          {gaps.length > 0 && (
            <Link to="/app/learning-path" className="mt-4 btn-primary w-full text-center block text-sm py-2.5">
              Lihat Rekomendasi Belajar →
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}
