import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend,
} from "recharts";
import toast from "react-hot-toast";
import api from "../../api/client.js";
import useAuthStore from "../../store/authStore.js";

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

export default function HrdDashboard() {
  const { user } = useAuthStore();
  const [filters, setFilters] = useState({ status: "", department: "", level: "" });
  const [showRequest, setShowRequest] = useState(false);
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
    onSuccess: () => { toast.success("Request terkirim ke Admin"); setShowRequest(false); },
    onError: (err) => toast.error(err || "Gagal"),
  });

  const exportExcel = async () => {
    try {
      const res = await fetch("/api/hrd/export/excel", {
        headers: { Authorization: `Bearer ${useAuthStore.getState().token}` },
      });
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url; a.download = "talent-mapping.xlsx"; a.click();
      URL.revokeObjectURL(url);
      toast.success("File diunduh");
    } catch {
      toast.error("Gagal ekspor");
    }
  };

  const levelData = Object.entries(analytics?.levelDistribution || {})
    .map(([level, count]) => ({ level: `Level ${level}`, count }))
    .sort((a, b) => a.level.localeCompare(b.level));

  const statusPie = Object.entries(analytics?.statusCounts || {}).map(([k, v]) => ({
    name: STATUS_CONFIG[k]?.label || k, value: v, color: STATUS_CONFIG[k]?.color || "#666",
  }));

  return (
    <div className="space-y-6">
      {/* Stats */}
      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: "Total Pekerja", value: analytics?.total || 0, color: "text-white" },
          { label: "Siap Naik", value: analytics?.statusCounts?.ready || 0, color: "text-emerald-400" },
          { label: "Dalam Proses", value: analytics?.statusCounts?.in_progress || 0, color: "text-amber-400" },
          { label: "Rata-rata Readiness", value: `${analytics?.avgReadiness || 0}%`, color: "text-brand-400" },
        ].map((s) => (
          <div key={s.label} className="card p-5 text-center">
            <p className={`text-3xl font-black ${s.color}`}>{s.value}</p>
            <p className="text-sm text-slate-400 mt-1">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Charts */}
      <div className="grid lg:grid-cols-2 gap-6">
        <div className="card p-6">
          <h3 className="font-semibold text-white mb-4">Distribusi Level KKNI</h3>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={levelData}>
              <XAxis dataKey="level" tick={{ fill: "#94a3b8", fontSize: 11 }} />
              <YAxis tick={{ fill: "#94a3b8", fontSize: 11 }} />
              <Tooltip content={<CustomTooltip />} />
              <Bar dataKey="count" fill="#2563eb" radius={[6, 6, 0, 0]} name="Jumlah" />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="card p-6">
          <h3 className="font-semibold text-white mb-4">Status Kesiapan Promosi</h3>
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

      {/* Workers table */}
      <div className="card p-6">
        <div className="flex flex-col sm:flex-row gap-3 mb-4">
          <h3 className="font-semibold text-white flex-1">Daftar Pekerja</h3>
          <div className="flex gap-2 flex-wrap">
            {/* Filters */}
            <select className="input text-sm py-1.5 w-auto" value={filters.status}
              onChange={(e) => setFilters((f) => ({ ...f, status: e.target.value }))}>
              <option value="">Semua Status</option>
              {Object.entries(STATUS_CONFIG).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
            </select>
            <input className="input text-sm py-1.5 w-32" placeholder="Departemen"
              value={filters.department} onChange={(e) => setFilters((f) => ({ ...f, department: e.target.value }))} />
            <select className="input text-sm py-1.5 w-auto" value={filters.level}
              onChange={(e) => setFilters((f) => ({ ...f, level: e.target.value }))}>
              <option value="">Semua Level</option>
              {[1,2,3,4,5,6,7,8,9].map((l) => <option key={l} value={l}>Level {l}</option>)}
            </select>
          </div>
          <div className="flex gap-2">
            <button onClick={() => setShowRequest(true)} className="btn-outline text-sm py-1.5 px-3">✉ Request Admin</button>
            <button onClick={exportExcel} className="btn-primary text-sm py-1.5 px-3">⬇ Excel</button>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-700">
                {["Nama", "Email", "Departemen", "Pendidikan", "Level KKNI", "Readiness", "Status"].map((h) => (
                  <th key={h} className="text-left text-xs font-semibold text-slate-500 pb-2 pr-4">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {isLoading ? (
                <tr><td colSpan={7} className="text-center py-8 text-slate-500">Memuat…</td></tr>
              ) : workers.length === 0 ? (
                <tr><td colSpan={7} className="text-center py-8 text-slate-500">Tidak ada data</td></tr>
              ) : workers.map((w) => {
                const sc = STATUS_CONFIG[w.status] || STATUS_CONFIG.not_ready;
                return (
                  <tr key={w.id} className="hover:bg-slate-800/30 transition-colors">
                    <td className="py-3 pr-4 font-medium text-white">{w.name}</td>
                    <td className="py-3 pr-4 text-slate-400">{w.email}</td>
                    <td className="py-3 pr-4 text-slate-400">{w.department || "—"}</td>
                    <td className="py-3 pr-4 text-slate-400">{w.education || "—"}</td>
                    <td className="py-3 pr-4">
                      {w.currentKkniLevel ? (
                        <span className="badge bg-brand-500/20 text-brand-400 border-brand-500/30">Level {w.currentKkniLevel}</span>
                      ) : <span className="text-slate-600">—</span>}
                    </td>
                    <td className="py-3 pr-4">
                      <div className="flex items-center gap-2">
                        <div className="h-1.5 w-16 bg-slate-700 rounded-full overflow-hidden">
                          <div className="h-full rounded-full" style={{ width: `${w.readinessScore}%`, background: sc.color }} />
                        </div>
                        <span className="text-xs">{w.readinessScore}%</span>
                      </div>
                    </td>
                    <td className="py-3"><span className={`badge ${sc.cls}`}>{sc.label}</span></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Request modal */}
      {showRequest && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="card p-6 w-full max-w-md">
            <h3 className="font-semibold text-white mb-4">Ajukan Request ke Admin</h3>
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium text-slate-300 mb-1.5 block">Tipe Request</label>
                <select className="input" value={reqForm.type} onChange={(e) => setReqForm((f) => ({ ...f, type: e.target.value }))}>
                  <option value="buka_ujian_ulang">Buka Ujian Ulang</option>
                  <option value="ubah_target_level">Ubah Target Level</option>
                  <option value="tambah_kompetensi">Tambah Kompetensi</option>
                  <option value="lainnya">Lainnya</option>
                </select>
              </div>
              <div>
                <label className="text-sm font-medium text-slate-300 mb-1.5 block">Keterangan</label>
                <textarea
                  className="input h-24 resize-none"
                  placeholder="Detail request Anda…"
                  value={reqForm.payload}
                  onChange={(e) => setReqForm((f) => ({ ...f, payload: e.target.value }))}
                />
              </div>
              <div className="flex gap-3">
                <button onClick={() => setShowRequest(false)} className="btn-outline flex-1">Batal</button>
                <button onClick={() => sendRequest.mutate()} disabled={sendRequest.isPending} className="btn-primary flex-1">
                  {sendRequest.isPending ? "Mengirim…" : "Kirim Request"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
