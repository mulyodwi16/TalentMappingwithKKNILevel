import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { FileText, PenLine, Target, Route, Trophy, Award } from "lucide-react";
import api from "../../api/client.js";
import useAuthStore from "../../store/authStore.js";
import DailyLoginCard from "../../components/DailyLoginCard.jsx";
import DailyMissions from "../../components/DailyMissions.jsx";
import DailyQuiz from "../../components/DailyQuiz.jsx";
import RankHero from "../../components/RankHero.jsx";
import RankIdentityCard from "../../components/RankIdentityCard.jsx";
import RankUpOverlay from "../../components/RankUpOverlay.jsx";
import { rankName } from "../../lib/rank.js";

const STATUS_CONFIG = {
  ready:       { label: "Siap Naik",    cls: "badge-ready" },
  in_progress: { label: "Dalam Proses", cls: "badge-in-progress" },
  not_ready:   { label: "Belum Siap",   cls: "badge-not-ready" },
};

const LAST_RANK_KEY = (id) => `talenta:lastRank:${id}`;

export default function UserDashboard() {
  const { user } = useAuthStore();
  const { data: overview } = useQuery({ queryKey: ["overview"], queryFn: () => api.get("/user/overview") });
  const { data: attempts = [] } = useQuery({ queryKey: ["attempts"], queryFn: () => api.get("/user/attempts") });
  const { data: assessments = [] } = useQuery({ queryKey: ["assessments"], queryFn: () => api.get("/user/skill-assessments") });

  const [rankUp, setRankUp] = useState(null); // { from, to }

  const rank = overview?.rank;
  const effective = rank?.effective;

  // Deteksi kenaikan rank → rayakan (feel of accomplishment). Bandingkan dengan rank
  // terakhir yang tersimpan di localStorage per user. Akun baru tidak dirayakan.
  useEffect(() => {
    if (!effective || !user?.id) return;
    const key = LAST_RANK_KEY(user.id);
    const prev = Number(localStorage.getItem(key));
    if (prev && effective > prev) setRankUp({ from: prev, to: effective });
    localStorage.setItem(key, String(effective));
  }, [effective, user?.id]);

  const p = overview?.profile || user || {};
  const status = p?.status || "not_ready";
  const sc = STATUS_CONFIG[status] || STATUS_CONFIG.not_ready;

  const topGaps = assessments.filter((a) => a.gap > 0).sort((a, b) => b.gap - a.gap).slice(0, 3);

  const actions = [
    { to: "/app/cv-upload",     icon: FileText, label: "Upload CV",     desc: "Auto-klasifikasi Rank",        color: "#2563eb" },
    { to: "/app/exam",          icon: PenLine,  label: "Ikut Ujian",    desc: `${attempts.length} percobaan`,  color: "#12a594" },
    { to: "/app/skill-gap",     icon: Target,   label: "Skill Gap",     desc: `${topGaps.length} gap terdeteksi`, color: "#f59e0b" },
    { to: "/app/learning-path", icon: Route,    label: "Learning Path", desc: "Rekomendasi personal",          color: "#10b981" },
  ];

  return (
    <div className="space-y-6">
      {rankUp && <RankUpOverlay from={rankUp.from} to={rankUp.to} onClose={() => setRankUp(null)} />}

      {/* ── Panggung Rank (hero) + kartu identitas DI LUAR frame (kanan) ── */}
      {rank ? (
        <div className="grid lg:grid-cols-[minmax(0,1fr)_300px] gap-4 items-start">
          <RankHero
            rank={rank}
            rankInfo={overview?.rankInfo}
            readiness={overview?.readiness?.total ?? p?.readinessScore ?? 0}
            competency={overview?.chosenSkkni?.title}
            footer={
              <div className="mt-5 flex flex-wrap items-center justify-center gap-2">
                <span className={`badge ${sc.cls}`}>{sc.label}</span>
                {!overview?.chosenSkkni && (
                  <Link to="/app/profile" className="text-xs font-semibold text-brand-400 hover:underline">Pilih kompetensi target →</Link>
                )}
              </div>
            }
          />
          <div className="space-y-4">
            <RankIdentityCard
              level={rank.effective}
              identity={{
                name: p?.name,
                email: p?.email,
                subtitle: p?.position || p?.academicStatus || "Talenta",
                targetLabel: p?.targetKkniLevel ? `Target: ${rankName(p.targetKkniLevel)}` : null,
                photoUrl: p?.avatarUrl,
              }}
            />
            <Link to="/app/profile" className="card p-3 block text-center text-xs font-semibold text-brand-500 hover:underline">
              Kelola profil & foto →
            </Link>
          </div>
        </div>
      ) : (
        <div className="card p-8 text-center text-sm" style={{ color: "var(--text-4)" }}>Memuat rank…</div>
      )}

      {/* Gamifikasi harian — Course Harian di bawah bonus login (mengisi ruang kosong) */}
      <div className="grid lg:grid-cols-2 gap-4 items-start">
        <div className="space-y-4">
          <DailyLoginCard />
          <DailyQuiz />
        </div>
        <DailyMissions />
      </div>

      {/* Aksi cepat */}
      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {actions.map((c) => (
          <Link key={c.to} to={c.to} className="card p-5 hover:scale-[1.03] transition-transform group">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center mb-3"
              style={{ background: `${c.color}1f`, color: c.color }}>
              <c.icon className="w-5 h-5" />
            </div>
            <p className="font-semibold text-sm" style={{ color: "var(--text-base)" }}>{c.label}</p>
            <p className="text-xs mt-0.5" style={{ color: "var(--text-4)" }}>{c.desc}</p>
          </Link>
        ))}
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        {/* Riwayat ujian */}
        <div className="card p-6">
          <h3 className="font-semibold mb-4 flex items-center gap-2" style={{ color: "var(--text-base)" }}>
            <Trophy className="w-4 h-4 text-brand-600" /> Riwayat Ujian
          </h3>
          {attempts.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-sm" style={{ color: "var(--text-4)" }}>Belum ada riwayat ujian</p>
              <Link to="/app/exam" className="btn-primary text-sm py-2 px-4 mt-3 inline-block">Mulai Ujian</Link>
            </div>
          ) : (
            <div className="space-y-3">
              {attempts.slice(0, 5).map((a) => (
                <div key={a.id} className="flex items-center gap-3 p-3 rounded-xl" style={{ background: "var(--bg-muted)" }}>
                  <div className={`w-9 h-9 rounded-lg flex items-center justify-center text-xs font-bold ${
                    a.status === "ready" ? "bg-emerald-500/20 text-emerald-400" :
                    a.status === "in_progress" ? "bg-amber-500/20 text-amber-400" : "bg-red-500/20 text-red-400"
                  }`}>{a.readinessScore}%</div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium" style={{ color: "var(--text-base)" }}>Rank {rankName(a.kkniLevel)}</p>
                    <p className="text-xs" style={{ color: "var(--text-4)" }}>{new Date(a.createdAt).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" })}</p>
                  </div>
                  <span className={`badge ${STATUS_CONFIG[a.status]?.cls || "badge-not-ready"}`}>{STATUS_CONFIG[a.status]?.label}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Gap kompetensi */}
        <div className="card p-6">
          <h3 className="font-semibold mb-4 flex items-center gap-2" style={{ color: "var(--text-base)" }}>
            <Award className="w-4 h-4 text-brand-600" /> Gap Kompetensi Teratas
          </h3>
          {topGaps.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-sm" style={{ color: "var(--text-4)" }}>
                {assessments.length === 0 ? "Ikuti ujian untuk melihat gap" : "Semua kompetensi terpenuhi 🎉"}
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {topGaps.map((a) => (
                <div key={a.id}>
                  <div className="flex justify-between text-sm mb-1.5">
                    <span className="font-medium" style={{ color: "var(--text-2)" }}>{a.competencyName}</span>
                    <span className="text-red-400">{a.gap}% gap</span>
                  </div>
                  <div className="h-2 rounded-full overflow-hidden" style={{ background: "var(--bg-muted)" }}>
                    <div className="h-full bg-brand-600 rounded-full transition-all" style={{ width: `${a.currentScore}%` }} />
                  </div>
                  <div className="flex justify-between text-xs mt-0.5" style={{ color: "var(--text-4)" }}>
                    <span>Saat ini: {a.currentScore}%</span>
                    <span>Target: {a.requiredScore}%</span>
                  </div>
                </div>
              ))}
              <Link to="/app/skill-gap" className="text-sm text-brand-400 hover:text-brand-300 block mt-2">Lihat semua →</Link>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
