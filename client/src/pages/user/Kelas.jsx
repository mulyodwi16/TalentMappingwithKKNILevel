import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import toast from "react-hot-toast";
import {
  GraduationCap, BookOpen, Lock, CheckCircle2, PlayCircle, RotateCcw, ChevronDown,
  Coins, Sparkles, Star, Lightbulb, Briefcase, ListChecks, Clock, Loader2, X,
} from "lucide-react";
import api from "../../api/client.js";
import { useCoins } from "../../hooks/useCoins.js";

const UNLOCK_COST = 60;

const STATE_UI = {
  passed:   { label: "Lulus",      Icon: CheckCircle2, badge: "bg-emerald-500/15 text-emerald-500" },
  ready:    { label: "Siap Ujian", Icon: PlayCircle,   badge: "bg-brand-500/15 text-brand-500" },
  learning: { label: "Belajar",    Icon: BookOpen,     badge: "bg-amber-500/15 text-amber-500" },
  locked:   { label: "Terkunci",   Icon: Lock,         badge: "bg-[var(--bg-muted)] text-[var(--text-4)]" },
};

const AV_LEVEL = {
  beginner:     { label: "Pemula",   cls: "bg-emerald-500/20 text-emerald-400" },
  intermediate: { label: "Menengah", cls: "bg-amber-500/20 text-amber-400" },
  advanced:     { label: "Mahir",    cls: "bg-brand-500/20 text-brand-400" },
};

// Modal course AvatarEdu — embed dibuka di overlay (bisa ditutup, tak memanjangkan halaman).
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

// ── Kursus AvatarEdu terkait unit (sumber course ke-2) — bisa langsung diikuti ─
// Kartu penuh + tombol "Ikuti Kelas": memberi Koin (sekali/kursus) & membuka course
// (embed) di MODAL. Katalog AvatarEdu kecil/generik → tandai bila hasil fallback.
function AvatarEduForUnit({ query }) {
  const { setBalance } = useCoins();
  const [modal, setModal] = useState(null);   // { title, url }
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
      if (r.awarded > 0) { toast.success(`+${r.awarded} Koin — selamat belajar!`); if (typeof r.balance === "number") setBalance(r.balance); }
      const d = await api.get(`/avataredu/embed-url/${encodeURIComponent(c.slug)}`);
      setModal({ title: c.title, url: d.url });
    } catch (e) {
      toast.error(typeof e === "string" ? e : "Gagal membuka kursus");
    } finally {
      setBusy(null);
    }
  }

  if (isLoading) return <p className="text-xs py-1" style={{ color: "var(--text-4)" }}>Mencari kursus AvatarEdu…</p>;
  if (courses.length === 0) return <p className="text-xs py-1" style={{ color: "var(--text-4)" }}>Belum ada kursus AvatarEdu cocok.</p>;

  return (
    <div className="space-y-2">
      {fallback && (
        <p className="text-[11px]" style={{ color: "var(--text-4)" }}>
          Belum ada kursus AvatarEdu khusus untuk unit ini — menampilkan kursus umum yang tersedia.
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
                  <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${lv.cls}`}>{lv.label}</span>
                  {c.category && <span className="text-[10px]" style={{ color: "var(--text-4)" }}>{c.category.name}</span>}
                </div>
                <p className="text-xs font-semibold line-clamp-2" style={{ color: "var(--text-base)" }}>{c.title}</p>
                <div className="flex items-center gap-2 text-[11px]" style={{ color: "var(--text-4)" }}>
                  {c.average_rating > 0 && <span className="flex items-center gap-0.5 text-amber-400"><Star className="w-2.5 h-2.5 fill-amber-400" />{c.average_rating.toFixed(1)}</span>}
                  {c.duration_hours ? <span>{c.duration_hours} jam</span> : null}
                  {c.total_lessons ? <span>{c.total_lessons} materi</span> : null}
                </div>
                <p className="text-xs font-bold text-brand-500 mt-auto">{c.formatted_price || "Gratis"}</p>
                <button onClick={() => follow(c)} disabled={busy === c.slug}
                  className="btn-primary text-xs py-1.5 w-full flex items-center justify-center gap-1.5">
                  {busy === c.slug ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <PlayCircle className="w-3.5 h-3.5" />}
                  Ikuti Kelas
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

// ── Materi kelas SKKNI (sumber course ke-1) — lazy saat unit dibuka ────────────
function UnitCourseBody({ code }) {
  const { data, isLoading, isError, error } = useQuery({
    queryKey: ["kelas-course", code],
    queryFn: () => api.get(`/kelas/unit/${encodeURIComponent(code)}`, { timeout: 60_000 }),
    staleTime: 10 * 60 * 1000,
  });
  if (isLoading) return <p className="text-sm py-3" style={{ color: "var(--text-4)" }}>Menyiapkan materi (AI)…</p>;
  if (isError) return <p className="text-sm py-3 text-red-400">{typeof error === "string" ? error : "Gagal memuat materi."}</p>;
  const c = data?.content || {};
  return (
    <div className="space-y-4">
      {/* Sumber 1: materi SKKNI */}
      <div className="rounded-xl p-4 space-y-3" style={{ background: "var(--bg-surface)", border: "1px solid var(--border)" }}>
        <div className="flex items-center gap-2">
          <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-brand-500/15 text-brand-500">Materi SKKNI</span>
          {c.estMinutes && <span className="text-[11px] flex items-center gap-1" style={{ color: "var(--text-4)" }}><Clock className="w-3 h-3" /> ± {c.estMinutes} menit</span>}
        </div>
        {c.overview && <p className="text-sm leading-relaxed" style={{ color: "var(--text-2)" }}>{c.overview}</p>}
        {c.keyPoints?.length > 0 && (
          <div>
            <p className="text-xs font-semibold flex items-center gap-1 mb-1.5" style={{ color: "var(--text-3)" }}><Lightbulb className="w-3.5 h-3.5 text-amber-500" /> Poin Kunci</p>
            <ul className="space-y-1">
              {c.keyPoints.map((k, i) => <li key={i} className="text-sm flex gap-2" style={{ color: "var(--text-2)" }}><span className="text-brand-500">•</span>{k}</li>)}
            </ul>
          </div>
        )}
        {c.caseExample && (
          <div className="rounded-lg px-3 py-2 border-l-2 border-amber-500" style={{ background: "var(--bg-raised)" }}>
            <p className="text-xs font-semibold flex items-center gap-1 mb-1 text-amber-500"><Briefcase className="w-3.5 h-3.5" /> Contoh Kasus Kerja</p>
            <p className="text-sm" style={{ color: "var(--text-2)" }}>{c.caseExample}</p>
          </div>
        )}
        {c.practiceSteps?.length > 0 && (
          <div>
            <p className="text-xs font-semibold flex items-center gap-1 mb-1.5" style={{ color: "var(--text-3)" }}><ListChecks className="w-3.5 h-3.5 text-emerald-500" /> Langkah Praktik</p>
            <ol className="space-y-1">
              {c.practiceSteps.map((s, i) => (
                <li key={i} className="text-sm flex gap-2" style={{ color: "var(--text-2)" }}>
                  <span className="w-4 h-4 rounded-full bg-emerald-500/15 text-emerald-500 text-[10px] grid place-items-center shrink-0 mt-0.5 font-bold">{i + 1}</span>{s}
                </li>
              ))}
            </ol>
          </div>
        )}
      </div>
    </div>
  );
}

// Sumber course ke-2: AvatarEdu — INDEPENDEN dari materi SKKNI, dan COLLAPSIBLE (tertutup
// default) agar tak memenuhi tiap dropdown; katalog kecil sering menampilkan kursus yang sama.
function AvatarEduSection({ title }) {
  const [open, setOpen] = useState(false);
  const query = (title || "").split(/\s+/).slice(0, 3).join(" ");
  return (
    <div>
      <button onClick={() => setOpen((o) => !o)}
        className="text-xs font-semibold flex items-center gap-1.5 hover:opacity-80" style={{ color: "var(--text-3)" }}>
        <Sparkles className="w-3.5 h-3.5 text-violet-400" /> Kursus AvatarEdu terkait
        <ChevronDown className={`w-3.5 h-3.5 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      {open && <div className="mt-2"><AvatarEduForUnit query={query} /></div>}
    </div>
  );
}

function UnitRow({ unit, onComplete, onUnlock, busy, balance, defaultOpen }) {
  const [open, setOpen] = useState(!!defaultOpen);
  const ui = STATE_UI[unit.state] || STATE_UI.locked;
  const canExam = unit.state === "ready" || unit.state === "passed";

  return (
    <div className="card overflow-hidden">
      <button onClick={() => setOpen((o) => !o)} className="w-full flex items-center gap-3 p-3.5 text-left">
        <div className={`w-8 h-8 rounded-full grid place-items-center shrink-0 text-xs font-black ${unit.state === "passed" ? "bg-emerald-500 text-white" : "bg-[var(--bg-muted)]"}`} style={unit.state === "passed" ? {} : { color: "var(--text-3)" }}>
          {unit.state === "passed" ? "✓" : unit.order}
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium truncate" style={{ color: "var(--text-base)" }}>{unit.title}</p>
          <div className="flex items-center gap-2 mt-0.5">
            <span className={`text-[11px] px-1.5 py-0.5 rounded-full ${ui.badge}`}>{ui.label}</span>
            {unit.score != null && <span className="text-[11px]" style={{ color: "var(--text-4)" }}>skor {unit.score}%</span>}
            {unit.hasCourse && <span className="text-[11px]" style={{ color: "var(--text-4)" }}>· materi siap</span>}
          </div>
        </div>
        <ChevronDown className={`w-4 h-4 shrink-0 transition-transform ${open ? "rotate-180" : ""}`} style={{ color: "var(--text-4)" }} />
      </button>

      {open && (
        <div className="px-3.5 pb-3.5 space-y-4 border-t pt-3.5" style={{ borderColor: "var(--border)" }}>
          {unit.state === "locked" ? (
            <div className="rounded-lg p-4 text-center" style={{ background: "var(--bg-raised)" }}>
              <Lock className="w-6 h-6 mx-auto mb-2" style={{ color: "var(--text-4)" }} />
              <p className="text-sm mb-3" style={{ color: "var(--text-3)" }}>Selesaikan unit sebelumnya secara berurutan, atau buka unit ini sekarang dengan Koin untuk langsung ke ujian.</p>
              <button onClick={() => onUnlock(unit.code)} disabled={busy || balance < UNLOCK_COST}
                className="btn-primary text-sm inline-flex items-center gap-1.5 disabled:opacity-50">
                <Coins className="w-4 h-4" /> Buka dengan {UNLOCK_COST} Koin
              </button>
              {balance < UNLOCK_COST && <p className="text-[11px] mt-2 text-red-400">Koin kurang (saldo {balance}).</p>}
            </div>
          ) : (
            <>
              <UnitCourseBody code={unit.code} />
              <AvatarEduSection title={unit.title} />
              <div className="flex flex-wrap gap-2 items-center">
                {unit.state === "learning" && (
                  <button onClick={() => onComplete(unit.code)} disabled={busy}
                    className="btn-primary text-sm inline-flex items-center gap-1.5 disabled:opacity-50">
                    <CheckCircle2 className="w-4 h-4" /> Tandai Selesai Belajar (+15 Koin)
                  </button>
                )}
                {canExam && (
                  <Link to={`/app/exam?unit=${encodeURIComponent(unit.code)}`}
                    className="btn-primary text-sm inline-flex items-center gap-1.5">
                    {unit.state === "passed" ? <><RotateCcw className="w-4 h-4" /> Ujian Ulang</> : <><PlayCircle className="w-4 h-4" /> Mulai Ujian Unit</>}
                  </Link>
                )}
                {unit.state === "learning" && <span className="text-[11px]" style={{ color: "var(--text-4)" }}>Ujian terbuka setelah kelas ditandai selesai.</span>}
                {unit.state === "passed" && <span className="text-[11px] text-emerald-500">Sertifikat unit sudah terbit ✓</span>}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}

export default function Kelas() {
  const qc = useQueryClient();
  const { setBalance } = useCoins();
  const [busy, setBusy] = useState(false);

  const { data, isLoading } = useQuery({ queryKey: ["kelas-units"], queryFn: () => api.get("/kelas/units") });
  const chosen = data?.chosen;
  const units = data?.units || [];
  const s = data?.summary;
  const balance = data?.balance ?? 0;
  // Buka otomatis unit yang sedang dikerjakan (belajar/siap ujian) agar materi & kursus
  // AvatarEdu langsung terlihat tanpa perlu klik. Jika semua lulus, buka unit pertama.
  const focusCode =
    units.find((u) => u.state === "learning" || u.state === "ready")?.code ||
    units.find((u) => u.state !== "passed")?.code ||
    units[0]?.code;

  const refresh = (payload) => {
    if (payload?.units) qc.setQueryData(["kelas-units"], (old) => ({ ...old, units: payload.units, summary: payload.summary }));
    if (typeof payload?.balance === "number") { setBalance(payload.balance); qc.setQueryData(["kelas-units"], (old) => ({ ...old, balance: payload.balance })); }
    qc.invalidateQueries(["coins"]);
  };

  const complete = useMutation({
    mutationFn: (code) => api.post(`/kelas/unit/${encodeURIComponent(code)}/complete`),
    onMutate: () => setBusy(true),
    onSuccess: (r) => { refresh(r); if (r.coin?.awarded > 0) { toast.success(`+${r.coin.awarded} Koin — ujian unit terbuka!`); } else toast.success("Kelas selesai — ujian terbuka!"); },
    onError: (e) => toast.error(typeof e === "string" ? e : "Gagal"),
    onSettled: () => setBusy(false),
  });

  const unlock = useMutation({
    mutationFn: (code) => api.post(`/kelas/unit/${encodeURIComponent(code)}/unlock`),
    onMutate: () => setBusy(true),
    onSuccess: (r) => { refresh(r); if (!r.already) toast.success(`Unit terbuka! −${r.spent} Koin`); },
    onError: (e) => toast.error(typeof e === "string" ? e : "Gagal membuka unit"),
    onSettled: () => setBusy(false),
  });

  if (isLoading) return <div className="flex items-center justify-center h-64" style={{ color: "var(--text-4)" }}>Memuat kelas…</div>;

  if (!chosen) {
    return (
      <div className="max-w-lg mx-auto card p-10 text-center">
        <GraduationCap className="w-10 h-10 mx-auto mb-3 text-brand-500" />
        <h2 className="font-bold mb-1" style={{ color: "var(--text-base)" }}>Belum Ada Kelas</h2>
        <p className="text-sm mb-5" style={{ color: "var(--text-3)" }}>Pilih kompetensi SKKNI dulu agar kami susun kelas per unit kompetensinya.</p>
        <Link to="/app/profile" className="btn-primary">Pilih Kompetensi →</Link>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="rounded-2xl bg-gradient-to-br from-brand-600 via-brand-600/90 to-tosca-500 text-white p-6 shadow-lg">
        <div className="flex items-center gap-2 mb-1"><GraduationCap className="w-5 h-5" /><h1 className="text-xl font-bold text-white">Kelas Kompetensi</h1></div>
        <p className="text-sm text-white/80 max-w-2xl">
          Belajar per unit dari <b>{chosen.title}</b> — materi SKKNI + kursus AvatarEdu. Selesaikan kelas untuk membuka ujian unit; lulus menerbitkan sertifikat. Koin bisa membuka unit lebih cepat.
        </p>
        {s && (
          <div className="flex gap-2 mt-3 flex-wrap text-xs">
            <span className="px-2 py-1 rounded-full bg-white/15">{s.passed}/{s.total} lulus</span>
            <span className="px-2 py-1 rounded-full bg-white/15">{s.ready} siap ujian</span>
            <span className="px-2 py-1 rounded-full bg-white/15">{s.learning} sedang belajar</span>
            <span className="px-2 py-1 rounded-full bg-white/15 flex items-center gap-1"><Coins className="w-3 h-3" /> {balance}</span>
          </div>
        )}
      </div>

      <div className="space-y-2">
        {units.map((u) => (
          <UnitRow key={u.code} unit={u} balance={balance} busy={busy} defaultOpen={u.code === focusCode}
            onComplete={(c) => complete.mutate(c)} onUnlock={(c) => unlock.mutate(c)} />
        ))}
      </div>

      <p className="text-xs text-center" style={{ color: "var(--text-4)" }}>
        Materi disusun AI selaras SKKNI. Kursus interaktif oleh{" "}
        <a href="https://avataredu.ai" target="_blank" rel="noopener noreferrer" className="text-brand-500 hover:underline">AvatarEdu.ai</a>.
        {" "}Sertifikat hanya terbit dari <b>lulus ujian</b> — Koin hanya mempercepat akses.
      </p>
    </div>
  );
}
