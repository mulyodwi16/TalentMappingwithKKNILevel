import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import api from "../../api/client.js";
import { useLang, dateLocale } from "../../lib/i18n.jsx";

export default function AdminDashboard() {
  const { t, lang } = useLang();
  const { data: stats } = useQuery({ queryKey: ["admin-dashboard"], queryFn: () => api.get("/admin/dashboard") });

  const cards = [
    { to: "/app/admin/users",     icon: "◉", label: "Pengguna",       value: stats?.totalUsers,    sub: "akun terdaftar",    color: "from-brand-600 to-brand-700" },
    { to: "/app/admin/requests",  icon: "✉", label: "Request Masuk",  value: stats?.pendingRequests, sub: "menunggu tindakan", color: "from-amber-500 to-orange-600" },
    { to: "/app/admin/rules",     icon: "⊙", label: "Aturan Mapping", value: null,                 sub: "konfigurasi rules", color: "from-tosca-500 to-tosca-600" },
    { to: "/app/admin/questions", icon: "✎", label: "Bank Soal",      value: null,                 sub: "kelola soal ujian", color: "from-emerald-500 to-teal-600" },
    { to: "/app/admin/audit",     icon: "≡", label: "Audit Log",      value: null,                 sub: "lacak semua aksi",  color: "from-slate-600 to-slate-700" },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-white">{t("Panel Admin")}</h2>
        <p className="text-slate-400 text-sm mt-1">{t("Kontrol penuh atas seluruh sistem")}</p>
      </div>

      {/* Status counts */}
      {stats?.statusCounts && (
        <div className="grid sm:grid-cols-3 gap-4">
          {[
            { k: "ready",       label: "Siap Naik",    color: "emerald" },
            { k: "in_progress", label: "Dalam Proses", color: "amber" },
            { k: "not_ready",   label: "Belum Siap",   color: "red" },
          ].map(({ k, label, color }) => {
            const count = stats.statusCounts[k] || 0;
            return (
              <div key={k} className="card p-5 text-center">
                <p className={`text-3xl font-black text-${color}-400`}>{count}</p>
                <p className="text-sm text-slate-400 mt-1">{t(label)}</p>
              </div>
            );
          })}
        </div>
      )}

      {/* Nav cards */}
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {cards.map((c) => (
          <Link key={c.to} to={c.to} className="card p-5 hover:scale-105 transition-transform group">
            <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${c.color} flex items-center justify-center text-lg mb-3`}>{c.icon}</div>
            <div className="flex items-center justify-between">
              <p className="font-semibold text-white text-sm">{t(c.label)}</p>
              {c.value != null && <span className="text-2xl font-black text-white">{c.value}</span>}
            </div>
            <p className="text-xs text-slate-500 mt-0.5">{t(c.sub)}</p>
          </Link>
        ))}
      </div>

      {/* Recent audit */}
      {stats?.recentLogs?.length > 0 && (
        <div className="card p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-white">{t("Aktivitas Terbaru")}</h3>
            <Link to="/app/admin/audit" className="text-xs text-brand-400 hover:text-brand-300">{t("Lihat semua →")}</Link>
          </div>
          <div className="space-y-2">
            {stats.recentLogs.map((log) => (
              <div key={log.id} className="flex items-center gap-3 py-2 border-b border-slate-800/50">
                <div className="w-7 h-7 rounded-lg bg-slate-700 flex items-center justify-center text-xs">≡</div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-white truncate">{log.action.replace(/_/g, " ")}</p>
                  <p className="text-xs text-slate-500">{log.actorEmail} · {new Date(log.createdAt).toLocaleString(dateLocale(lang))}</p>
                </div>
                {log.target && <span className="text-xs text-slate-600 truncate max-w-24">{log.target}</span>}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
