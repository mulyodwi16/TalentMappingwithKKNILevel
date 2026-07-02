import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import toast from "react-hot-toast";
import api from "../../api/client.js";

const PROGRESS_CONFIG = {
  todo:  { label: "Belum Mulai", cls: "bg-slate-700 text-slate-400",   icon: "○" },
  doing: { label: "Sedang Dikerjakan", cls: "bg-amber-500/20 text-amber-400",   icon: "◑" },
  done:  { label: "Selesai",    cls: "bg-emerald-500/20 text-emerald-400", icon: "●" },
};

const TYPE_ICON = { video: "▶", course: "◉", article: "≡", certification: "★", book: "▣" };

export default function LearningPath() {
  const qc = useQueryClient();
  const { data: recs = [], isLoading } = useQuery({
    queryKey: ["recommendations"],
    queryFn: () => api.get("/user/recommendations"),
  });

  const updateProgress = useMutation({
    mutationFn: ({ id, progress }) => api.put(`/user/recommendations/${id}`, { progress }),
    onSuccess: () => { qc.invalidateQueries(["recommendations"]); toast.success("Progress diperbarui"); },
    onError: (err) => toast.error(err || "Gagal"),
  });

  if (isLoading) return <div className="flex items-center justify-center h-64 text-slate-400">Memuat…</div>;

  if (recs.length === 0) {
    return (
      <div className="max-w-xl mx-auto text-center py-16">
        <div className="text-5xl mb-4">→</div>
        <h2 className="text-xl font-bold text-white mb-2">Belum Ada Learning Path</h2>
        <p className="text-slate-400 text-sm mb-6">Selesaikan ujian agar sistem membuat rekomendasi belajar personal.</p>
        <Link to="/app/exam" className="btn-primary">Mulai Ujian →</Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-white">Learning Path Personal</h2>
        <p className="text-slate-400 text-sm mt-1">Rekomendasi belajar berdasarkan gap kompetensi Anda</p>
      </div>

      {recs.map((rec, i) => {
        const pc = PROGRESS_CONFIG[rec.progress] || PROGRESS_CONFIG.todo;
        return (
          <div key={rec.id} className="card p-6 space-y-4">
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-brand-600 flex items-center justify-center text-sm font-black flex-shrink-0">{i + 1}</div>
                <div>
                  <p className="text-xs text-slate-500 mb-0.5">Learning Path #{i + 1}</p>
                  <p className="text-sm text-slate-300">{rec.reason}</p>
                </div>
              </div>
              <select
                value={rec.progress}
                onChange={(e) => updateProgress.mutate({ id: rec.id, progress: e.target.value })}
                className="text-xs bg-slate-900 border border-slate-700 rounded-lg px-2 py-1.5 text-slate-300 cursor-pointer"
              >
                {Object.entries(PROGRESS_CONFIG).map(([k, v]) => (
                  <option key={k} value={k}>{v.icon} {v.label}</option>
                ))}
              </select>
            </div>

            {/* AI Analysis */}
            {rec.aiAnalysis && (
              <div className="bg-slate-900/60 rounded-xl p-4 border border-slate-700/50">
                <p className="text-xs font-semibold text-brand-400 mb-2">✦ Analisis AI (OpenRouter)</p>
                <p className="text-sm text-slate-300 whitespace-pre-wrap leading-relaxed">{rec.aiAnalysis.slice(0, 500)}{rec.aiAnalysis.length > 500 ? "…" : ""}</p>
              </div>
            )}

            {/* Resources */}
            {rec.resources?.length > 0 && (
              <div>
                <p className="text-xs font-semibold text-slate-500 mb-3">Resource Belajar</p>
                <div className="grid sm:grid-cols-2 gap-3">
                  {rec.resources.map((r) => (
                    <div key={r.id} className="bg-slate-900/50 rounded-xl p-4 border border-slate-700/30 hover:border-slate-600/50 transition-colors">
                      <div className="flex items-center gap-2 mb-2">
                        <span className="text-brand-400 text-sm">{TYPE_ICON[r.type] || "◉"}</span>
                        <span className="text-xs text-slate-500 capitalize">{r.type}</span>
                        {r.duration && <span className="text-xs text-slate-600 ml-auto">{r.duration}</span>}
                      </div>
                      <p className="text-sm font-semibold text-white mb-1">{r.title}</p>
                      {r.provider && <p className="text-xs text-slate-500">{r.provider}</p>}
                      {r.description && <p className="text-xs text-slate-400 mt-1.5 line-clamp-2">{r.description}</p>}
                      {r.url && (
                        <a href={r.url} target="_blank" rel="noopener noreferrer"
                          className="text-xs text-brand-400 hover:text-brand-300 mt-2 inline-block">
                          Buka Link →
                        </a>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
