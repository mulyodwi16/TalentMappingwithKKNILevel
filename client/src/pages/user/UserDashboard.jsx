import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import toast from "react-hot-toast";
import { FileText, PenLine, Target, Route, Trophy, Award, Crosshair, Sparkles, GraduationCap, PlayCircle, Loader2, Star, X, CheckCircle2, CircleDot, Circle, ArrowRight } from "lucide-react";
import api from "../../api/client.js";
import { useCoins } from "../../hooks/useCoins.js";
import useAuthStore from "../../store/authStore.js";
import DailyLoginCard from "../../components/DailyLoginCard.jsx";
import DailyMissions from "../../components/DailyMissions.jsx";
import DailyQuiz from "../../components/DailyQuiz.jsx";
import RankHero from "../../components/RankHero.jsx";
import RankUpOverlay from "../../components/RankUpOverlay.jsx";
import JourneySummary from "../../components/JourneySummary.jsx";
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

// Player SCORM multi-chapter: sidebar bab + progres (kiri), iframe player (kanan).
// Progres ditangkap dari event postMessage player AvatarEdu (scorm:progress/complete)
// lalu disimpan di localStorage per course+bab - tak ada progress API dari partner.
const AV_PROG_KEY = (slug) => `talenta:avprog:${slug}`;
const AV_ORIGIN = "https://avataredu.ai";
const isDone = (type, status) =>
  type === "scorm:complete" || ["passed", "completed"].includes(String(status || "").toLowerCase());

function CoursePlayerModal({ course, onClose }) {
  const { t } = useLang();
  const slug = course.slug;
  const [chapters, setChapters] = useState(null); // null=loading, []=single/none
  const [active, setActive] = useState(null);     // chapter id (0 = single-chapter)
  const [url, setUrl] = useState("");
  const [prog, setProg] = useState({});           // { [chapterId]: { pct, status } }

  // Muat daftar bab + progres tersimpan.
  useEffect(() => {
    try { setProg(JSON.parse(localStorage.getItem(AV_PROG_KEY(slug)) || "{}")); } catch { /* ignore */ }
    let alive = true;
    api.get(`/avataredu/courses/${encodeURIComponent(slug)}`)
      .then((d) => {
        if (!alive) return;
        const chs = (d?.data?.scorm_chapters || []).slice().sort((a, b) => a.order - b.order);
        setChapters(chs);
        setActive(chs.length ? chs[0].id : 0);
      })
      .catch(() => { if (alive) { setChapters([]); setActive(0); } });
    return () => { alive = false; };
  }, [slug]);

  // Ambil URL player saat bab aktif berubah (key diinject server-side).
  useEffect(() => {
    if (active === null) return;
    setUrl("");
    const q = active ? `?chapter=${encodeURIComponent(active)}` : "";
    api.get(`/avataredu/embed-url/${encodeURIComponent(slug)}${q}`).then((d) => setUrl(d.url)).catch(() => {});
  }, [slug, active]);

  // Tangkap progres SCORM dari iframe (lintas-origin) → simpan ke localStorage.
  useEffect(() => {
    function onMsg(e) {
      if (e.origin !== AV_ORIGIN) return;
      const m = e.data;
      if (!m || typeof m !== "object") return;
      const type = String(m.type || "");
      if (type !== "scorm:progress" && type !== "scorm:complete") return;
      if (m.course_slug && m.course_slug !== slug) return;
      const chId = Number(m.chapter_id) || 0;
      const done = isDone(type, m.lesson_status);
      const pct = done ? 100 : Math.max(0, Math.min(100, Math.round(Number(m.completion_pct) || 0)));
      const status = done ? "completed" : (m.lesson_status || "incomplete");
      setProg((prev) => {
        const cur = prev[chId];
        if (cur?.status === "completed" && !done) return prev; // jangan turunkan yang sudah selesai
        const next = { ...prev, [chId]: { pct: Math.max(pct, cur?.pct || 0), status } };
        try { localStorage.setItem(AV_PROG_KEY(slug), JSON.stringify(next)); } catch { /* ignore */ }
        return next;
      });
    }
    window.addEventListener("message", onMsg);
    return () => window.removeEventListener("message", onMsg);
  }, [slug]);

  useEffect(() => {
    const onKey = (e) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const chs = chapters || [];
  const total = chs.length || 1;
  const doneCount = chs.length
    ? chs.filter((c) => prog[c.id]?.status === "completed").length
    : (prog[0]?.status === "completed" ? 1 : 0);
  const overall = Math.round((doneCount / total) * 100);

  return (
    <div className="is-modal fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-6" style={{ background: "rgba(0,0,0,0.6)" }} onClick={onClose}>
      <div className="w-full max-w-6xl rounded-2xl overflow-hidden flex flex-col shadow-2xl" style={{ background: "var(--bg-surface)", maxHeight: "94vh" }} onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between gap-3 p-3 border-b" style={{ borderColor: "var(--border)" }}>
          <p className="text-sm font-semibold truncate flex items-center gap-2" style={{ color: "var(--text-base)" }}>
            <Sparkles className="w-4 h-4 text-violet-400 shrink-0" /> {course.title}
          </p>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-[var(--bg-muted)] shrink-0" style={{ color: "var(--text-3)" }} aria-label={t("Tutup")}>
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="flex flex-1 min-h-0 flex-col sm:flex-row">
          {chs.length > 0 && (
            <div className="sm:w-64 shrink-0 border-b sm:border-b-0 sm:border-r overflow-y-auto sm:max-h-none max-h-40" style={{ borderColor: "var(--border)", background: "var(--bg-raised)" }}>
              <div className="p-3">
                <div className="flex items-center justify-between text-xs mb-1.5" style={{ color: "var(--text-3)" }}>
                  <span>{t("Progres")}</span><span className="font-semibold">{doneCount}/{total} ({overall}%)</span>
                </div>
                <div className="h-2 rounded-full overflow-hidden" style={{ background: "var(--bg-muted)" }}>
                  <div className="h-full bg-emerald-500 rounded-full transition-all" style={{ width: `${overall}%` }} />
                </div>
              </div>
              <div className="pb-2">
                {chs.map((c, i) => {
                  const st = prog[c.id]?.status;
                  const pct = prog[c.id]?.pct || 0;
                  const isActive = active === c.id;
                  const Icon = st === "completed" ? CheckCircle2 : (pct > 0 ? CircleDot : Circle);
                  const color = st === "completed" ? "#10b981" : (pct > 0 ? "#f59e0b" : "var(--text-4)");
                  return (
                    <button key={c.id} onClick={() => setActive(c.id)}
                      className={`w-full text-left px-3 py-2 flex items-center gap-2.5 text-xs transition-colors ${isActive ? "bg-brand-500/10" : "hover:bg-[var(--bg-muted)]"}`}>
                      <Icon className="w-4 h-4 shrink-0" style={{ color }} />
                      <span className="flex-1 min-w-0">
                        <span className="block font-medium truncate" style={{ color: isActive ? "rgb(var(--brand-500))" : "var(--text-2)" }}>{t("Bab {n}", { n: i + 1 })}</span>
                        <span className="block truncate" style={{ color: "var(--text-4)" }}>{c.title}</span>
                      </span>
                      {pct > 0 && st !== "completed" && <span className="text-[10px] text-amber-500 shrink-0">{pct}%</span>}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          <div className="flex-1 min-h-0 flex flex-col" style={{ minHeight: "60vh" }}>
            {url
              ? <iframe key={url} src={url} className="w-full flex-1" style={{ border: 0, minHeight: "60vh" }} allow="fullscreen" title={course.title} />
              : <div className="flex-1 flex items-center justify-center"><Loader2 className="w-6 h-6 animate-spin text-brand-500" /></div>}
          </div>
        </div>
      </div>
    </div>
  );
}

// Kursus interaktif AvatarEdu.ai (kurasi admin via /featured) - dibuka langsung dari dashboard.
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
      if (r?.awarded > 0) { toast.success(t("+{n} Koin - selamat belajar!", { n: r.awarded })); if (typeof r.balance === "number") setBalance(r.balance); }
      setModal(c);
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
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
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
      {modal && <CoursePlayerModal course={modal} onClose={() => setModal(null)} />}
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

      {/* ── Panggung Rank (hero) full-width - kartu identitas dipindah ke sidebar (#10) ── */}
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
                <Link to="/app/profile" className="text-xs font-semibold text-brand-400 hover:underline inline-flex items-center gap-1">{t("Pilih kompetensi target")} <ArrowRight className="w-3 h-3" /></Link>
              )}
            </div>
          }
        />
      ) : (
        <div className="card p-8 text-center text-sm" style={{ color: "var(--text-4)" }}>{t("Memuat rank…")}</div>
      )}

      {/* Ringkasan seluruh perjalanan - ditaruh TEPAT di bawah hero karena inilah yang
          dicari pengguna saat mendarat: posisiku sekarang di mana, dan apa berikutnya. */}
      <JourneySummary overview={overview} assessments={assessments} />

      {/* Gamifikasi harian - Course Harian di bawah bonus login (mengisi ruang kosong) */}
      {/* Kolom kiri dibiarkan MEMANJANG mengikuti tinggi Misi Harian (tanpa items-start),
          lalu kartu Course Harian yang mengisi sisa ruangnya - kalau tidak, ada celah
          kosong menganga di bawah kolom kiri. */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="flex flex-col gap-4">
          <DailyLoginCard />
          <div className="flex-1 [&>.card]:h-full [&>.card]:flex [&>.card]:flex-col [&>.card]:justify-center">
            <DailyQuiz />
          </div>
        </div>
        <DailyMissions />
      </div>

      {/* Aksi cepat - launchpad interaksi utama (termasuk yang dipindah dari Profil) */}
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

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
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
              <Link to="/app/skill-gap" className="text-sm text-brand-400 hover:text-brand-300 mt-2 inline-flex items-center gap-1">{t("Lihat semua")} <ArrowRight className="w-3.5 h-3.5" /></Link>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
