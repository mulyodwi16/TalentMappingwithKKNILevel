import { useQuery } from "@tanstack/react-query";
import { X, Award, ClipboardCheck, Target } from "lucide-react";
import api from "../api/client.js";
import RankBadge from "./RankBadge.jsx";
import { useLang } from "../lib/i18n.jsx";

// Detail 1 talenta: kompetensi + bukti dari ujian (unit lulus, sertifikat, riwayat).
// Dipakai dari Dashboard HRD (panel pergerakan) maupun halaman Daftar Talenta.
export default function WorkerDetailModal({ id, onClose }) {
  const { t } = useLang();
  const { data, isLoading } = useQuery({ queryKey: ["hrd-worker", id], queryFn: () => api.get(`/hrd/worker/${id}`) });
  const w = data?.worker;
  // Penyebutnya datang dari server (SELURUH unit kompetensi yang dipilih), bukan dihitung
  // ulang dari daftar penilaian. Kalau dihitung ulang, baris 6/42 di tabel akan terbuka
  // jadi 6/6 di modal - dua angka berbeda untuk orang yang sama, di layar yang sama.
  const passed = data?.passedUnits ?? 0;
  const total = data?.totalUnits ?? 0;
  const assessed = data?.assessments?.length || 0;

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

              <div>
                <p className="text-xs font-semibold mb-2 flex items-center gap-1.5" style={{ color: "var(--text-3)" }}><ClipboardCheck className="w-3.5 h-3.5" /> {t("Penilaian Unit (hasil ujian)")}</p>
                {assessed === 0 ? (
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
