import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend,
} from "recharts";
import toast from "react-hot-toast";
import { X, Award, ClipboardCheck, Target } from "lucide-react";
import api from "../../api/client.js";
import RankBadge from "../../components/RankBadge.jsx";
import { rankName } from "../../lib/rank.js";
import useAuthStore from "../../store/authStore.js";
import { useLang } from "../../lib/i18n.jsx";

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

// ── Detail 1 talenta: kompetensi + bukti dari ujian (unit lulus, sertifikat, riwayat) ──
function WorkerDetailModal({ id, onClose }) {
  const { t } = useLang();
  const { data, isLoading } = useQuery({ queryKey: ["hrd-worker", id], queryFn: () => api.get(`/hrd/worker/${id}`) });
  const w = data?.worker;
  const passed = data?.assessments?.filter((a) => a.passed).length || 0;
  const total = data?.assessments?.length || 0;
  return (
    <div className="is-modal fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6" style={{ background: "rgba(0,0,0,0.6)" }} onClick={onClose}>
      <div className="w-full max-w-2xl rounded-2xl overflow-hidden flex flex-col shadow-2xl" style={{ background: "var(--bg-surface)", maxHeight: "90vh" }} onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between gap-3 p-4 border-b" style={{ borderColor: "var(--border)" }}>
          <div className="min-w-0">
            <p className="text-base font-bold truncate" style={{ color: "var(--text-base)" }}>{w?.name || t("Memuat…")}</p>
            {w && <p className="text-xs" style={{ color: "var(--text-4)" }}>{w.email} · {w.academicStatus || w.education || "-"}</p>}
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg shrink-0 hover:bg-[var(--bg-muted)]" style={{ color: "var(--text-3)" }}><X className="w-4 h-4" /></button>
        </div>

        <div className="p-4 space-y-4 overflow-y-auto">
          {isLoading ? (
            <p className="text-sm text-center py-8" style={{ color: "var(--text-4)" }}>{t("Memuat detail…")}</p>
          ) : (
            <>
              {/* Ringkas */}
              <div className="grid grid-cols-3 gap-2">
                <div className="rounded-xl p-3 text-center" style={{ background: "var(--bg-raised)" }}>
                  <div className="flex justify-center mb-1">{w?.currentKkniLevel ? <RankBadge level={w.currentKkniLevel} /> : <span style={{ color: "var(--text-4)" }}>-</span>}</div>
                  <p className="text-[11px]" style={{ color: "var(--text-4)" }}>{t("Skill Rank")}</p>
                </div>
                <div className="rounded-xl p-3 text-center" style={{ background: "var(--bg-raised)" }}>
                  <p className="text-xl font-black" style={{ color: "var(--text-base)" }}>{passed}/{total}</p>
                  <p className="text-[11px]" style={{ color: "var(--text-4)" }}>{t("Unit lulus")}</p>
                </div>
                <div className="rounded-xl p-3 text-center" style={{ background: "var(--bg-raised)" }}>
                  <p className="text-xl font-black text-emerald-500">{data?.certificates?.length || 0}</p>
                  <p className="text-[11px]" style={{ color: "var(--text-4)" }}>{t("Sertifikat")}</p>
                </div>
              </div>

              <div className="flex items-center gap-2 text-sm">
                <Target className="w-4 h-4 text-brand-500" />
                <span style={{ color: "var(--text-3)" }}>{t("Kompetensi:")}</span>
                <span className="font-semibold" style={{ color: "var(--text-base)" }}>{data?.competency?.title || t("Belum dipilih")}</span>
              </div>

              {/* Penilaian per unit (dari ujian) */}
              <div>
                <p className="text-xs font-semibold mb-2 flex items-center gap-1.5" style={{ color: "var(--text-3)" }}><ClipboardCheck className="w-3.5 h-3.5" /> {t("Penilaian Unit (hasil ujian)")}</p>
                {total === 0 ? (
                  <p className="text-xs" style={{ color: "var(--text-4)" }}>{t("Belum ada hasil ujian.")}</p>
                ) : (
                  <div className="space-y-2 max-h-52 overflow-y-auto pr-1">
                    {data.assessments.map((a) => (
                      <div key={a.code}>
                        <div className="flex justify-between text-xs mb-1">
                          <span className="truncate pr-2" style={{ color: "var(--text-2)" }}>{a.name}</span>
                          <span className={a.passed ? "text-emerald-500" : "text-red-400"}>{a.score}% {a.passed ? "✓" : ""}</span>
                        </div>
                        <div className="h-1.5 rounded-full overflow-hidden" style={{ background: "var(--bg-muted)" }}>
                          <div className={`h-full rounded-full ${a.passed ? "bg-emerald-500" : "bg-red-500"}`} style={{ width: `${a.score}%` }} />
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Sertifikat */}
              {data?.certificates?.length > 0 && (
                <div>
                  <p className="text-xs font-semibold mb-2 flex items-center gap-1.5" style={{ color: "var(--text-3)" }}><Award className="w-3.5 h-3.5 text-emerald-500" /> {t("Sertifikat ({n})", { n: data.certificates.length })}</p>
                  <div className="flex flex-wrap gap-1.5">
                    {data.certificates.map((c) => (
                      <span key={c.id} className="text-[11px] bg-emerald-500/10 text-emerald-500 border border-emerald-500/30 rounded-lg px-2 py-0.5">{c.name} · {c.score}%</span>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export default function HrdDashboard() {
  const { t } = useLang();
  const [filters, setFilters] = useState({ status: "", department: "", level: "" });
  const [showRequest, setShowRequest] = useState(false);
  const [detailId, setDetailId] = useState(null);
  const [reqForm, setReqForm] = useState({ type: "buka_ujian_ulang", payload: "" });

  const { data: workers = [], isLoading } = useQuery({
    queryKey: ["hrd-workers", filters],
    queryFn: () => {
      const params = new URLSearchParams(Object.fromEntries(Object.entries(filters).filter(([, v]) => v)));
      return api.get(`/hrd/workers?${params}`);
    },
  });

  const { data: analytics } = useQuery({
    queryKey: ["hrd-analytics"],
    queryFn: () => api.get("/hrd/analytics"),
  });

  const sendRequest = useMutation({
    mutationFn: () => api.post("/hrd/requests", reqForm),
    onSuccess: () => { toast.success(t("Request terkirim ke Admin")); setShowRequest(false); },
    onError: (err) => toast.error(err || t("Gagal")),
  });

  const exportExcel = async () => {
    try {
      const res = await fetch("/api/hrd/export/excel", { headers: { Authorization: `Bearer ${useAuthStore.getState().token}` } });
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url; a.download = "talent-mapping.xlsx"; a.click();
      URL.revokeObjectURL(url);
      toast.success(t("File diunduh"));
    } catch { toast.error(t("Gagal ekspor")); }
  };

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

      {/* Talent table */}
      <div className="card p-6">
        <div className="flex flex-col sm:flex-row gap-3 mb-4">
          <h3 className="font-semibold text-white flex-1">{t("Daftar Talenta")}</h3>
          <div className="flex gap-2 flex-wrap">
            <select className="input text-sm py-1.5 w-auto" value={filters.status}
              onChange={(e) => setFilters((f) => ({ ...f, status: e.target.value }))}>
              <option value="">{t("Semua Status")}</option>
              {Object.entries(STATUS_CONFIG).map(([k, v]) => <option key={k} value={k}>{t(v.label)}</option>)}
            </select>
            <select className="input text-sm py-1.5 w-auto" value={filters.level}
              onChange={(e) => setFilters((f) => ({ ...f, level: e.target.value }))}>
              <option value="">{t("Semua Rank")}</option>
              {[1,2,3,4,5,6,7,8,9].map((l) => <option key={l} value={l}>{rankName(l)}</option>)}
            </select>
          </div>
          <div className="flex gap-2">
            <button onClick={() => setShowRequest(true)} className="btn-outline text-sm py-1.5 px-3">{t("✉ Request Admin")}</button>
            <button onClick={exportExcel} className="btn-primary text-sm py-1.5 px-3">⬇ Excel</button>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-700">
                {["Nama", "Kompetensi", "Rank", "Unit Lulus", "Sertifikat", "Readiness", "Status"].map((h) => (
                  <th key={h} className="text-left text-xs font-semibold text-slate-500 pb-2 pr-4">{t(h)}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {isLoading ? (
                <tr><td colSpan={7} className="text-center py-8 text-slate-500">{t("Memuat…")}</td></tr>
              ) : workers.length === 0 ? (
                <tr><td colSpan={7} className="text-center py-8 text-slate-500">{t("Tidak ada data")}</td></tr>
              ) : workers.map((w) => {
                const sc = STATUS_CONFIG[w.status] || STATUS_CONFIG.not_ready;
                return (
                  <tr key={w.id} onClick={() => setDetailId(w.id)} className="hover:bg-slate-800/30 transition-colors cursor-pointer">
                    <td className="py-3 pr-4">
                      <p className="font-medium text-white">{w.name}</p>
                      <p className="text-xs text-slate-500">{w.email}</p>
                    </td>
                    <td className="py-3 pr-4 text-slate-300">{w.chosenSkkniTitle || <span className="text-slate-600">-</span>}</td>
                    <td className="py-3 pr-4">{w.currentKkniLevel ? <RankBadge level={w.currentKkniLevel} /> : <span className="text-slate-600">-</span>}</td>
                    <td className="py-3 pr-4 text-slate-300">
                      {w.assessedUnits ? <span><b className="text-emerald-400">{w.passedUnits}</b>/{w.assessedUnits}</span> : <span className="text-slate-600">-</span>}
                    </td>
                    <td className="py-3 pr-4">
                      {w.certCount ? <span className="text-xs bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 rounded px-1.5 py-0.5">{w.certCount}</span> : <span className="text-slate-600">-</span>}
                    </td>
                    <td className="py-3 pr-4">
                      <div className="flex items-center gap-2">
                        <div className="h-1.5 w-16 bg-slate-700 rounded-full overflow-hidden">
                          <div className="h-full rounded-full" style={{ width: `${w.readinessScore}%`, background: sc.color }} />
                        </div>
                        <span className="text-xs">{w.readinessScore}%</span>
                      </div>
                    </td>
                    <td className="py-3"><span className={`badge ${sc.cls}`}>{t(sc.label)}</span></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <p className="text-xs text-slate-500 mt-3">{t("Klik baris talenta untuk melihat detail kompetensi, unit lulus, & sertifikat dari hasil ujian.")}</p>
      </div>

      {detailId && <WorkerDetailModal id={detailId} onClose={() => setDetailId(null)} />}

      {/* Request modal */}
      {showRequest && (
        <div className="is-modal fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="card p-6 w-full max-w-md">
            <h3 className="font-semibold text-white mb-4">{t("Ajukan Request ke Admin")}</h3>
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium text-slate-300 mb-1.5 block">{t("Tipe Request")}</label>
                <select className="input" value={reqForm.type} onChange={(e) => setReqForm((f) => ({ ...f, type: e.target.value }))}>
                  <option value="buka_ujian_ulang">{t("Buka Ujian Ulang")}</option>
                  <option value="ubah_target_level">{t("Ubah Target Level")}</option>
                  <option value="tambah_kompetensi">{t("Tambah Kompetensi")}</option>
                  <option value="lainnya">{t("Lainnya")}</option>
                </select>
              </div>
              <div>
                <label className="text-sm font-medium text-slate-300 mb-1.5 block">{t("Keterangan")}</label>
                <textarea className="input h-24 resize-none" placeholder={t("Detail request Anda…")}
                  value={reqForm.payload} onChange={(e) => setReqForm((f) => ({ ...f, payload: e.target.value }))} />
              </div>
              <div className="flex gap-3">
                <button onClick={() => setShowRequest(false)} className="btn-outline flex-1">{t("Batal")}</button>
                <button onClick={() => sendRequest.mutate()} disabled={sendRequest.isPending} className="btn-primary flex-1">
                  {sendRequest.isPending ? t("Mengirim…") : t("Kirim Request")}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
