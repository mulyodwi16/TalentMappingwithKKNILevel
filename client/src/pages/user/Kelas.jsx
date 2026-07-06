import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Link, useSearchParams } from "react-router-dom";
import toast from "react-hot-toast";
import {
  GraduationCap, BookOpen, Lock, CheckCircle2, PlayCircle, RotateCcw, ChevronDown,
  Coins, Sparkles, Star, Lightbulb, Briefcase, Clock, Loader2, X, ArrowLeft, ArrowRight,
  ExternalLink, Youtube, ListChecks, Trophy,
} from "lucide-react";
import api from "../../api/client.js";
import { useCoins } from "../../hooks/useCoins.js";
import { useLang } from "../../lib/i18n.jsx";

const UNLOCK_COST = 60;

const STATE_UI = {
  passed:   { label: "Lulus",      Icon: CheckCircle2, badge: "bg-emerald-500/15 text-emerald-500", accent: "#10b981" },
  ready:    { label: "Siap Ujian", Icon: PlayCircle,   badge: "bg-brand-500/15 text-brand-500",     accent: "rgb(var(--brand-500))" },
  learning: { label: "Belajar",    Icon: BookOpen,     badge: "bg-amber-500/15 text-amber-500",     accent: "#f59e0b" },
  locked:   { label: "Terkunci",   Icon: Lock,         badge: "bg-[var(--bg-muted)] text-[var(--text-4)]", accent: "#64748b" },
};

const AV_LEVEL = {
  beginner:     { label: "Pemula",   cls: "bg-emerald-500/20 text-emerald-400" },
  intermediate: { label: "Menengah", cls: "bg-amber-500/20 text-amber-400" },
  advanced:     { label: "Mahir",    cls: "bg-brand-500/20 text-brand-400" },
};

// ── Modal course AvatarEdu (embed di overlay) ─────────────────────────────────
function CourseModal({ title, url, onClose }) {
  const { t } = useLang();
  useEffect(() => {
    const onKey = (e) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6" style={{ background: "rgba(0,0,0,0.6)" }} onClick={onClose}>
      <div className="w-full max-w-4xl rounded-2xl overflow-hidden flex flex-col shadow-2xl" style={{ background: "var(--bg-surface)", maxHeight: "92vh" }} onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between gap-3 p-3 border-b" style={{ borderColor: "var(--border)" }}>
          <p className="text-sm font-semibold truncate flex items-center gap-2" style={{ color: "var(--text-base)" }}>
            <Sparkles className="w-4 h-4 text-violet-400 shrink-0" /> {title}
          </p>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-[var(--bg-muted)] shrink-0" style={{ color: "var(--text-3)" }} aria-label={t("Tutup")}>
            <X className="w-4 h-4" />
          </button>
        </div>
        <iframe src={url} className="w-full flex-1" style={{ border: 0, minHeight: "60vh" }} allow="fullscreen" title={title} />
      </div>
    </div>
  );
}

// ── Kursus AvatarEdu terkait unit (pelengkap) ─────────────────────────────────
function AvatarEduForUnit({ query }) {
  const { t } = useLang();
  const { setBalance } = useCoins();
  const [modal, setModal] = useState(null);
  const [busy, setBusy] = useState(null);

  const { data, isLoading } = useQuery({
    queryKey: ["kelas-av", query],
    queryFn: () => api.get(`/avataredu/courses?q=${encodeURIComponent(query)}&per_page=6`),
    staleTime: 5 * 60 * 1000, enabled: !!query,
  });
  const courses = data?.data || [];
  const fallback = !!data?.fallback;

  async function follow(c) {
    if (busy) return;
    setBusy(c.slug);
    try {
      const r = await api.post("/coins/course-start", { slug: c.slug });
      if (r.awarded > 0) { toast.success(t("+{n} Koin — selamat belajar!", { n: r.awarded })); if (typeof r.balance === "number") setBalance(r.balance); }
      const d = await api.get(`/avataredu/embed-url/${encodeURIComponent(c.slug)}`);
      setModal({ title: c.title, url: d.url });
    } catch (e) {
      toast.error(typeof e === "string" ? e : t("Gagal membuka kursus"));
    } finally {
      setBusy(null);
    }
  }

  if (isLoading) return <p className="text-xs py-1" style={{ color: "var(--text-4)" }}>{t("Mencari kursus AvatarEdu…")}</p>;
  if (courses.length === 0) return <p className="text-xs py-1" style={{ color: "var(--text-4)" }}>{t("Belum ada kursus AvatarEdu cocok.")}</p>;

  return (
    <div className="space-y-2">
      {fallback && (
        <p className="text-[11px]" style={{ color: "var(--text-4)" }}>
          {t("Belum ada kursus AvatarEdu khusus untuk unit ini — menampilkan kursus umum yang tersedia.")}
        </p>
      )}
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {courses.map((c) => {
          const lv = AV_LEVEL[c.level] || AV_LEVEL.beginner;
          return (
            <div key={c.slug} className="card overflow-hidden flex flex-col">
              {c.thumbnail_url && <img src={c.thumbnail_url} alt={c.title} className="w-full h-28 object-cover" loading="lazy" />}
              <div className="p-3 flex flex-col flex-1 gap-1.5">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${lv.cls}`}>{t(lv.label)}</span>
                  {c.category && <span className="text-[10px]" style={{ color: "var(--text-4)" }}>{c.category.name}</span>}
                </div>
                <p className="text-xs font-semibold line-clamp-2" style={{ color: "var(--text-base)" }}>{c.title}</p>
                <div className="flex items-center gap-2 text-[11px]" style={{ color: "var(--text-4)" }}>
                  {c.average_rating > 0 && <span className="flex items-center gap-0.5 text-amber-400"><Star className="w-2.5 h-2.5 fill-amber-400" />{c.average_rating.toFixed(1)}</span>}
                  {c.duration_hours ? <span>{t("{n} jam", { n: c.duration_hours })}</span> : null}
                  {c.total_lessons ? <span>{t("{n} materi", { n: c.total_lessons })}</span> : null}
                </div>
                <p className="text-xs font-bold text-brand-500 mt-auto">{c.formatted_price || t("Gratis")}</p>
                <button onClick={() => follow(c)} disabled={busy === c.slug}
                  className="btn-primary text-xs py-1.5 w-full flex items-center justify-center gap-1.5">
                  {busy === c.slug ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <PlayCircle className="w-3.5 h-3.5" />}
                  {t("Ikuti Kelas")}
                </button>
              </div>
            </div>
          );
        })}
      </div>
      {modal && <CourseModal title={modal.title} url={modal.url} onClose={() => setModal(null)} />}
    </div>
  );
}

function AvatarEduSection({ title, defaultOpen = false }) {
  const { t } = useLang();
  const [open, setOpen] = useState(defaultOpen);
  const query = (title || "").split(/\s+/).slice(0, 3).join(" ");
  return (
    <div>
      <button onClick={() => setOpen((o) => !o)}
        className="text-xs font-semibold flex items-center gap-1.5 hover:opacity-80" style={{ color: "var(--text-3)" }}>
        <Sparkles className="w-3.5 h-3.5 text-violet-400" /> {t("Kursus AvatarEdu terkait")}
        <ChevronDown className={`w-3.5 h-3.5 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      {open && <div className="mt-2"><AvatarEduForUnit query={query} /></div>}
    </div>
  );
}

// ── Kartu unit (grid ala AvatarEdu: kotak-kotak, banner berwarna status) ──────
function UnitCard({ unit, balance, busy, onOpen, onUnlock }) {
  const { t } = useLang();
  const ui = STATE_UI[unit.state] || STATE_UI.locked;
  const locked = unit.state === "locked";
  const canExam = unit.state === "ready" || unit.state === "passed";
  return (
    <div className="card overflow-hidden flex flex-col group">
      {/* Banner dekoratif berwarna status */}
      <div className="relative h-24 flex items-center justify-center overflow-hidden"
        style={{ background: `linear-gradient(135deg, ${ui.accent}33, ${ui.accent}0d 60%, transparent)` }}>
        <div className="absolute inset-0 opacity-[0.07]" aria-hidden
          style={{ backgroundImage: `radial-gradient(circle at 20% 30%, ${ui.accent} 1.5px, transparent 1.5px), radial-gradient(circle at 70% 60%, ${ui.accent} 1.5px, transparent 1.5px)`, backgroundSize: "34px 34px, 46px 46px" }} />
        <div className="w-14 h-14 rounded-2xl grid place-items-center text-xl font-black shadow-lg transition-transform group-hover:scale-110"
          style={unit.state === "passed"
            ? { background: "#10b981", color: "#fff" }
            : { background: "var(--bg-surface)", color: ui.accent, border: `2px solid ${ui.accent}55` }}>
          {unit.state === "passed" ? "✓" : locked ? <Lock className="w-6 h-6" /> : unit.order}
        </div>
        <span className={`absolute top-2.5 right-2.5 text-[10px] font-semibold px-2 py-0.5 rounded-full ${ui.badge}`}>{t(ui.label)}</span>
      </div>

      <div className="p-4 flex flex-col flex-1 gap-2">
        <p className="text-sm font-semibold leading-snug line-clamp-3 min-h-[3.4em]" style={{ color: "var(--text-base)" }} title={unit.title}>
          {unit.title}
        </p>
        <div className="flex items-center gap-2 text-[11px] flex-wrap" style={{ color: "var(--text-4)" }}>
          <span className="font-mono px-1.5 py-0.5 rounded" style={{ background: "var(--bg-muted)" }}>{unit.code}</span>
          {unit.score != null && <span className={unit.score >= 60 ? "text-emerald-500" : "text-amber-500"}>{t("skor {n}%", { n: unit.score })}</span>}
        </div>

        <div className="mt-auto pt-2 space-y-1.5">
          {locked ? (
            <>
              <button onClick={() => onUnlock(unit.code)} disabled={busy || balance < UNLOCK_COST}
                className="btn-primary text-xs py-2 w-full flex items-center justify-center gap-1.5 disabled:opacity-50">
                <Coins className="w-3.5 h-3.5" /> {t("Buka dengan {n} Koin", { n: UNLOCK_COST })}
              </button>
              <p className="text-[10px] text-center" style={{ color: "var(--text-4)" }}>
                {balance < UNLOCK_COST ? t("Koin kurang (saldo {n})", { n: balance }) : t("atau selesaikan unit sebelumnya")}
              </p>
            </>
          ) : (
            <>
              <button onClick={() => onOpen(unit.code)}
                className="btn-primary text-xs py-2 w-full flex items-center justify-center gap-1.5">
                <BookOpen className="w-3.5 h-3.5" /> {unit.state === "passed" ? t("Buka Materi") : t("Ikuti Kelas")}
              </button>
              {canExam && (
                <Link to={`/app/exam?unit=${encodeURIComponent(unit.code)}`}
                  className="btn-outline text-xs py-1.5 w-full flex items-center justify-center gap-1.5">
                  {unit.state === "passed" ? <><RotateCcw className="w-3 h-3" /> {t("Ujian Ulang")}</> : <><PlayCircle className="w-3 h-3" /> {t("Mulai Ujian")}</>}
                </Link>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// ── COURSE PLAYER: belajar bertahap ala ujian (1 pelajaran per layar) ─────────
function CoursePlayer({ code, onBack, onComplete, busyComplete }) {
  const { t } = useLang();
  const [step, setStep] = useState(0);

  const { data: meta } = useQuery({
    queryKey: ["kelas-course", code],
    queryFn: () => api.get(`/kelas/unit/${encodeURIComponent(code)}`, { timeout: 90_000 }),
    staleTime: 10 * 60 * 1000,
  });
  const { data, isLoading, isError, error } = useQuery({
    queryKey: ["kelas-lessons", code],
    queryFn: () => api.get(`/kelas/unit/${encodeURIComponent(code)}/lessons`, { timeout: 180_000 }),
    staleTime: 30 * 60 * 1000,
    retry: 1,
  });

  const unit = data?.unit || meta?.unit;
  const state = data?.state || meta?.state;
  const lessons = data?.lessons || [];
  const total = lessons.length + 1; // + langkah penutup
  const isFinal = step >= lessons.length;
  const lesson = !isFinal ? lessons[step] : null;

  useEffect(() => { window.scrollTo({ top: 0, behavior: "smooth" }); }, [step]);

  if (isLoading) {
    return (
      <div className="max-w-2xl mx-auto card p-10 text-center space-y-3">
        <Loader2 className="w-8 h-8 animate-spin text-brand-500 mx-auto" />
        <p className="font-semibold" style={{ color: "var(--text-base)" }}>{t("Menyusun materi lengkap…")}</p>
        <p className="text-xs" style={{ color: "var(--text-4)" }}>
          {t("Saat pertama kali dibuka, AI menyusun 4-6 pelajaran mendalam untuk unit ini (± 30-60 detik). Setelah itu materi tersimpan permanen dan langsung terbuka.")}
        </p>
      </div>
    );
  }
  if (isError) {
    return (
      <div className="max-w-2xl mx-auto card p-8 text-center space-y-3">
        <p className="text-sm text-red-400">{typeof error === "string" ? error : t("Gagal memuat pelajaran.")}</p>
        <button onClick={onBack} className="btn-outline text-sm">← {t("Kembali ke daftar kelas")}</button>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto space-y-4">
      <button onClick={onBack} className="text-xs flex items-center gap-1 hover:underline" style={{ color: "var(--text-4)" }}>
        <ArrowLeft className="w-3.5 h-3.5" /> {t("Kembali ke daftar kelas")}
      </button>

      {/* Header progres ala ujian */}
      <div className="card p-4">
        <div className="flex items-center justify-between gap-3 mb-2">
          <p className="text-sm font-semibold truncate" style={{ color: "var(--text-base)" }}>{unit?.title}</p>
          <span className="text-xs shrink-0 font-semibold" style={{ color: "var(--text-3)" }}>
            {isFinal ? t("Penutup") : t("Materi {a}/{b}", { a: step + 1, b: lessons.length })}
          </span>
        </div>
        <div className="h-2 rounded-full overflow-hidden" style={{ background: "var(--bg-muted)" }}>
          <div className="h-full bg-brand-600 rounded-full transition-all duration-500" style={{ width: `${((step + 1) / total) * 100}%` }} />
        </div>
      </div>

      {/* Konten pelajaran */}
      {!isFinal ? (
        <div className="card p-6 space-y-4">
          <div>
            <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-brand-500/15 text-brand-500">{t("Pelajaran {n}", { n: step + 1 })}</span>
            <h2 className="text-lg font-bold mt-2" style={{ color: "var(--text-base)" }}>{lesson.title}</h2>
          </div>

          {/* Materi mendalam (paragraf) */}
          <div className="space-y-3">
            {String(lesson.body || "").split(/\n{2,}/).filter(Boolean).map((p, i) => (
              <p key={i} className="text-sm leading-relaxed" style={{ color: "var(--text-2)" }}>{p}</p>
            ))}
          </div>

          {lesson.points?.length > 0 && (
            <div className="rounded-xl p-3.5" style={{ background: "var(--bg-raised)", border: "1px solid var(--border)" }}>
              <p className="text-xs font-semibold flex items-center gap-1 mb-2" style={{ color: "var(--text-3)" }}>
                <Lightbulb className="w-3.5 h-3.5 text-amber-500" /> {t("Poin Penting")}
              </p>
              <ul className="space-y-1">
                {lesson.points.map((k, i) => (
                  <li key={i} className="text-sm flex gap-2" style={{ color: "var(--text-2)" }}><span className="text-brand-500">•</span>{k}</li>
                ))}
              </ul>
            </div>
          )}

          {lesson.example && (
            <div className="rounded-lg px-3.5 py-3 border-l-2 border-amber-500" style={{ background: "var(--bg-raised)" }}>
              <p className="text-xs font-semibold flex items-center gap-1 mb-1 text-amber-500"><Briefcase className="w-3.5 h-3.5" /> {t("Contoh Penerapan Nyata")}</p>
              <p className="text-sm" style={{ color: "var(--text-2)" }}>{lesson.example}</p>
            </div>
          )}

          {/* Video pembelajaran ter-embed (di-resolve via YouTube Data API, cached) */}
          {lesson.ytVideoId && (
            <div>
              <p className="text-xs font-semibold flex items-center gap-1.5 mb-2" style={{ color: "var(--text-3)" }}>
                <Youtube className="w-3.5 h-3.5 text-red-500" /> {t("Video Pembelajaran")}
              </p>
              <div className="rounded-xl overflow-hidden shadow-lg" style={{ aspectRatio: "16/9", background: "#000" }}>
                <iframe
                  width="100%" height="100%" style={{ border: 0, display: "block" }}
                  src={`https://www.youtube-nocookie.com/embed/${lesson.ytVideoId}`}
                  title={lesson.ytTitle || t("Video Pembelajaran")}
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen loading="lazy" />
              </div>
              {(lesson.ytTitle || lesson.ytChannel) && (
                <p className="text-[11px] mt-1.5" style={{ color: "var(--text-4)" }}>
                  {lesson.ytTitle}{lesson.ytChannel ? <> · <b>{lesson.ytChannel}</b></> : null} · via YouTube
                </p>
              )}
            </div>
          )}

          {/* Sumber tepercaya + cari video lain */}
          {(lesson.sources?.length > 0 || lesson.ytQuery) && (
            <div className="flex items-center gap-2 flex-wrap pt-1">
              <span className="text-[11px] font-semibold" style={{ color: "var(--text-4)" }}>{t("Pelajari lebih lanjut:")}</span>
              {(lesson.sources || []).map((s, i) => (
                <a key={i} href={s.url} target="_blank" rel="noopener noreferrer"
                  className="text-[11px] inline-flex items-center gap-1 px-2 py-1 rounded-lg hover:border-brand-500/50 transition-colors"
                  style={{ border: "1px solid var(--border)", color: "var(--text-3)" }}>
                  <ExternalLink className="w-3 h-3 text-brand-500" /> {s.label}
                </a>
              ))}
              {lesson.ytQuery && (
                <a href={`https://www.youtube.com/results?search_query=${encodeURIComponent(lesson.ytQuery)}`}
                  target="_blank" rel="noopener noreferrer"
                  className={`text-[11px] inline-flex items-center gap-1 px-2 py-1 rounded-lg transition-colors ${lesson.ytVideoId ? "hover:border-red-400/60" : "text-white bg-red-600 hover:bg-red-700"}`}
                  style={lesson.ytVideoId ? { border: "1px solid var(--border)", color: "var(--text-3)" } : undefined}>
                  <Youtube className="w-3.5 h-3.5 text-red-500" /> {lesson.ytVideoId ? t("Cari video lain") : t("Video terkait")}
                </a>
              )}
            </div>
          )}
        </div>
      ) : (
        /* ── Langkah penutup ── */
        <div className="card p-6 space-y-4">
          <div className="text-center">
            <div className="w-14 h-14 rounded-2xl bg-emerald-500/15 grid place-items-center mx-auto mb-3">
              <Trophy className="w-7 h-7 text-emerald-500" />
            </div>
            <h2 className="text-lg font-bold" style={{ color: "var(--text-base)" }}>{t("Materi Selesai Dipelajari 🎓")}</h2>
            <p className="text-sm mt-1" style={{ color: "var(--text-3)" }}>
              {t("Kamu telah menyelesaikan {n} pelajaran unit", { n: lessons.length })} <b>{unit?.title}</b>.
            </p>
          </div>

          {/* Ringkasan takeaway */}
          <div className="rounded-xl p-3.5" style={{ background: "var(--bg-raised)", border: "1px solid var(--border)" }}>
            <p className="text-xs font-semibold flex items-center gap-1 mb-2" style={{ color: "var(--text-3)" }}>
              <ListChecks className="w-3.5 h-3.5 text-emerald-500" /> {t("Rangkuman Pelajaran")}
            </p>
            <ol className="space-y-1">
              {lessons.map((l, i) => (
                <li key={i} className="text-sm flex gap-2" style={{ color: "var(--text-2)" }}>
                  <span className="w-4 h-4 rounded-full bg-emerald-500/15 text-emerald-500 text-[10px] grid place-items-center shrink-0 mt-0.5 font-bold">{i + 1}</span>
                  {l.title}
                </li>
              ))}
            </ol>
          </div>

          <div className="flex flex-wrap gap-2 items-center justify-center">
            {state?.state === "learning" && (
              <button onClick={() => onComplete(code)} disabled={busyComplete}
                className="btn-primary text-sm inline-flex items-center gap-1.5 disabled:opacity-50">
                {busyComplete ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                {t("Tandai Selesai Belajar (+15 Koin)")}
              </button>
            )}
            {(state?.state === "ready" || state?.state === "passed") && (
              <Link to={`/app/exam?unit=${encodeURIComponent(code)}`} className="btn-primary text-sm inline-flex items-center gap-1.5">
                {state?.state === "passed" ? <><RotateCcw className="w-4 h-4" /> {t("Ujian Ulang")}</> : <><PlayCircle className="w-4 h-4" /> {t("Mulai Ujian Unit")}</>}
              </Link>
            )}
            {state?.state === "learning" && <span className="text-[11px] w-full text-center" style={{ color: "var(--text-4)" }}>{t("Ujian terbuka setelah kelas ditandai selesai.")}</span>}
            {state?.state === "passed" && <span className="text-[11px] text-emerald-500 w-full text-center">{t("Sertifikat unit sudah terbit ✓")}</span>}
          </div>

          <AvatarEduSection title={unit?.title} defaultOpen={false} />
        </div>
      )}

      {/* Navigasi ala ujian */}
      <div className="flex gap-3">
        <button onClick={() => setStep((s) => Math.max(0, s - 1))} disabled={step === 0}
          className="btn-outline flex-1 flex items-center justify-center gap-1 disabled:opacity-40">
          <ArrowLeft className="w-4 h-4" /> {t("Sebelumnya")}
        </button>
        {!isFinal && (
          <button onClick={() => setStep((s) => Math.min(total - 1, s + 1))}
            className="btn-primary flex-1 flex items-center justify-center gap-1">
            {t("Berikutnya")} <ArrowRight className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Titik langkah */}
      <div className="flex items-center justify-center gap-1.5 flex-wrap">
        {Array.from({ length: total }).map((_, i) => (
          <button key={i} onClick={() => setStep(i)}
            className="rounded-full transition-all"
            style={{
              width: i === step ? 22 : 8, height: 8,
              background: i === step ? "rgb(var(--brand-600))" : i < step ? "rgb(var(--brand-600) / 0.5)" : "var(--border-2)",
            }}
            aria-label={i === total - 1 ? t("Penutup") : t("Materi {n}", { n: i + 1 })} />
        ))}
      </div>
    </div>
  );
}

// ── Halaman Kelas ─────────────────────────────────────────────────────────────
export default function Kelas() {
  const { t } = useLang();
  const qc = useQueryClient();
  const { setBalance } = useCoins();
  const [busy, setBusy] = useState(false);
  const [sp, setSp] = useSearchParams();
  const unitParam = sp.get("unit");

  const { data, isLoading } = useQuery({ queryKey: ["kelas-units"], queryFn: () => api.get("/kelas/units") });
  const chosen = data?.chosen;
  const units = data?.units || [];
  const s = data?.summary;
  const balance = data?.balance ?? 0;

  const refresh = (payload) => {
    if (payload?.units) qc.setQueryData(["kelas-units"], (old) => ({ ...old, units: payload.units, summary: payload.summary }));
    if (typeof payload?.balance === "number") { setBalance(payload.balance); qc.setQueryData(["kelas-units"], (old) => ({ ...old, balance: payload.balance })); }
    qc.invalidateQueries(["coins"]);
    if (unitParam) qc.invalidateQueries(["kelas-course", unitParam]);
  };

  const complete = useMutation({
    mutationFn: (code) => api.post(`/kelas/unit/${encodeURIComponent(code)}/complete`),
    onMutate: () => setBusy(true),
    onSuccess: (r) => { refresh(r); if (r.coin?.awarded > 0) { toast.success(t("+{n} Koin — ujian unit terbuka!", { n: r.coin.awarded })); } else toast.success(t("Kelas selesai — ujian terbuka!")); },
    onError: (e) => toast.error(typeof e === "string" ? e : t("Gagal")),
    onSettled: () => setBusy(false),
  });

  const unlock = useMutation({
    mutationFn: (code) => api.post(`/kelas/unit/${encodeURIComponent(code)}/unlock`),
    onMutate: () => setBusy(true),
    onSuccess: (r) => { refresh(r); if (!r.already) toast.success(t("Unit terbuka! −{n} Koin", { n: r.spent })); },
    onError: (e) => toast.error(typeof e === "string" ? e : t("Gagal membuka unit")),
    onSettled: () => setBusy(false),
  });

  if (isLoading) return <div className="flex items-center justify-center h-64" style={{ color: "var(--text-4)" }}>{t("Memuat kelas…")}</div>;

  if (!chosen) {
    return (
      <div className="max-w-lg mx-auto card p-10 text-center">
        <GraduationCap className="w-10 h-10 mx-auto mb-3 text-brand-500" />
        <h2 className="font-bold mb-1" style={{ color: "var(--text-base)" }}>{t("Belum Ada Kelas")}</h2>
        <p className="text-sm mb-5" style={{ color: "var(--text-3)" }}>{t("Pilih kompetensi SKKNI dulu agar kami susun kelas per unit kompetensinya.")}</p>
        <Link to="/app/profile" className="btn-primary">{t("Pilih Kompetensi →")}</Link>
      </div>
    );
  }

  // ── Mode player: ?unit=CODE ──
  if (unitParam) {
    return (
      <CoursePlayer
        code={unitParam}
        onBack={() => setSp({})}
        onComplete={(c) => complete.mutate(c)}
        busyComplete={busy}
      />
    );
  }

  // ── Mode grid (ala AvatarEdu) ──
  return (
    <div className="space-y-5">
      <div className="rounded-2xl bg-gradient-to-br from-brand-600 via-brand-600/90 to-tosca-500 text-white p-6 shadow-lg">
        <div className="flex items-center gap-2 mb-1"><GraduationCap className="w-5 h-5" /><h1 className="text-xl font-bold text-white">{t("Kelas Kompetensi")}</h1></div>
        <p className="text-sm text-white/80 max-w-2xl">
          {t("Belajar per unit dari")} <b>{chosen.title}</b> — {t("klik")} <b>{t("Ikuti Kelas")}</b> {t("untuk masuk course bertahap (materi mendalam + sumber tepercaya + video). Selesaikan kelas untuk membuka ujian unit; lulus menerbitkan sertifikat.")}
        </p>
        {s && (
          <div className="flex gap-2 mt-3 flex-wrap text-xs">
            <span className="px-2 py-1 rounded-full bg-white/15">{t("{a}/{b} lulus", { a: s.passed, b: s.total })}</span>
            <span className="px-2 py-1 rounded-full bg-white/15">{t("{n} siap ujian", { n: s.ready })}</span>
            <span className="px-2 py-1 rounded-full bg-white/15">{t("{n} sedang belajar", { n: s.learning })}</span>
            <span className="px-2 py-1 rounded-full bg-white/15 flex items-center gap-1"><Coins className="w-3 h-3" /> {balance}</span>
          </div>
        )}
      </div>

      {/* Grid kartu unit ala AvatarEdu */}
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 items-start">
        {units.map((u) => (
          <UnitCard key={u.code} unit={u} balance={balance} busy={busy}
            onOpen={(code) => setSp({ unit: code })}
            onUnlock={(code) => unlock.mutate(code)} />
        ))}
      </div>

      <p className="text-xs text-center" style={{ color: "var(--text-4)" }}>
        {t("Materi disusun AI selaras SKKNI (disusun sekali, lalu tersimpan permanen) + rujukan sumber tepercaya & video.")}
        {" "}{t("Kursus interaktif oleh")} <a href="https://avataredu.ai" target="_blank" rel="noopener noreferrer" className="text-brand-500 hover:underline">AvatarEdu.ai</a>.
        {" "}{t("Sertifikat hanya terbit dari")} <b>{t("lulus ujian")}</b> — {t("Koin hanya mempercepat akses.")}
      </p>
    </div>
  );
}
