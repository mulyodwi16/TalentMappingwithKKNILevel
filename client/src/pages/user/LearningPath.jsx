import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import toast from "react-hot-toast";
import api from "../../api/client.js";

const PROGRESS_CONFIG = {
  todo:  { label: "Belum Mulai",       cls: "bg-slate-700 text-slate-400",         icon: "○" },
  doing: { label: "Sedang Dikerjakan", cls: "bg-amber-500/20 text-amber-400",      icon: "◑" },
  done:  { label: "Selesai",           cls: "bg-emerald-500/20 text-emerald-400",  icon: "●" },
};

const TYPE_ICON = { video: "▶", course: "◉", article: "≡", certification: "★", book: "▣" };

const LEVEL_BADGE = {
  beginner:     { label: "Pemula",      cls: "bg-emerald-500/20 text-emerald-400" },
  intermediate: { label: "Menengah",   cls: "bg-amber-500/20 text-amber-400" },
  advanced:     { label: "Mahir",      cls: "bg-brand-500/20 text-brand-400" },
};

function StarRating({ rating }) {
  return (
    <span className="text-amber-400 text-xs">
      {"★".repeat(Math.round(rating))}{"☆".repeat(5 - Math.round(rating))}
      <span className="text-slate-500 ml-1">{rating?.toFixed(1)}</span>
    </span>
  );
}

function AvatarEduCourses({ gapQuery }) {
  const [preview, setPreview] = useState(null);   // slug being previewed
  const [embedUrls, setEmbedUrls] = useState({}); // { slug: url }
  const [loadingEmbed, setLoadingEmbed] = useState(null);

  const { data, isLoading, isError } = useQuery({
    queryKey: ["avataredu-courses", gapQuery],
    queryFn: () => api.get(`/avataredu/courses?q=${encodeURIComponent(gapQuery)}&per_page=6`),
    staleTime: 5 * 60 * 1000,
    enabled: !!gapQuery,
  });

  const handlePreview = async (slug) => {
    if (preview === slug) { setPreview(null); return; }
    if (!embedUrls[slug]) {
      setLoadingEmbed(slug);
      try {
        const d = await api.get(`/avataredu/embed-url/${encodeURIComponent(slug)}`);
        setEmbedUrls((prev) => ({ ...prev, [slug]: d.url }));
      } catch {
        toast.error("Gagal memuat preview");
        setLoadingEmbed(null);
        return;
      }
      setLoadingEmbed(null);
    }
    setPreview(slug);
  };

  const courses = data?.data || [];

  if (isLoading) return <div className="text-center py-8 text-sm" style={{ color: "var(--text-4)" }}>Mencari kursus terkait…</div>;
  if (isError || courses.length === 0) return <div className="text-center py-6 text-sm" style={{ color: "var(--text-4)" }}>Tidak ada kursus ditemukan.</div>;

  return (
    <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
      {courses.map((c) => {
        const lv = LEVEL_BADGE[c.level] || LEVEL_BADGE.beginner;
        const isOpen = preview === c.slug;
        return (
          <div key={c.slug} className="card overflow-hidden flex flex-col">
            {c.thumbnail_url && (
              <img src={c.thumbnail_url} alt={c.title} className="w-full h-36 object-cover" loading="lazy" />
            )}
            <div className="p-4 flex flex-col flex-1 gap-2">
              <div className="flex items-center gap-2 flex-wrap">
                <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${lv.cls}`}>{lv.label}</span>
                {c.category && <span className="text-xs" style={{ color: "var(--text-4)" }}>{c.category.name}</span>}
              </div>
              <p className="text-sm font-semibold line-clamp-2" style={{ color: "var(--text-base)" }}>{c.title}</p>
              {c.creator && <p className="text-xs" style={{ color: "var(--text-4)" }}>{c.creator.name}</p>}
              <div className="flex items-center gap-3 text-xs" style={{ color: "var(--text-4)" }}>
                {c.average_rating > 0 && <StarRating rating={c.average_rating} />}
                {c.duration_hours && <span>{c.duration_hours} jam</span>}
                {c.total_lessons && <span>{c.total_lessons} pelajaran</span>}
              </div>
              <p className="text-sm font-bold text-brand-600 mt-auto">{c.formatted_price || "Gratis"}</p>
              <button
                onClick={() => handlePreview(c.slug)}
                disabled={loadingEmbed === c.slug}
                className="btn-outline text-xs py-1.5 w-full text-center"
              >
                {loadingEmbed === c.slug ? "Memuat…" : isOpen ? "Tutup Preview ✕" : "Preview Kursus →"}
              </button>
            </div>

            {isOpen && embedUrls[c.slug] && (
              <div className="border-t" style={{ borderColor: "var(--border)" }}>
                <iframe
                  src={embedUrls[c.slug]}
                  width="100%"
                  height="500"
                  style={{ border: 0 }}
                  allow="fullscreen"
                  title={c.title}
                />
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

export default function LearningPath() {
  const qc = useQueryClient();
  const { data: recs = [], isLoading } = useQuery({
    queryKey: ["recommendations"],
    queryFn: () => api.get("/user/recommendations"),
  });
  const { data: assessments = [] } = useQuery({
    queryKey: ["assessments"],
    queryFn: () => api.get("/user/skill-assessments"),
  });

  const updateProgress = useMutation({
    mutationFn: ({ id, progress }) => api.put(`/user/recommendations/${id}`, { progress }),
    onSuccess: () => { qc.invalidateQueries(["recommendations"]); toast.success("Progress diperbarui"); },
    onError: (err) => toast.error(err || "Gagal"),
  });

  // build search query from top gaps
  const topGaps = assessments.filter((a) => a.gap > 0).sort((a, b) => b.gap - a.gap).slice(0, 3);
  const gapQuery = topGaps.map((g) => g.competencyName).join(" ");

  if (isLoading) return <div className="flex items-center justify-center h-64 text-slate-400">Memuat…</div>;

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-xl font-bold" style={{ color: "var(--text-base)" }}>Learning Path Personal</h2>
        <p className="text-sm mt-1" style={{ color: "var(--text-3)" }}>Rekomendasi belajar berdasarkan gap kompetensi Anda</p>
      </div>

      {/* ── Internal recommendations ─────────────────────────────────────── */}
      {recs.length === 0 ? (
        <div className="card p-10 text-center">
          <div className="text-4xl mb-3">→</div>
          <h3 className="font-bold mb-1" style={{ color: "var(--text-base)" }}>Belum Ada Rekomendasi Internal</h3>
          <p className="text-sm mb-5" style={{ color: "var(--text-3)" }}>Selesaikan ujian agar sistem membuat rekomendasi personal.</p>
          <Link to="/app/exam" className="btn-primary">Mulai Ujian →</Link>
        </div>
      ) : (
        <div className="space-y-4">
          {recs.map((rec, i) => {
            const pc = PROGRESS_CONFIG[rec.progress] || PROGRESS_CONFIG.todo;
            return (
              <div key={rec.id} className="card p-6 space-y-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-brand-600 flex items-center justify-center text-sm font-black text-white flex-shrink-0">{i + 1}</div>
                    <div>
                      <p className="text-xs mb-0.5" style={{ color: "var(--text-4)" }}>Learning Path #{i + 1}</p>
                      <p className="text-sm" style={{ color: "var(--text-2)" }}>{rec.reason}</p>
                    </div>
                  </div>
                  <select
                    value={rec.progress}
                    onChange={(e) => updateProgress.mutate({ id: rec.id, progress: e.target.value })}
                    className="input text-xs py-1.5 w-auto"
                  >
                    {Object.entries(PROGRESS_CONFIG).map(([k, v]) => (
                      <option key={k} value={k}>{v.icon} {v.label}</option>
                    ))}
                  </select>
                </div>

                {rec.aiAnalysis && (
                  <div className="rounded-xl p-4 border" style={{ background: "var(--bg-raised)", borderColor: "var(--border)" }}>
                    <p className="text-xs font-semibold text-brand-600 mb-2">✦ Analisis AI</p>
                    <p className="text-sm whitespace-pre-wrap leading-relaxed" style={{ color: "var(--text-2)" }}>
                      {rec.aiAnalysis.slice(0, 500)}{rec.aiAnalysis.length > 500 ? "…" : ""}
                    </p>
                  </div>
                )}

                {rec.resources?.length > 0 && (
                  <div>
                    <p className="text-xs font-semibold mb-3" style={{ color: "var(--text-4)" }}>Resource Belajar</p>
                    <div className="grid sm:grid-cols-2 gap-3">
                      {rec.resources.map((r) => (
                        <div key={r.id} className="rounded-xl p-4 border transition-colors"
                          style={{ background: "var(--bg-raised)", borderColor: "var(--border)" }}>
                          <div className="flex items-center gap-2 mb-2">
                            <span className="text-brand-600 text-sm">{TYPE_ICON[r.type] || "◉"}</span>
                            <span className="text-xs capitalize" style={{ color: "var(--text-4)" }}>{r.type}</span>
                            {r.duration && <span className="text-xs ml-auto" style={{ color: "var(--text-4)" }}>{r.duration}</span>}
                          </div>
                          <p className="text-sm font-semibold mb-1" style={{ color: "var(--text-base)" }}>{r.title}</p>
                          {r.provider && <p className="text-xs" style={{ color: "var(--text-4)" }}>{r.provider}</p>}
                          {r.description && <p className="text-xs mt-1.5 line-clamp-2" style={{ color: "var(--text-3)" }}>{r.description}</p>}
                          {r.url && (
                            <a href={r.url} target="_blank" rel="noopener noreferrer"
                              className="text-xs text-brand-600 hover:text-brand-700 mt-2 inline-block">
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
      )}

      {/* ── AvatarEdu courses ─────────────────────────────────────────────── */}
      <div className="card p-6">
        <div className="flex items-center gap-3 mb-1">
          <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center text-white text-xs font-black">A</div>
          <h3 className="font-bold" style={{ color: "var(--text-base)" }}>Kursus di AvatarEdu</h3>
        </div>
        <p className="text-xs mb-5" style={{ color: "var(--text-4)" }}>
          {gapQuery ? `Hasil pencarian untuk gap: "${gapQuery.slice(0, 60)}${gapQuery.length > 60 ? "…" : ""}"` : "Kursus tersedia dari AvatarEdu.ai"}
        </p>
        <AvatarEduCourses gapQuery={gapQuery || "kompetensi kerja"} />
        <p className="text-xs mt-5" style={{ color: "var(--text-4)" }}>
          Powered by{" "}
          <a href="https://avataredu.ai" target="_blank" rel="noopener noreferrer" className="text-brand-600 hover:underline">
            AvatarEdu.ai
          </a>
          {" "}— klik Preview untuk lihat kurikulum, Daftar untuk akses penuh.
        </p>
      </div>
    </div>
  );
}
