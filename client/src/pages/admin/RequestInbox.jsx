import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import api from "../../api/client.js";

const STATUS_CLS = {
  pending:  { cls: "badge-in-progress", label: "Menunggu" },
  approved: { cls: "badge-ready",       label: "Disetujui" },
  rejected: { cls: "badge-not-ready",   label: "Ditolak" },
};

export default function RequestInbox() {
  const qc = useQueryClient();
  const [filter, setFilter] = useState("pending");
  const [notes, setNotes] = useState({});

  const { data: requests = [], isLoading } = useQuery({
    queryKey: ["admin-requests", filter],
    queryFn: () => api.get(`/admin/requests?status=${filter}`),
  });

  const handle = useMutation({
    mutationFn: ({ id, status }) => api.put(`/admin/requests/${id}`, { status, notes: notes[id] || "" }),
    onSuccess: () => { toast.success("Request diperbarui"); qc.invalidateQueries(["admin-requests"]); },
    onError: (err) => toast.error(err || "Gagal"),
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold text-white">Inbox Request</h2>
        <div className="flex gap-2">
          {Object.entries(STATUS_CLS).map(([k, v]) => (
            <button key={k} onClick={() => setFilter(k)}
              className={`text-sm px-3 py-1.5 rounded-lg transition-colors ${filter === k ? "bg-brand-600 text-white" : "bg-slate-800 text-slate-400 hover:text-white"}`}>
              {v.label}
            </button>
          ))}
        </div>
      </div>

      {isLoading ? (
        <div className="text-center py-12 text-slate-500">Memuat…</div>
      ) : requests.length === 0 ? (
        <div className="card p-12 text-center">
          <div className="text-4xl mb-3">✉</div>
          <p className="text-slate-500">Tidak ada request {STATUS_CLS[filter]?.label.toLowerCase()}</p>
        </div>
      ) : (
        <div className="space-y-4">
          {requests.map((r) => (
            <div key={r.id} className="card p-6">
              <div className="flex items-start gap-4">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-brand-600 to-tosca-500 flex items-center justify-center text-sm font-bold flex-shrink-0">
                  {r.fromName?.[0]?.toUpperCase() || "?"}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <p className="font-semibold text-white">{r.fromName || r.fromEmail}</p>
                    <span className={`badge ${STATUS_CLS[r.status]?.cls}`}>{STATUS_CLS[r.status]?.label}</span>
                  </div>
                  <p className="text-xs text-slate-500 mb-2">{r.fromEmail} · {new Date(r.createdAt).toLocaleString("id-ID")}</p>
                  <div className="bg-slate-900/60 rounded-xl p-3 mb-3">
                    <p className="text-xs text-brand-400 font-semibold mb-1">{r.type.replace(/_/g, " ").toUpperCase()}</p>
                    <p className="text-sm text-slate-300">{typeof r.payload === "string" ? r.payload : JSON.stringify(r.payload, null, 2)}</p>
                  </div>
                  {r.notes && (
                    <p className="text-xs text-slate-500 mb-3">Catatan Admin: {r.notes}</p>
                  )}
                  {r.status === "pending" && (
                    <div className="flex gap-3 items-center">
                      <input
                        className="input text-sm py-1.5 flex-1"
                        placeholder="Catatan (opsional)…"
                        value={notes[r.id] || ""}
                        onChange={(e) => setNotes((n) => ({ ...n, [r.id]: e.target.value }))}
                      />
                      <button
                        onClick={() => handle.mutate({ id: r.id, status: "approved" })}
                        className="text-sm px-3 py-1.5 rounded-lg bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-400 font-medium transition-colors"
                      >✓ Setujui</button>
                      <button
                        onClick={() => handle.mutate({ id: r.id, status: "rejected" })}
                        className="text-sm px-3 py-1.5 rounded-lg bg-red-500/20 hover:bg-red-500/30 text-red-400 font-medium transition-colors"
                      >✗ Tolak</button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
