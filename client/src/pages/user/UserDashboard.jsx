import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import api from "../../api/client.js";
import useAuthStore from "../../store/authStore.js";
import DailyLoginCard from "../../components/DailyLoginCard.jsx";
import DailyMissions from "../../components/DailyMissions.jsx";
import RankBadge from "../../components/RankBadge.jsx";
import { rankName } from "../../lib/rank.js";

const STATUS_CONFIG = {
  ready:       { label: "Siap Naik",    cls: "badge-ready",      ring: "#10b981" },
  in_progress: { label: "Dalam Proses", cls: "badge-in-progress", ring: "#f59e0b" },
  not_ready:   { label: "Belum Siap",   cls: "badge-not-ready",   ring: "#ef4444" },
};

function ReadinessRing({ pct = 0 }) {
  const r = 40, c = 2 * Math.PI * r;
  const offset = c - (pct / 100) * c;
  const color = pct >= 80 ? "#10b981" : pct >= 50 ? "#f59e0b" : "#ef4444";
  return (
    <div className="relative inline-flex items-center justify-center">
      <svg width="100" height="100" className="-rotate-90">
        <circle cx="50" cy="50" r={r} fill="none" stroke="var(--border-2)" strokeWidth="8" />
        <circle cx="50" cy="50" r={r} fill="none" stroke={color} strokeWidth="8"
          strokeDasharray={c} strokeDashoffset={offset} strokeLinecap="round"
          style={{ transition: "stroke-dashoffset 1s ease" }} />
      </svg>
      <div className="absolute text-center">
        <p className="text-2xl font-black" style={{ color }}>{pct}%</p>
        <p className="text-[10px] text-slate-500">readiness</p>
      </div>
    </div>
  );
}

export default function UserDashboard() {
  const { user } = useAuthStore();
  const { data: profile } = useQuery({ queryKey: ["profile"], queryFn: () => api.get("/user/profile") });
  const { data: attempts = [] } = useQuery({ queryKey: ["attempts"], queryFn: () => api.get("/user/attempts") });
  const { data: assessments = [] } = useQuery({ queryKey: ["assessments"], queryFn: () => api.get("/user/skill-assessments") });

  const u = profile || user;
  const status = u?.status || "not_ready";
  const sc = STATUS_CONFIG[status] || STATUS_CONFIG.not_ready;
  const latestAttempt = attempts[0];

  const topGaps = assessments
    .filter((a) => a.gap > 0)
    .sort((a, b) => b.gap - a.gap)
    .slice(0, 3);

  return (
    <div className="space-y-6">
      {/* Gamifikasi: bonus login harian + misi harian */}
      <div className="grid lg:grid-cols-2 gap-4 items-start">
        <DailyLoginCard />
        <DailyMissions />
      </div>

      {/* Header card */}
      <div className="card p-6 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-gradient-to-bl from-brand-600/10 to-transparent rounded-bl-full" />
        <div className="flex flex-col sm:flex-row gap-6 items-start sm:items-center relative">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-brand-600 to-tosca-500 flex items-center justify-center text-2xl font-black flex-shrink-0">
            {u?.name?.[0]?.toUpperCase()}
          </div>
          <div className="flex-1">
            <h2 className="text-xl font-bold text-white">{u?.name}</h2>
            <p className="text-slate-400 text-sm">{u?.position || "—"} · {u?.department || "—"}</p>
            <div className="flex flex-wrap gap-2 mt-2">
              <span className={`badge ${sc.cls}`}>{sc.label}</span>
              {u?.currentKkniLevel && <RankBadge level={u.currentKkniLevel} />}
              {u?.education && (
                <span className="badge bg-slate-700/60 text-slate-300 border border-slate-600/30">{u.education}</span>
              )}
            </div>
          </div>
          <ReadinessRing pct={u?.readinessScore || 0} />
        </div>
      </div>

      {/* Quick action cards */}
      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { to: "/app/cv-upload",     icon: "↑", label: "Upload CV",     desc: "Auto-klasifikasi Rank",  color: "from-brand-600 to-brand-700" },
          { to: "/app/exam",          icon: "✎", label: "Ikut Ujian",    desc: `${attempts.length} percobaan`, color: "from-tosca-500 to-tosca-600" },
          { to: "/app/skill-gap",     icon: "◎", label: "Skill Gap",     desc: `${topGaps.length} gap terdeteksi`, color: "from-amber-500 to-orange-600" },
          { to: "/app/learning-path", icon: "→", label: "Learning Path", desc: "Rekomendasi personal",  color: "from-emerald-500 to-teal-600" },
        ].map((c) => (
          <Link key={c.to} to={c.to} className="card p-5 hover:scale-105 transition-transform group">
            <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${c.color} flex items-center justify-center text-lg mb-3`}>{c.icon}</div>
            <p className="font-semibold text-white text-sm">{c.label}</p>
            <p className="text-xs text-slate-500 mt-0.5">{c.desc}</p>
          </Link>
        ))}
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        {/* Recent attempts */}
        <div className="card p-6">
          <h3 className="font-semibold text-white mb-4">Riwayat Ujian</h3>
          {attempts.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-slate-500 text-sm">Belum ada riwayat ujian</p>
              <Link to="/app/exam" className="btn-primary text-sm py-2 px-4 mt-3 inline-block">Mulai Ujian</Link>
            </div>
          ) : (
            <div className="space-y-3">
              {attempts.slice(0, 5).map((a) => (
                <div key={a.id} className="flex items-center gap-3 p-3 rounded-xl bg-slate-900/60">
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold ${
                    a.status === "ready" ? "bg-emerald-500/20 text-emerald-400" :
                    a.status === "in_progress" ? "bg-amber-500/20 text-amber-400" : "bg-red-500/20 text-red-400"
                  }`}>{a.readinessScore}%</div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-white">Rank {rankName(a.kkniLevel)}</p>
                    <p className="text-xs text-slate-500">{new Date(a.createdAt).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" })}</p>
                  </div>
                  <span className={`badge ${STATUS_CONFIG[a.status]?.cls || "badge-not-ready"}`}>
                    {STATUS_CONFIG[a.status]?.label}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Top gaps */}
        <div className="card p-6">
          <h3 className="font-semibold text-white mb-4">Gap Kompetensi Teratas</h3>
          {topGaps.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-slate-500 text-sm">
                {assessments.length === 0 ? "Ikuti ujian untuk melihat gap" : "Semua kompetensi terpenuhi 🎉"}
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {topGaps.map((a) => (
                <div key={a.id}>
                  <div className="flex justify-between text-sm mb-1.5">
                    <span className="text-slate-300 font-medium">{a.competencyName}</span>
                    <span className="text-red-400">{a.gap}% gap</span>
                  </div>
                  <div className="h-2 bg-slate-700 rounded-full overflow-hidden">
                    <div className="h-full bg-brand-600 rounded-full transition-all" style={{ width: `${a.currentScore}%` }} />
                  </div>
                  <div className="flex justify-between text-xs text-slate-600 mt-0.5">
                    <span>Saat ini: {a.currentScore}%</span>
                    <span>Target: {a.requiredScore}%</span>
                  </div>
                </div>
              ))}
              <Link to="/app/skill-gap" className="text-sm text-brand-400 hover:text-brand-300 block mt-2">
                Lihat semua →
              </Link>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
