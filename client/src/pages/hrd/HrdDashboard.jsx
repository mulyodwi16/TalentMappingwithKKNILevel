import { useState } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend,
} from "recharts";
import { Activity, ArrowRight } from "lucide-react";
import api from "../../api/client.js";
import RankBadge from "../../components/RankBadge.jsx";
import WorkerDetailModal from "../../components/WorkerDetailModal.jsx";
import { JobPipeline, SkillShortage } from "../../components/JobPipeline.jsx";
import { rankName } from "../../lib/rank.js";
import { useLang, dateLocale } from "../../lib/i18n.jsx";

const STATUS_CONFIG = {
  ready:       { label: "Siap Naik",    cls: "badge-ready",       color: "#10b981" },
  in_progress: { label: "Dalam Proses", cls: "badge-in-progress",  color: "#f59e0b" },
  not_ready:   { label: "Belum Siap",   cls: "badge-not-ready",    color: "#ef4444" },
};

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="card p-3 text-xs shadow-xl">
      <p className="font-semibold text-white mb-1">{label}</p>
      {payload.map((p) => <p key={p.name} style={{ color: p.color }}>{p.name}: {p.value}</p>)}
    </div>
  );
};

// ── Pergerakan talenta dalam N hari terakhir ─────────────────────────────────── Sengaja dua daftar berdampingan: yang BERGERAK
// (ada unit dinilai / ujian / sertifikat) dan yang DIAM. Yang diam justru sering lebih
// penting - merekalah yang perlu didorong, dan tak pernah muncul di grafik mana pun.
function TalentMovement({ onOpen }) {
  const { lang, t } = useLang();
  const [days, setDays] = useState(30);
  const { data, isLoading } = useQuery({
    queryKey: ["hrd-movement", days],
    queryFn: () => api.get(`/hrd/movement?days=${days}`),
  });

  const Row = ({ r, quiet }) => (
    <button onClick={() => onOpen(r.id)} className="w-full text-left flex items-center gap-3 rounded-lg p-2.5 hover:bg-brand-500/10 transition-colors">
      <RankBadge level={r.rank} showNum={false} />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium truncate" style={{ color: "var(--text-base)" }}>{r.name}</p>
        <p className="text-[11px] truncate" style={{ color: "var(--text-4)" }}>
          {quiet
            ? `${t("Kesiapan")} ${r.readiness}% · ${r.competency || t("belum pilih kompetensi")}`
            : [
              r.unitsMastered ? t("{n} unit dikuasai", { n: r.unitsMastered }) : null,
              r.exams ? t("{n} ujian", { n: r.exams }) : null,
              r.certs ? t("{n} sertifikat", { n: r.certs }) : null,
              r.lastUnit,
            ].filter(Boolean).join(" · ")}
        </p>
      </div>
      {!quiet && r.lastActivityAt && (
        <span className="text-[10px] shrink-0" style={{ color: "var(--text-4)" }}>
          {new Date(r.lastActivityAt).toLocaleDateString(dateLocale(lang), { day: "numeric", month: "short" })}
        </span>
      )}
    </button>
  );

  return (
    <div className="card p-6">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
        <h3 className="font-semibold flex items-center gap-2" style={{ color: "var(--text-base)" }}>
          <Activity className="w-4 h-4 text-brand-600" /> {t("Pergerakan Talenta")}
        </h3>
        <div className="flex gap-1.5">
          {[7, 30, 90].map((d) => (
            <button key={d} onClick={() => setDays(d)}
              className={`px-2.5 py-1 rounded-full text-[11px] font-medium transition-colors ${days === d ? "bg-brand-600 text-white" : "hover:bg-brand-500/10"}`}
              style={days === d ? {} : { border: "1px solid var(--border-2)", color: "var(--text-3)" }}>
              {t("{n} hari", { n: d })}
            </button>
          ))}
        </div>
      </div>

      {isLoading ? (
        <p className="text-sm text-center py-6" style={{ color: "var(--text-4)" }}>{t("Memuat…")}</p>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider mb-2 text-emerald-500">
              {t("Bergerak ({n})", { n: data?.moving?.length || 0 })}
            </p>
            {data?.moving?.length
              ? <div className="space-y-1">{data.moving.slice(0, 6).map((r) => <Row key={r.id} r={r} />)}</div>
              : <p className="text-xs py-3" style={{ color: "var(--text-4)" }}>{t("Belum ada aktivitas di rentang ini.")}</p>}
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider mb-2 text-amber-500">
              {t("Diam ({n})", { n: data?.idle?.length || 0 })}
            </p>
            {data?.idle?.length
              ? <div className="space-y-1">{data.idle.slice(0, 6).map((r) => <Row key={r.id} r={r} quiet />)}</div>
              : <p className="text-xs py-3" style={{ color: "var(--text-4)" }}>{t("Semua talenta bergerak. Bagus.")}</p>}
          </div>
        </div>
      )}
      <p className="text-[11px] mt-3" style={{ color: "var(--text-4)" }}>
        {t("Yang diam diurutkan dari kesiapan tertinggi - mereka yang paling dekat memenuhi syarat tapi berhenti bergerak.")}
      </p>
    </div>
  );
}

export default function HrdDashboard() {
  const { t } = useLang();
  const [detailId, setDetailId] = useState(null);

  const { data: analytics } = useQuery({
    queryKey: ["hrd-analytics"],
    queryFn: () => api.get("/hrd/analytics"),
  });

  const levelData = Object.entries(analytics?.levelDistribution || {})
    .map(([level, count]) => ({ level: rankName(Number(level)), count }))
    .sort((a, b) => a.level.localeCompare(b.level));

  const statusPie = Object.entries(analytics?.statusCounts || {}).map(([k, v]) => ({
    name: STATUS_CONFIG[k] ? t(STATUS_CONFIG[k].label) : k, value: v, color: STATUS_CONFIG[k]?.color || "#666",
  }));

  return (
    <div className="space-y-6">
      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: "Total Talenta", value: analytics?.total || 0, color: "text-white" },
          { label: "Siap Naik", value: analytics?.statusCounts?.ready || 0, color: "text-emerald-400" },
          { label: "Sertifikat Terbit", value: analytics?.totalCertificates || 0, color: "text-amber-400" },
          { label: "Rata-rata Readiness", value: `${analytics?.avgReadiness || 0}%`, color: "text-brand-400" },
        ].map((s) => (
          <div key={s.label} className="card p-5 text-center">
            <p className={`text-3xl font-black ${s.color}`}>{s.value}</p>
            <p className="text-sm text-slate-400 mt-1">{t(s.label)}</p>
          </div>
        ))}
      </div>

      {/* Pergerakan talenta - menjawab "apa yang berubah sejak terakhir saya lihat",
          pertanyaan yang tak bisa dijawab daftar talenta maupun grafik distribusi. */}
      <TalentMovement onOpen={setDetailId} />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
        <JobPipeline />
        <SkillShortage />
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="card p-6">
          <h3 className="font-semibold text-white mb-4">{t("Distribusi Skill Rank")}</h3>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={levelData}>
              <XAxis dataKey="level" tick={{ fill: "#94a3b8", fontSize: 11 }} />
              <YAxis tick={{ fill: "#94a3b8", fontSize: 11 }} allowDecimals={false} />
              <Tooltip content={<CustomTooltip />} />
              <Bar dataKey="count" fill="#2563eb" radius={[6, 6, 0, 0]} name={t("Jumlah")} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="card p-6">
          <h3 className="font-semibold text-white mb-4">{t("Status Kesiapan Promosi")}</h3>
          <ResponsiveContainer width="100%" height={200}>
            <PieChart>
              <Pie data={statusPie} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} paddingAngle={3}>
                {statusPie.map((e, i) => <Cell key={i} fill={e.color} />)}
              </Pie>
              <Tooltip content={<CustomTooltip />} />
              <Legend iconType="circle" formatter={(v) => <span className="text-xs text-slate-300">{v}</span>} />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Daftar talenta lengkap pindah ke halamannya sendiri - dashboard tetap ringkasan. */}
      <Link to="/app/hrd/talenta" className="card p-4 flex items-center justify-between gap-3 hover:bg-brand-500/10 transition-colors">
        <div className="min-w-0">
          <p className="text-sm font-semibold" style={{ color: "var(--text-base)" }}>{t("Daftar Talenta")}</p>
          <p className="text-xs" style={{ color: "var(--text-4)" }}>{t("Cari, saring, dan telusuri bukti kompetensi tiap talenta.")}</p>
        </div>
        <ArrowRight className="w-4 h-4 shrink-0" style={{ color: "var(--text-4)" }} />
      </Link>

      {detailId && <WorkerDetailModal id={detailId} onClose={() => setDetailId(null)} />}
    </div>
  );
}
