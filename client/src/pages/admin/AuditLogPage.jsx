import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, ArrowRight } from "lucide-react";
import api from "../../api/client.js";
import { useLang, dateLocale } from "../../lib/i18n.jsx";

const ACTION_COLOR = {
  create: "text-emerald-400",
  update: "text-brand-400",
  delete: "text-red-400",
  approved: "text-emerald-400",
  rejected: "text-red-400",
  send: "text-amber-400",
};

function getActionColor(action) {
  for (const [k, v] of Object.entries(ACTION_COLOR)) {
    if (action?.startsWith(k)) return v;
  }
  return "text-slate-400";
}

export default function AuditLogPage() {
  const { t, lang } = useLang();
  const [page, setPage] = useState(1);

  const { data } = useQuery({
    queryKey: ["audit-log", page],
    queryFn: () => api.get(`/admin/audit-log?limit=20&page=${page}`),
    keepPreviousData: true,
  });

  const logs = data?.logs || [];
  const total = data?.total || 0;
  const totalPages = Math.ceil(total / 20);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-white">{t("Audit Log")}</h2>
          <p className="text-slate-400 text-sm mt-0.5">{t("{n} total aktivitas tercatat", { n: total })}</p>
        </div>
      </div>

      <div className="card overflow-x-auto">
        <table className="w-full text-sm min-w-[560px]">
          <thead className="border-b border-slate-700">
            <tr>
              {["Waktu", "Aktor", "Aksi", "Target"].map((h) => (
                <th key={h} className="text-left text-xs font-semibold text-slate-500 px-4 py-3">{t(h)}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/60">
            {logs.length === 0 ? (
              <tr><td colSpan={4} className="text-center py-8 text-slate-500">{t("Belum ada log")}</td></tr>
            ) : logs.map((log) => (
              <tr key={log.id} className="hover:bg-slate-800/20 transition-colors">
                <td className="px-4 py-3 text-slate-500 text-xs whitespace-nowrap">
                  {new Date(log.createdAt).toLocaleString(dateLocale(lang))}
                </td>
                <td className="px-4 py-3 text-slate-300 text-xs">{log.actorEmail || "-"}</td>
                <td className="px-4 py-3">
                  <span className={`text-xs font-semibold font-mono ${getActionColor(log.action)}`}>
                    {log.action}
                  </span>
                </td>
                <td className="px-4 py-3 text-slate-400 text-xs max-w-xs truncate">{log.target || "-"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2">
          <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1}
            className="btn-outline text-sm py-1.5 px-3 disabled:opacity-40 inline-flex items-center gap-1"><ArrowLeft size={14} /> Prev</button>
          <span className="text-sm text-slate-400">{t("Halaman {a} / {b}", { a: page, b: totalPages })}</span>
          <button onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page === totalPages}
            className="btn-outline text-sm py-1.5 px-3 disabled:opacity-40 inline-flex items-center gap-1">Next <ArrowRight size={14} /></button>
        </div>
      )}
    </div>
  );
}
