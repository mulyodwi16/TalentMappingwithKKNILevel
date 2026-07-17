import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import toast from "react-hot-toast";
import { FileText, PenLine, Target, Route, Trophy, Award, Crosshair, Sparkles, GraduationCap, PlayCircle, Loader2, Star, X } from "lucide-react";
import api from "../../api/client.js";
import { useCoins } from "../../hooks/useCoins.js";
import useAuthStore from "../../store/authStore.js";
import DailyLoginCard from "../../components/DailyLoginCard.jsx";
import DailyMissions from "../../components/DailyMissions.jsx";
import DailyQuiz from "../../components/DailyQuiz.jsx";
import RankHero from "../../components/RankHero.jsx";
import RankUpOverlay from "../../components/RankUpOverlay.jsx";
import { rankName } from "../../lib/rank.js";
import { useLang, dateLocale } from "../../lib/i18n.jsx";

const STATUS_CONFIG = {
  ready:       { label: "Siap Naik",    cls: "badge-ready" },
  in_progress: { label: "Dalam Proses", cls: "badge-in-progress" },
  not_ready:   { label: "Belum Siap",   cls: "badge-not-ready" },
};

const LAST_RANK_KEY = (id) => `talenta:lastRank:${id}`;

const AV_LEVEL = {
  beginner:     { label: "Pemula",   cls: "bg-emerald-500/20 text-emerald-400" },
  intermediate: { label: "Menengah", cls: "bg-amber-500/20 text-amber-400" },
  advanced:     { label: "Mahir",    cls: "bg-violet-500/20 text-violet-400" },
};

// SCORM course dibuka dalam iframe modal; embed URL diinject key server-side.
function CourseModal({ title, url, onClose }) {
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
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-[var(--bg-muted)] shrink-0" style={{ color: "var(--text-3)" }} aria-label="Tutup">
            <X className="w-4 h-4" />
          </button>
        </div>
        <iframe src={url} className="w-full flex-1" style={{ border: 0, minHeight: "60vh" }} allow="fullscreen" title={title} />
      </div>
    </div>
  );
}

// Kursus interaktif AvatarEdu.ai (kurasi admin via /featured) — dibuka langsung dari dashboard.
function AvatarEduDashboard() {
  const { t } = useLang();
  const { setBalance } = useCoins();
  const [modal, setModal] = useState(null);
  const [busy, setBusy] = useState(null);

  const { data, isLoading } = useQuery({
    queryKey: ["dash-av-featured"],
    queryFn: () => api.get("/avataredu/featured"),
    staleTime: 5 * 60 * 1000,
  });
  const courses = data?.data || [];

  async function follow(c) {
    if (busy) return;
    setBusy(c.slug);
    try {
      const r = await api.post("/coins/course-start", { slug: c.slug }).catch(() => ({}));
      if (r?.awarded > 0) { toast.success(t("+{n} Koin — selamat belajar!", { n: r.awarded })); if (typeof r.balance === "number") setBalance(r.balance); }
      const d = await api.get(`/avataredu/embed-url/${encodeURIComponent(c.slug)}`);
      setModal({ title: c.title, url: d.url });
    } catch (e) {
      toast.error(typeof e === "string" ? e : t("Gagal membuka kursus"));
    } finally {
      setBusy(null);
    }
  }

  if (isLoading || courses.length === 0) return null;

  return (
    <div className="card p-6">
      <h3 className="font-semibold mb-4 flex items-center gap-2" style={{ color: "var(--text-base)" }}>
        <GraduationCap className="w-4 h-4 text-violet-400" /> {t("Kursus Interaktif AvatarEdu")}
      </h3>
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
        {courses.map((c) => {
          const lv = AV_LEVEL[c.level] || AV_LEVEL.beginner;
          return (
            <div key={c.slug} className="rounded-xl border overflow-hidden flex flex-col" style={{ background: "var(--bg-raised)", borderColor: "var(--border)" }}>
              {c.thumbnail_url && <img src={c.thumbnail_url} alt={c.title} className="w-full h-28 object-cover" loading="lazy" />}
              <div className="p-3 flex flex-col flex-1 gap-1.5">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${lv.cls}`}>{t(lv.label)}</span>
                  {c.category && <span className="text-[10px]" style={{ color: "var(--text-4)" }}>{c.category.name}</span>}
                </div>
                <p className="text-xs font-semibold line-clamp-2" style={{ color: "var(--text-base)" }}>{c.title}</p>
                <div className="flex items-center gap-2 text-[11px]" style={{ color: "var(--text-4)" }}>
                  {c.average_rating > 0 && <span className="flex items-center gap-0.5 text-amber-400"><Star className="w-2.5 h-2.5 fill-amber-400" />{c.average_rating.toFixed(1)}</span>}
                  {c.total_chapters ? <span>{t("{n} bab", { n: c.total_chapters })}</span> : null}
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

export default function UserDashboard() {
  const { lang, t } = useLang();
  const { user } = useAuthStore();
  const { data: overview } = useQuery({ queryKey: ["overview"], queryFn: () => api.get("/user/overview") });
  const { data: attempts = [] } = useQuery({ queryKey: ["attempts"], queryFn: () => api.get("/user/attempts") });
  const { data: assessments = [] } = useQuery({ queryKey: ["assessments"], queryFn: () => api.get("/user/skill-assessments") });

  const [rankUp, setRankUp] = useState(null); // { from, to }

  const rank = overview?.rank;
  const effective = rank?.effective;

  // Deteksi kenaikan rank → rayakan (feel of accomplishment). Bandingkan dengan rank
  // terakhir yang tersimpan di localStorage per user. Akun baru tidak dirayakan.
  useEffect(() => {
    if (!effective || !user?.id) return;
    const key = LAST_RANK_KEY(user.id);
    const prev = Number(localStorage.getItem(key));
    if (prev && effective > prev) setRankUp({ from: prev, to: effective });
    localStorage.setItem(key, String(effective));
  }, [effective, user?.id]);

  const p = overview?.profile || user || {};
  const status = p?.status || "not_ready";
  const sc = STATUS_CONFIG[status] || STATUS_CONFIG.not_ready;

  const topGaps = assessments.filter((a) => a.gap > 0).sort((a, b) => b.gap - a.gap).slice(0, 3);

  // Aksi cepat = launchpad. Interaksi yang dipindah dari Profile (ganti kompetensi,
  // tambah bukti) dibuka via deep-link ke Profil (?pick / ?evidence). Profil kini fokus lihat data.
  const actions = [
    { to: "/app/cv-upload",         icon: FileText,  label: t("Upload CV"),     desc: t("Auto-klasifikasi Rank"),        color: "#2563eb" },
    { to: "/app/profile?pick=1",    icon: Crosshair, label: t("Kompetensi"),    desc: overview?.chosenSkkni ? t("Ganti target") : t("Pilih target"), color: "#6366f1" },
    { to: "/app/profile?evidence=1",icon: Sparkles,  label: t("Tambah Bukti"),  desc: t("Sertifikasi/portofolio"),       color: "#10b981" },
    { to: "/app/exam",              icon: PenLine,   label: t("Ikut Ujian"),    desc: t("{n} percobaan", { n: attempts.length }),  color: "#12a594" },
    { to: "/app/skill-gap",         icon: Target,    label: t("Skill Gap"),     desc: t("{n} gap terdeteksi", { n: topGaps.length }), color: "#f59e0b" },
    { to: "/app/learning-path",     icon: Route,     label: t("Learning Path"), desc: t("Rekomendasi personal"),          color: "#8b5cf6" },
  ];

  return (
    <div className="space-y-6">
      {rankUp && <RankUpOverlay from={rankUp.from} to={rankUp.to} onClose={() => setRankUp(null)} />}

      {/* ── Panggung Rank (hero) full-width — kartu identitas dipindah ke sidebar (#10) ── */}
      {rank ? (
        <RankHero
          rank={rank}
          rankInfo={overview?.rankInfo}
          readiness={overview?.readiness?.total ?? p?.readinessScore ?? 0}
          competency={overview?.chosenSkkni?.title}
          footer={
            <div className="mt-5 flex flex-wrap items-center justify-center gap-2">
              <span className={`badge ${sc.cls}`}>{t(sc.label)}</span>
              {!overview?.chosenSkkni && (
                <Link to="/app/profile" className="text-xs font-semibold text-brand-400 hover:underline">{t("Pilih kompetensi target →")}</Link>
              )}
            </div>
          }
        />
      ) : (
        <div className="card p-8 text-center text-sm" style={{ color: "var(--text-4)" }}>{t("Memuat rank…")}</div>
      )}

      {/* Gamifikasi harian — Course Harian di bawah bonus login (mengisi ruang kosong) */}
      <div className="grid lg:grid-cols-2 gap-4 items-start">
        <div className="space-y-4">
          <DailyLoginCard />
          <DailyQuiz />
        </div>
        <DailyMissions />
      </div>

      {/* Aksi cepat — launchpad interaksi utama (termasuk yang dipindah dari Profil) */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {actions.map((c) => (
          <Link key={c.to} to={c.to} className="card p-4 hover:scale-[1.03] transition-transform group">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center mb-3"
              style={{ background: `${c.color}1f`, color: c.color }}>
              <c.icon className="w-5 h-5" />
            </div>
            <p className="font-semibold text-sm" style={{ color: "var(--text-base)" }}>{c.label}</p>
            <p className="text-xs mt-0.5" style={{ color: "var(--text-4)" }}>{c.desc}</p>
          </Link>
        ))}
      </div>

      {/* Kursus interaktif AvatarEdu.ai (SCORM embed) */}
      <AvatarEduDashboard />

      <div className="grid lg:grid-cols-2 gap-6">
        {/* Riwayat ujian */}
        <div className="card p-6">
          <h3 className="font-semibold mb-4 flex items-center gap-2" style={{ color: "var(--text-base)" }}>
            <Trophy className="w-4 h-4 text-brand-600" /> {t("Riwayat Ujian")}
          </h3>
          {attempts.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-sm" style={{ color: "var(--text-4)" }}>{t("Belum ada riwayat ujian")}</p>
              <Link to="/app/exam" className="btn-primary text-sm py-2 px-4 mt-3 inline-block">{t("Mulai Ujian")}</Link>
            </div>
          ) : (
            <div className="space-y-3">
              {attempts.slice(0, 5).map((a) => (
                <div key={a.id} className="flex items-center gap-3 p-3 rounded-xl" style={{ background: "var(--bg-muted)" }}>
                  <div className={`w-9 h-9 rounded-lg flex items-center justify-center text-xs font-bold ${
                    a.status === "ready" ? "bg-emerald-500/20 text-emerald-400" :
                    a.status === "in_progress" ? "bg-amber-500/20 text-amber-400" : "bg-red-500/20 text-red-400"
                  }`}>{a.readinessScore}%</div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium" style={{ color: "var(--text-base)" }}>Rank {rankName(a.kkniLevel)}</p>
                    <p className="text-xs" style={{ color: "var(--text-4)" }}>{new Date(a.createdAt).toLocaleDateString(dateLocale(lang), { day: "numeric", month: "short", year: "numeric" })}</p>
                  </div>
                  <span className={`badge ${STATUS_CONFIG[a.status]?.cls || "badge-not-ready"}`}>{t(STATUS_CONFIG[a.status]?.label || "")}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Gap kompetensi */}
        <div className="card p-6">
          <h3 className="font-semibold mb-4 flex items-center gap-2" style={{ color: "var(--text-base)" }}>
            <Award className="w-4 h-4 text-brand-600" /> {t("Gap Kompetensi Teratas")}
          </h3>
          {topGaps.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-sm" style={{ color: "var(--text-4)" }}>
                {assessments.length === 0 ? t("Ikuti ujian untuk melihat gap") : t("Semua kompetensi terpenuhi 🎉")}
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {topGaps.map((a) => (
                <div key={a.id}>
                  <div className="flex justify-between text-sm mb-1.5">
                    <span className="font-medium" style={{ color: "var(--text-2)" }}>{a.competencyName}</span>
                    <span className="text-red-400">{a.gap}% gap</span>
                  </div>
                  <div className="h-2 rounded-full overflow-hidden" style={{ background: "var(--bg-muted)" }}>
                    <div className="h-full bg-brand-600 rounded-full transition-all" style={{ width: `${a.currentScore}%` }} />
                  </div>
                  <div className="flex justify-between text-xs mt-0.5" style={{ color: "var(--text-4)" }}>
                    <span>{t("Saat ini:")} {a.currentScore}%</span>
                    <span>{t("Target:")} {a.requiredScore}%</span>
                  </div>
                </div>
              ))}
              <Link to="/app/skill-gap" className="text-sm text-brand-400 hover:text-brand-300 block mt-2">{t("Lihat semua →")}</Link>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
