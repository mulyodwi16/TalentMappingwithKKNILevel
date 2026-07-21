import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Users, Search, Download, Mail } from "lucide-react";
import toast from "react-hot-toast";
import api from "../../api/client.js";
import useAuthStore from "../../store/authStore.js";
import RankBadge from "../../components/RankBadge.jsx";
import WorkerDetailModal from "../../components/WorkerDetailModal.jsx";
import { rankName } from "../../lib/rank.js";
import { useLang } from "../../lib/i18n.jsx";

const STATUS_CONFIG = {
  ready:       { label: "Siap Naik",    cls: "badge-ready",       color: "#10b981" },
  in_progress: { label: "Dalam Proses", cls: "badge-in-progress", color: "#f59e0b" },
  not_ready:   { label: "Belum Siap",   cls: "badge-not-ready",   color: "#ef4444" },
};

// Daftar talenta - dipisah dari Dashboard HRD supaya dashboard tetap jadi ringkasan,
// bukan gulungan panjang berisi semuanya.
export default function TalentList() {
  const { t } = useLang();
  const [filters, setFilters] = useState({ status: "", level: "" });
  const [q, setQ] = useState("");
  const [detailId, setDetailId] = useState(null);
  const [showRequest, setShowRequest] = useState(false);
  const [reqForm, setReqForm] = useState({ type: "buka_ujian_ulang", payload: "" });

  const { data: workers = [], isLoading } = useQuery({
    queryKey: ["hrd-workers", filters],
    queryFn: () => {
      const params = new URLSearchParams(Object.fromEntries(Object.entries(filters).filter(([, v]) => v)));
      return api.get(`/hrd/workers?${params}`);
    },
  });

  const sendRequest = useMutation({
    mutationFn: () => api.post("/hrd/requests", reqForm),
    onSuccess: () => { toast.success(t("Request terkirim ke Admin")); setShowRequest(false); },
    onError: (err) => toast.error(err || t("Gagal")),
  });

  const exportExcel = async () => {
    try {
      const res = await fetch("/api/hrd/export/excel", { headers: { Authorization: `Bearer ${useAuthStore.getState().token}` } });
      const url = URL.createObjectURL(await res.blob());
      const a = document.createElement("a");
      a.href = url; a.download = "talent-mapping.xlsx"; a.click();
      URL.revokeObjectURL(url);
      toast.success(t("File diunduh"));
    } catch { toast.error(t("Gagal ekspor")); }
  };

  // Pencarian nama/email/kompetensi dilakukan di klien - daftarnya sudah utuh di memori,
  // jadi hasilnya muncul seketika tanpa menunggu server.
  const s = q.trim().toLowerCase();
  const list = s
    ? workers.filter((w) => [w.name, w.email, w.chosenSkkniTitle, w.position, w.department].some((v) => String(v || "").toLowerCase().includes(s)))
    : workers;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold flex items-center gap-2" style={{ color: "var(--text-base)" }}>
            <Users className="w-5 h-5 text-brand-600" /> {t("Daftar Talenta")}
          </h2>
          <p className="text-sm mt-0.5" style={{ color: "var(--text-3)" }}>
            {t("{n} talenta terpantau. Klik baris untuk melihat bukti kompetensinya.", { n: workers.length })}
          </p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => setShowRequest(true)} className="btn-outline text-sm py-1.5 px-3 flex items-center gap-1.5"><Mail className="w-3.5 h-3.5" /> {t("Request Admin")}</button>
          <button onClick={exportExcel} className="btn-primary text-sm py-1.5 px-3 flex items-center gap-1.5"><Download className="w-3.5 h-3.5" /> Excel</button>
        </div>
      </div>

      <div className="card p-5 space-y-4">
        <div className="flex flex-col sm:flex-row gap-2">
          <div className="relative flex-1">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2" style={{ color: "var(--text-4)" }} />
            <input value={q} onChange={(e) => setQ(e.target.value)} className="input text-sm pl-9" placeholder={t("Cari nama, email, atau kompetensi…")} />
          </div>
          <select className="input text-sm py-1.5 w-auto" value={filters.status}
            onChange={(e) => setFilters((f) => ({ ...f, status: e.target.value }))}>
            <option value="">{t("Semua Status")}</option>
            {Object.entries(STATUS_CONFIG).map(([k, v]) => <option key={k} value={k}>{t(v.label)}</option>)}
          </select>
          <select className="input text-sm py-1.5 w-auto" value={filters.level}
            onChange={(e) => setFilters((f) => ({ ...f, level: e.target.value }))}>
            <option value="">{t("Semua Rank")}</option>
            {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((l) => <option key={l} value={l}>{rankName(l)}</option>)}
          </select>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm" style={{ minWidth: 720 }}>
            <thead>
              <tr style={{ borderBottom: "1px solid var(--border)" }}>
                {["Nama", "Kompetensi", "Rank", "Unit Lulus", "Sertifikat", "Readiness", "Status"].map((h) => (
                  <th key={h} className="text-left text-[11px] font-semibold uppercase tracking-wider pb-2 pr-4 whitespace-nowrap" style={{ color: "var(--text-4)" }}>{t(h)}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr><td colSpan={7} className="text-center py-8" style={{ color: "var(--text-4)" }}>{t("Memuat…")}</td></tr>
              ) : list.length === 0 ? (
                <tr><td colSpan={7} className="text-center py-8" style={{ color: "var(--text-4)" }}>{t("Tidak ada data")}</td></tr>
              ) : list.map((w) => {
                const sc = STATUS_CONFIG[w.status] || STATUS_CONFIG.not_ready;
                return (
                  <tr key={w.id} onClick={() => setDetailId(w.id)} className="cursor-pointer hover:bg-brand-500/10 transition-colors" style={{ borderBottom: "1px solid var(--border)" }}>
                    <td className="py-3 pr-4">
                      <p className="font-medium" style={{ color: "var(--text-base)" }}>{w.name}</p>
                      <p className="text-xs" style={{ color: "var(--text-4)" }}>{w.email}</p>
                    </td>
                    <td className="py-3 pr-4" style={{ color: "var(--text-3)" }}>{w.chosenSkkniTitle || <span style={{ color: "var(--text-4)" }}>-</span>}</td>
                    <td className="py-3 pr-4">{w.currentKkniLevel ? <RankBadge level={w.currentKkniLevel} /> : <span style={{ color: "var(--text-4)" }}>-</span>}</td>
                    <td className="py-3 pr-4" style={{ color: "var(--text-3)" }}>
                      {/* Penyebutnya SELURUH unit kompetensi, bukan yang kebetulan pernah diuji. */}
                      {w.totalUnits ? <span><b className="text-emerald-500">{w.passedUnits}</b>/{w.totalUnits}</span> : <span style={{ color: "var(--text-4)" }}>-</span>}
                    </td>
                    <td className="py-3 pr-4">
                      {w.certCount ? <span className="text-xs bg-emerald-500/10 text-emerald-500 border border-emerald-500/30 rounded px-1.5 py-0.5">{w.certCount}</span> : <span style={{ color: "var(--text-4)" }}>-</span>}
                    </td>
                    <td className="py-3 pr-4">
                      <div className="flex items-center gap-2">
                        <div className="h-1.5 w-16 rounded-full overflow-hidden" style={{ background: "var(--bg-muted)" }}>
                          <div className="h-full rounded-full" style={{ width: `${w.readinessScore}%`, background: sc.color }} />
                        </div>
                        <span className="text-xs tabular-nums" style={{ color: "var(--text-3)" }}>{w.readinessScore}%</span>
                      </div>
                    </td>
                    <td className="py-3"><span className={`badge ${sc.cls}`}>{t(sc.label)}</span></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <p className="text-xs" style={{ color: "var(--text-4)" }}>
          {t("Unit lulus dihitung dari SELURUH unit kompetensi yang dipilih talenta, bukan hanya unit yang pernah diuji.")}
        </p>
      </div>

      {detailId && <WorkerDetailModal id={detailId} onClose={() => setDetailId(null)} />}

      {showRequest && (
        <div className="is-modal fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="card p-6 w-full max-w-md">
            <h3 className="font-semibold mb-4" style={{ color: "var(--text-base)" }}>{t("Ajukan Request ke Admin")}</h3>
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium mb-1.5 block" style={{ color: "var(--text-2)" }}>{t("Tipe Request")}</label>
                <select className="input" value={reqForm.type} onChange={(e) => setReqForm((f) => ({ ...f, type: e.target.value }))}>
                  <option value="buka_ujian_ulang">{t("Buka Ujian Ulang")}</option>
                  <option value="ubah_target_level">{t("Ubah Target Level")}</option>
                  <option value="tambah_kompetensi">{t("Tambah Kompetensi")}</option>
                  <option value="lainnya">{t("Lainnya")}</option>
                </select>
              </div>
              <div>
                <label className="text-sm font-medium mb-1.5 block" style={{ color: "var(--text-2)" }}>{t("Keterangan")}</label>
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
