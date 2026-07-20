import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Link, useSearchParams } from "react-router-dom";
import toast from "react-hot-toast";
import {
  CheckCircle2, Lock, BookOpen, PlayCircle, RotateCcw, GraduationCap, Award, ArrowLeft, ArrowRight, Sparkles,
  History, XCircle, X, Loader2,
} from "lucide-react";
import api from "../../api/client.js";
import { useLang, getLang, dateLocale } from "../../lib/i18n.jsx";

function Timer({ seconds, onDone }) {
  const [left, setLeft] = useState(seconds);
  useEffect(() => {
    const id = setInterval(() => setLeft((v) => { if (v <= 1) { clearInterval(id); onDone(); return 0; } return v - 1; }), 1000);
    return () => clearInterval(id);
  }, [seconds, onDone]);
  const m = Math.floor(left / 60), s = left % 60;
  const pct = (left / seconds) * 100;
  return (
    <div className="flex items-center gap-2">
      <svg className="w-6 h-6 -rotate-90">
        <circle cx="12" cy="12" r="10" fill="none" stroke="var(--border-2)" strokeWidth="2.5" />
        <circle cx="12" cy="12" r="10" fill="none" stroke={left < 60 ? "#ef4444" : "#2563eb"} strokeWidth="2.5"
          strokeDasharray={62.8} strokeDashoffset={62.8 - (pct / 100) * 62.8} strokeLinecap="round" />
      </svg>
      <span className={`font-mono font-bold text-sm ${left < 60 ? "text-red-400" : ""}`} style={{ color: left < 60 ? undefined : "var(--text-base)" }}>
        {m}:{String(s).padStart(2, "0")}
      </span>
    </div>
  );
}

const STATE_UI = {
  passed:   { label: "Lulus",      Icon: CheckCircle2, cls: "text-emerald-500", badge: "bg-emerald-500/15 text-emerald-500" },
  ready:    { label: "Siap Ujian", Icon: PlayCircle,   cls: "text-brand-500",   badge: "bg-brand-500/15 text-brand-500" },
  learning: { label: "Belajar",    Icon: BookOpen,     cls: "text-amber-500",   badge: "bg-amber-500/15 text-amber-500" },
  locked:   { label: "Terkunci",   Icon: Lock,         cls: "text-[var(--text-4)]", badge: "bg-[var(--bg-muted)] text-[var(--text-4)]" },
};

const QTYPE = {
  mc:          { label: "Pilihan Ganda", cls: "bg-brand-500/15 text-brand-500" },
  situational: { label: "Studi Kasus",   cls: "bg-amber-500/15 text-amber-500" },
  steporder:   { label: "Urutan Langkah", cls: "bg-violet-500/15 text-violet-400" },
};

// Soal terjawab: MC bila dipilih; isian/urutan bila teks tak kosong.
const isAnswered = (q, a) => ((q.type === "mc" || !q.type) ? a !== undefined : typeof a === "string" && a.trim().length > 0);

const fmtDT = (d) => new Date(d).toLocaleString(dateLocale(getLang()), { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });

// ── Review per soal ala Quizizz (#3): jawaban user vs jawaban benar terlihat ──
function ReviewBreakdown({ breakdown }) {
  const { t } = useLang();
  return (
    <div className="space-y-3">
      {breakdown.map((b, i) => {
        const ok = b.isCorrect ?? b.score >= 60;
        const partial = !ok && b.score > 0;
        return (
          <div key={i} className="rounded-lg overflow-hidden" style={{ border: `1px solid ${ok ? "rgba(16,185,129,0.35)" : partial ? "rgba(245,158,11,0.35)" : "rgba(239,68,68,0.35)"}`, background: "var(--bg-raised)" }}>
            {/* Header soal + skor */}
            <div className="flex items-start justify-between gap-2 p-3 pb-2">
              <div className="min-w-0">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="text-[10px] font-bold" style={{ color: "var(--text-4)" }}>#{i + 1}</span>
                  <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${QTYPE[b.type]?.cls || QTYPE.mc.cls}`}>{t(QTYPE[b.type]?.label || "Pilihan Ganda")}</span>
                  {ok ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" /> : <XCircle className={`w-3.5 h-3.5 ${partial ? "text-amber-500" : "text-red-400"}`} />}
                </div>
                <p className="text-sm mt-1" style={{ color: "var(--text-base)" }}>{b.question}</p>
              </div>
              <span className={`text-sm font-bold shrink-0 ${b.score >= 60 ? "text-emerald-500" : b.score > 0 ? "text-amber-500" : "text-red-400"}`}>{b.score}%</span>
            </div>

            <div className="px-3 pb-3 space-y-1.5">
              {b.type === "mc" && Array.isArray(b.options) ? (
                // Quizizz-style: semua opsi; pilihan user & jawaban benar disorot.
                b.options.map((opt, oi) => {
                  const isUser = opt === b.userAnswer;
                  const isKey = opt === b.correctAnswer;
                  const style = isKey
                    ? { background: "rgba(16,185,129,0.12)", border: "1px solid rgba(16,185,129,0.45)", color: "#10b981" }
                    : isUser
                      ? { background: "rgba(239,68,68,0.10)", border: "1px solid rgba(239,68,68,0.40)", color: "#f87171" }
                      : { background: "var(--bg-muted)", border: "1px solid transparent", color: "var(--text-4)" };
                  return (
                    <div key={oi} className="flex items-center gap-2 rounded-lg px-2.5 py-1.5 text-xs" style={style}>
                      <span className="font-bold shrink-0">{String.fromCharCode(65 + oi)}.</span>
                      <span className="flex-1">{opt}</span>
                      {isKey && <span className="text-[10px] font-bold shrink-0">✓ {t("Jawaban benar")}</span>}
                      {isUser && !isKey && <span className="text-[10px] font-bold shrink-0">✗ {t("Pilihanmu")}</span>}
                      {isUser && isKey && <span className="text-[10px] font-bold shrink-0">{t("Pilihanmu")}</span>}
                    </div>
                  );
                })
              ) : (
                // Isian/urutan: jawaban user + umpan balik AI.
                <>
                  <div className="rounded-lg px-2.5 py-2 text-xs" style={{ background: "var(--bg-muted)", border: "1px solid var(--border)" }}>
                    <p className="text-[10px] font-bold mb-0.5" style={{ color: "var(--text-4)" }}>{t("JAWABANMU")}</p>
                    <p style={{ color: "var(--text-2)", whiteSpace: "pre-wrap" }}>{b.userAnswer?.trim() ? b.userAnswer : <i style={{ color: "var(--text-4)" }}>{t("(tidak dijawab)")}</i>}</p>
                  </div>
                </>
              )}
              {b.feedback && (
                <p className="text-xs flex gap-1.5 rounded-lg px-2.5 py-2" style={{ color: "var(--text-3)", background: "rgba(99,102,241,0.08)", border: "1px solid rgba(99,102,241,0.2)" }}>
                  <Sparkles className="w-3.5 h-3.5 text-brand-500 shrink-0 mt-0.5" /> <span><b className="text-brand-500">AI:</b> {b.feedback}</span>
                </p>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// Modal review riwayat ujian - buka kembali soal + jawaban untuk dipelajari.
function HistoryReviewModal({ id, onClose }) {
  const { t } = useLang();
  const { data, isLoading } = useQuery({ queryKey: ["exam-review", id], queryFn: () => api.get(`/skkni/exam-history/${id}`), enabled: !!id });
  useEffect(() => {
    const onKey = (e) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);
  return (
    <div className="is-modal fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div className="w-full max-w-2xl rounded-2xl overflow-hidden flex flex-col" style={{ background: "var(--bg-surface)", border: "1px solid var(--border)", maxHeight: "90vh" }} onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between gap-3 px-4 py-3 shrink-0" style={{ borderBottom: "1px solid var(--border)" }}>
          <div className="min-w-0">
            <p className="text-sm font-semibold truncate" style={{ color: "var(--text-base)" }}>{data?.unitTitle || t("Review Ujian")}</p>
            {data && <p className="text-[11px]" style={{ color: "var(--text-4)" }}>{fmtDT(data.createdAt)} · {t("skor")} <b className={data.passed ? "text-emerald-500" : "text-red-400"}>{data.score}%</b> · {data.passed ? t("Lulus") : t("Belum lulus")}</p>}
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-red-500/10 hover:text-red-400 shrink-0" style={{ color: "var(--text-4)" }} aria-label={t("Tutup")}><X className="w-4 h-4" /></button>
        </div>
        <div className="p-4 overflow-y-auto">
          {isLoading ? (
            <p className="text-sm text-center py-8 flex items-center justify-center gap-2" style={{ color: "var(--text-4)" }}><Loader2 className="w-4 h-4 animate-spin" /> {t("Memuat review…")}</p>
          ) : data?.breakdown ? (
            <ReviewBreakdown breakdown={data.breakdown} />
          ) : (
            <p className="text-sm text-center py-8" style={{ color: "var(--text-4)" }}>{t("Review tidak ditemukan.")}</p>
          )}
        </div>
      </div>
    </div>
  );
}

// Riwayat ujian unit - daftar hasil untuk dibuka kembali (fitur belajar dari kesalahan).
function ExamHistory() {
  const { t } = useLang();
  const [viewId, setViewId] = useState(null);
  const { data } = useQuery({ queryKey: ["exam-history"], queryFn: () => api.get("/skkni/exam-history") });
  const items = data?.items || [];
  if (items.length === 0) return null;
  return (
    <div className="card p-5">
      <h3 className="text-sm font-bold flex items-center gap-2 mb-3" style={{ color: "var(--text-base)" }}>
        <History className="w-4 h-4 text-brand-500" /> {t("Riwayat Ujian Unit")}
        <span className="text-[11px] font-normal" style={{ color: "var(--text-4)" }}>{t("klik untuk review soal & jawabanmu")}</span>
      </h3>
      <div className="space-y-1.5 max-h-64 overflow-y-auto pr-1">
        {items.map((it) => (
          <button key={it.id} onClick={() => setViewId(it.id)}
            className="w-full flex items-center gap-3 rounded-lg px-3 py-2 text-left transition-colors hover:bg-[var(--bg-muted)]"
            style={{ border: "1px solid var(--border)" }}>
            <span className={`w-9 h-9 rounded-lg grid place-items-center text-xs font-black shrink-0 ${it.passed ? "bg-emerald-500/15 text-emerald-500" : "bg-red-500/10 text-red-400"}`}>{it.score}%</span>
            <span className="min-w-0 flex-1">
              <span className="block text-xs font-medium truncate" style={{ color: "var(--text-base)" }}>{it.unitTitle}</span>
              <span className="block text-[11px]" style={{ color: "var(--text-4)" }}>{fmtDT(it.createdAt)} · {it.passed ? t("Lulus") : t("Belum lulus")}</span>
            </span>
            <span className="text-[11px] text-brand-500 shrink-0 inline-flex items-center gap-1">{t("Review")} <ArrowRight className="w-3 h-3" /></span>
          </button>
        ))}
      </div>
      {viewId && <HistoryReviewModal id={viewId} onClose={() => setViewId(null)} />}
    </div>
  );
}

// ── Pemilih unit: ujian kini PER UNIT kompetensi ──────────────────────────────
function UnitPicker({ chosen, onPick }) {
  const { t } = useLang();
  const { data, isLoading } = useQuery({ queryKey: ["kelas-units"], queryFn: () => api.get("/kelas/units") });
  if (isLoading) return <div className="text-center py-10 text-sm" style={{ color: "var(--text-4)" }}>{t("Memuat unit…")}</div>;
  const units = data?.units || [];
  const s = data?.summary;

  return (
    <div className="space-y-4">
      <div className="card p-5">
        <div className="flex items-center gap-2 mb-1">
          <GraduationCap className="w-5 h-5 text-brand-500" />
          <h2 className="text-lg font-bold" style={{ color: "var(--text-base)" }}>{t("Latihan per Unit Kompetensi")}</h2>
        </div>
        <p className="text-sm mb-1" style={{ color: "var(--text-3)" }}>{chosen.title}</p>
        <p className="text-xs" style={{ color: "var(--text-4)" }}>
          {t("Tiap unit dilatih terpisah dengan jumlah soal berbeda sesuai kompleksitasnya. Selesaikan")} <b>{t("Kelas")}</b> {t("unit untuk membuka latihannya - lulus (≥60%) menandai unit dikuasai dan menaikkan rank.")}
        </p>
        {s && (
          <div className="flex gap-2 mt-3 flex-wrap text-xs">
            <span className="px-2 py-1 rounded-full bg-emerald-500/15 text-emerald-500">{t("{n} lulus", { n: s.passed })}</span>
            <span className="px-2 py-1 rounded-full bg-brand-500/15 text-brand-500">{t("{n} siap ujian", { n: s.ready })}</span>
            <span className="px-2 py-1 rounded-full bg-amber-500/15 text-amber-500">{t("{n} belajar", { n: s.learning })}</span>
            <span className="px-2 py-1 rounded-full bg-[var(--bg-muted)]" style={{ color: "var(--text-4)" }}>{t("{n} terkunci", { n: s.locked })}</span>
          </div>
        )}
      </div>

      {/* Library grid: 2–4 kolom (samping) × n baris (ke bawah) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
        {units.map((u) => {
          const ui = STATE_UI[u.state] || STATE_UI.locked;
          const canExam = u.state === "ready" || u.state === "passed";
          const accent = u.state === "passed" ? "#10b981" : u.state === "ready" ? "var(--brand-ring, #6366f1)" : "var(--border)";
          return (
            <div key={u.code} className="card p-4 flex flex-col gap-3" style={{ borderTop: `3px solid ${u.state === "passed" ? "#10b981" : "var(--border)"}` }}>
              <div className="flex items-start gap-2.5">
                <div className={`w-9 h-9 rounded-xl grid place-items-center shrink-0 text-sm font-black ${u.state === "passed" ? "bg-emerald-500 text-white" : "bg-[var(--bg-muted)]"}`} style={u.state === "passed" ? {} : { color: "var(--text-3)" }}>
                  {u.state === "passed" ? "✓" : u.order}
                </div>
                <span className={`text-[11px] px-1.5 py-0.5 rounded-full ml-auto shrink-0 ${ui.badge}`}>{t(ui.label)}</span>
              </div>
              <p className="text-sm font-semibold leading-snug line-clamp-3 min-h-[3.6em]" style={{ color: "var(--text-base)" }} title={u.title}>{u.title}</p>
              <div className="flex items-center gap-2 text-[11px]" style={{ color: "var(--text-4)" }}>
                {u.score != null && <span>{t("skor {n}%", { n: u.score })}</span>}
                {u.questionCount ? <span>· {t("{n} soal", { n: u.questionCount })}</span> : null}
              </div>
              {canExam ? (
                <button onClick={() => onPick(u.code)} className="btn-primary text-xs py-2 w-full flex items-center justify-center gap-1.5 mt-auto">
                  {u.state === "passed" ? <><RotateCcw className="w-3.5 h-3.5" /> {t("Ujian Ulang")}</> : <><PlayCircle className="w-3.5 h-3.5" /> {t("Mulai Ujian")}</>}
                </button>
              ) : (
                <Link to="/app/kelas" className="btn-outline text-xs py-2 w-full flex items-center justify-center gap-1.5 mt-auto">
                  <ui.Icon className="w-3.5 h-3.5" /> {u.state === "locked" ? t("Buka di Kelas") : t("Belajar Dulu")}
                </Link>
              )}
            </div>
          );
        })}
      </div>
      {units.length === 0 && (
        <div className="card p-8 text-center text-sm" style={{ color: "var(--text-4)" }}>
          {t("Belum ada unit.")} <Link to="/app/profile" className="text-brand-500 hover:underline">{t("Pilih kompetensi SKKNI")}</Link> {t("dulu.")}
        </div>
      )}

      {/* Riwayat ujian (#3) - review kembali soal & jawaban untuk dipelajari */}
      <ExamHistory />
    </div>
  );
}

export default function Exam() {
  const { t } = useLang();
  const qc = useQueryClient();
  const [sp, setSp] = useSearchParams();
  const unitParam = sp.get("unit");
  const [answers, setAnswers] = useState({});
  const [started, setStarted] = useState(false);
  const [result, setResult] = useState(null);
  const [current, setCurrent] = useState(0);

  const { data: chosenData } = useQuery({ queryKey: ["skkni-chosen"], queryFn: () => api.get("/skkni/chosen") });
  const useSkkni = !!chosenData?.chosen?.id;

  // Mode: SKKNI → per-unit (butuh ?unit). Tanpa kompetensi → ujian legacy penuh.
  const unitMode = useSkkni && !!unitParam;
  const legacyActive = !useSkkni && started;
  const examUrl = unitMode ? `/skkni/exam/${encodeURIComponent(unitParam)}` : "/user/exam";
  const submitUrl = unitMode ? `/skkni/exam/${encodeURIComponent(unitParam)}/submit` : "/user/exam/submit";
  const examEnabled = unitMode || legacyActive;

  const { data: examData, isLoading, error: examError } = useQuery({
    queryKey: ["exam", unitMode ? unitParam : "legacy"],
    queryFn: () => api.get(examUrl),
    enabled: examEnabled,
    retry: false,
  });

  const submit = useMutation({
    mutationFn: () => api.post(submitUrl, { answers }),
    onSuccess: (data) => {
      setResult(data);
      ["attempts", "assessments", "profile", "overview", "notifications", "skkni-chosen", "kelas-units", "learning-path", "coins", "exam-history"].forEach((k) => qc.invalidateQueries([k]));
    },
    onError: (err) => toast.error(err || t("Gagal submit")),
  });

  const questions = examData?.questions || [];
  const q = questions[current];
  const answered = questions.filter((qq) => isAnswered(qq, answers[qq.id])).length;
  const timeLimit = (examData?.timeLimit || 20) * 60;

  const pickUnit = (code) => { setResult(null); setAnswers({}); setCurrent(0); setSp({ unit: code }); };
  const backToList = () => { setResult(null); setAnswers({}); setCurrent(0); setSp({}); qc.removeQueries(["exam"]); };
  const retakeUnit = () => { setResult(null); setAnswers({}); setCurrent(0); qc.removeQueries(["exam", unitParam]); };
  const restartLegacy = () => { setResult(null); setAnswers({}); setCurrent(0); setStarted(false); qc.removeQueries(["exam", "legacy"]); };

  // ── SKKNI: tampilkan pemilih unit bila belum memilih unit ───────────────────
  if (useSkkni && !unitParam && !result) return <UnitPicker chosen={chosenData.chosen} onPick={pickUnit} />;

  // ── Legacy start (tanpa kompetensi target) ──────────────────────────────────
  if (!useSkkni && !started && !result) {
    return (
      <div className="max-w-xl mx-auto space-y-5">
        <div className="card p-8 text-center">
          <div className="text-5xl mb-4">✎</div>
          <h2 className="text-2xl font-bold mb-2" style={{ color: "var(--text-base)" }}>{t("Ujian Kompetensi")}</h2>
          <p className="text-sm mb-4" style={{ color: "var(--text-3)" }}>{t("Ujian ini menilai kompetensi Anda berdasarkan standar SKKNI.")}</p>
          <div className="rounded-xl p-3 mb-5 text-sm" style={{ background: "var(--bg-muted)", color: "var(--text-3)" }}>
            {t("Belum memilih kompetensi target.")} <Link to="/app/profile" className="text-brand-500 font-medium hover:underline">{t("Pilih kompetensi SKKNI")}</Link> {t("agar latihan menjadi per unit & terhubung ke tangga rank.")}
          </div>
          <button onClick={() => setStarted(true)} className="btn-primary w-full py-3 inline-flex items-center justify-center gap-2">{t("Mulai Ujian")} <ArrowRight size={16} /></button>
        </div>
      </div>
    );
  }

  if (isLoading) return <div className="flex items-center justify-center h-64" style={{ color: "var(--text-4)" }}>{unitMode ? t("Menyiapkan soal unit…") : t("Memuat soal…")}</div>;

  if (examError && !result) {
    return (
      <div className="max-w-xl mx-auto card p-8 text-center">
        <div className="text-5xl mb-4">⚠️</div>
        <h2 className="text-xl font-bold mb-2" style={{ color: "var(--text-base)" }}>{t("Ujian belum bisa dimulai")}</h2>
        <p className="text-sm mb-5" style={{ color: "var(--text-3)" }}>{typeof examError === "string" ? examError : t("Gagal memuat soal.")}</p>
        <div className="flex gap-3">
          {unitMode ? <Link to="/app/kelas" className="btn-outline flex-1">{t("Ke Kelas")}</Link> : <Link to="/app/profile" className="btn-outline flex-1">{t("Ke Profil")}</Link>}
          <button onClick={unitMode ? backToList : restartLegacy} className="btn-primary flex-1">{t("Kembali")}</button>
        </div>
      </div>
    );
  }

  // ── Hasil ──────────────────────────────────────────────────────────────────
  if (result) {
    const isUnit = result.source === "skkni-unit";
    const pct = isUnit ? result.score : result.readiness;
    const good = pct >= 80, mid = pct >= 60;
    return (
      <div className="max-w-2xl mx-auto space-y-4">
        <div className="card p-8 text-center">
          <div className="text-6xl mb-4">{good ? "🎉" : mid ? "📈" : "📚"}</div>
          <h2 className="text-2xl font-bold mb-1" style={{ color: "var(--text-base)" }}>{isUnit ? t("Hasil Ujian Unit") : t("Hasil Ujian")}</h2>
          {isUnit && <p className="text-sm mb-1" style={{ color: "var(--text-3)" }}>{result.unitTitle}</p>}
          <p className={`text-4xl font-black mb-2 ${pct >= 80 ? "text-emerald-400" : pct >= 60 ? "text-amber-400" : "text-red-400"}`}>{pct}%</p>
          {isUnit ? (
            <p style={{ color: "var(--text-3)" }}>{result.passed ? t("LULUS - sertifikat unit terbit ✓") : t("Belum lulus (butuh ≥60%). Tinjau umpan balik AI di bawah.")}</p>
          ) : (
            <p style={{ color: "var(--text-3)" }}>{result.status === "ready" ? t("Siap Naik Level ✓") : result.status === "in_progress" ? t("Dalam Proses") : t("Perlu Peningkatan")}</p>
          )}
        </div>

        {isUnit && result.certificate && (
          <div className="card p-5" style={{ borderColor: "rgba(16,185,129,0.3)" }}>
            <p className="text-sm font-semibold text-emerald-500 flex items-center gap-1.5 mb-2"><Award className="w-4 h-4" /> {t("Sertifikat unit terbit")}</p>
            <span className="text-xs bg-emerald-500/10 text-emerald-500 border border-emerald-500/30 rounded-lg px-2.5 py-1 inline-block">{result.certificate}</span>
            <Link to="/app/profile" className="mt-3 text-xs text-brand-500 hover:underline inline-flex items-center gap-1">{t("Lihat & unduh sertifikat di Profil")} <ArrowRight className="w-3 h-3" /></Link>
          </div>
        )}

        {/* Review per soal ala Quizizz: jawabanmu vs jawaban benar + feedback AI */}
        {isUnit && result.breakdown?.length > 0 && (
          <div className="card p-6">
            <h3 className="font-semibold mb-1" style={{ color: "var(--text-base)" }}>{t("Review per Soal")}</h3>
            <p className="text-xs mb-4" style={{ color: "var(--text-4)" }}>{t("Jawabanmu & jawaban benar ditampilkan agar tahu persis apa yang salah. Review ini tersimpan di")} <b>{t("Riwayat Ujian")}</b>.</p>
            <ReviewBreakdown breakdown={result.breakdown} />
          </div>
        )}

        {!isUnit && result.certificates?.length > 0 && (
          <div className="card p-5" style={{ borderColor: "rgba(16,185,129,0.3)" }}>
            <p className="text-sm font-semibold text-emerald-500 mb-2">{t("🎓 Sertifikat terbit ({n})", { n: result.certificates.length })}</p>
            <div className="flex flex-wrap gap-2">{result.certificates.map((c) => <span key={c} className="text-xs bg-emerald-500/10 text-emerald-500 border border-emerald-500/30 rounded-lg px-2.5 py-1">{c}</span>)}</div>
          </div>
        )}

        {!isUnit && result.results?.length > 0 && (
          <div className="card p-6">
            <h3 className="font-semibold mb-4" style={{ color: "var(--text-base)" }}>{t("Hasil per Kompetensi")}</h3>
            <div className="space-y-3">
              {result.results.map((r) => (
                <div key={r.competencyCode}>
                  <div className="flex justify-between text-sm mb-1.5">
                    <span className="font-medium" style={{ color: "var(--text-2)" }}>{r.name}</span>
                    <span className={r.passed ? "text-emerald-400" : "text-red-400"}>{r.score}% {r.passed ? "✓" : "✗"}</span>
                  </div>
                  <div className="h-2 rounded-full overflow-hidden" style={{ background: "var(--bg-muted)" }}>
                    <div className={`h-full rounded-full ${r.passed ? "bg-emerald-500" : "bg-red-500"}`} style={{ width: `${r.score}%` }} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="flex gap-3">
          {isUnit ? (
            <>
              <button onClick={backToList} className="btn-outline flex-1 flex items-center justify-center gap-1"><ArrowLeft className="w-4 h-4" /> {t("Daftar Unit")}</button>
              <button onClick={retakeUnit} className="btn-primary flex-1 flex items-center justify-center gap-1"><RotateCcw className="w-4 h-4" /> {t("Ujian Ulang")}</button>
            </>
          ) : (
            <>
              <Link to="/app/skill-gap" className="btn-primary flex-1 py-2.5 inline-flex items-center justify-center gap-2">{t("Lihat Skill Gap")} <ArrowRight size={16} /></Link>
              <button onClick={restartLegacy} className="btn-outline flex-1">{t("Ujian Ulang")}</button>
            </>
          )}
        </div>
      </div>
    );
  }

  // ── Pengerjaan soal ─────────────────────────────────────────────────────────
  return (
    <div className="max-w-2xl mx-auto space-y-4">
      {unitMode && (
        <button onClick={backToList} className="text-xs flex items-center gap-1 hover:underline" style={{ color: "var(--text-4)" }}>
          <ArrowLeft className="w-3.5 h-3.5" /> {t("Kembali ke daftar unit")}
        </button>
      )}
      <div className="card p-4 flex items-center gap-4">
        <div className="flex-1">
          <div className="flex justify-between text-xs mb-1.5" style={{ color: "var(--text-4)" }}>
            <span>{unitMode ? examData?.unitTitle?.slice(0, 40) : t("Soal {a}/{b}", { a: current + 1, b: questions.length })}</span>
            <span>{t("{n} dijawab", { n: answered })}</span>
          </div>
          <div className="h-1.5 rounded-full overflow-hidden" style={{ background: "var(--bg-muted)" }}>
            <div className="h-full bg-brand-600 rounded-full transition-all" style={{ width: `${questions.length ? ((current + 1) / questions.length) * 100 : 0}%` }} />
          </div>
        </div>
        {examData && <Timer seconds={timeLimit} onDone={() => submit.mutate()} />}
      </div>

      {q && (
        <div className="card p-6">
          <div className="flex items-center gap-2 mb-3">
            <span className="text-xs text-brand-500 font-semibold">{t("Unit:")} {q.competencyName || q.competencyCode}</span>
            <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${QTYPE[q.type]?.cls || QTYPE.mc.cls}`}>{t(QTYPE[q.type]?.label || "Pilihan Ganda")}</span>
          </div>
          <h3 className="text-lg font-semibold mb-6" style={{ color: "var(--text-base)" }}>{q.question}</h3>

          {q.type === "mc" || !q.type ? (
            <div className="space-y-3">
              {q.options.map((opt, i) => {
                const selected = answers[q.id] === i;
                return (
                  <button key={i} onClick={() => setAnswers((a) => ({ ...a, [q.id]: i }))}
                    className={`w-full text-left p-4 rounded-xl border text-sm font-medium transition-all ${selected ? "bg-brand-600/20 border-brand-500" : "hover:border-slate-500"}`}
                    style={selected ? { color: "var(--text-base)" } : { background: "var(--bg-raised)", borderColor: "var(--border)", color: "var(--text-2)" }}>
                    <span className={`inline-flex w-7 h-7 rounded-lg items-center justify-center mr-3 text-xs font-bold ${selected ? "bg-brand-600 text-white" : ""}`}
                      style={selected ? {} : { background: "var(--bg-muted)", color: "var(--text-4)" }}>
                      {String.fromCharCode(65 + i)}
                    </span>
                    {opt}
                  </button>
                );
              })}
            </div>
          ) : (
            <div>
              <p className="text-xs mb-2" style={{ color: "var(--text-4)" }}>
                {q.type === "steporder"
                  ? t("Tuliskan tahapan/urutan pengerjaan yang menurutmu paling efisien. AI menilai logika & efisiensinya.")
                  : t("Jawab dengan penjelasanmu sendiri. AI menilai penalaran, ketepatan, & kelengkapan.")}
              </p>
              <textarea
                value={typeof answers[q.id] === "string" ? answers[q.id] : ""}
                onChange={(e) => setAnswers((a) => ({ ...a, [q.id]: e.target.value }))}
                placeholder={q.type === "steporder" ? "1. …\n2. …\n3. …" : t("Tulis jawabanmu di sini…")}
                className="input text-sm h-40 resize-y leading-relaxed"
              />
              <p className="text-[11px] mt-1 text-right" style={{ color: "var(--text-4)" }}>{t("{n} karakter", { n: (typeof answers[q.id] === "string" ? answers[q.id] : "").trim().length })}</p>
            </div>
          )}
        </div>
      )}

      <div className="flex gap-3">
        <button onClick={() => setCurrent((c) => Math.max(0, c - 1))} disabled={current === 0} className="btn-outline flex-1 inline-flex items-center justify-center gap-2"><ArrowLeft size={16} /> {t("Sebelumnya")}</button>
        {current < questions.length - 1 ? (
          <button onClick={() => setCurrent((c) => c + 1)} className="btn-primary flex-1 inline-flex items-center justify-center gap-2">{t("Berikutnya")} <ArrowRight size={16} /></button>
        ) : (
          <button onClick={() => submit.mutate()} disabled={submit.isPending} className="btn-primary flex-1 bg-emerald-600 hover:bg-emerald-700">
            {submit.isPending ? t("Mengirim…") : t("Submit ({a}/{b})", { a: answered, b: questions.length })}
          </button>
        )}
      </div>

      <div className="flex flex-wrap gap-1.5 justify-center">
        {questions.map((q2, i) => {
          const done = isAnswered(q2, answers[q2.id]);
          return (
            <button key={i} onClick={() => setCurrent(i)}
              className={`w-7 h-7 rounded-lg text-xs font-bold transition-all ${i === current ? "bg-brand-600 text-white" : done ? "bg-emerald-600/30 text-emerald-400" : ""}`}
              style={i === current || done ? {} : { background: "var(--bg-muted)", color: "var(--text-4)" }}>
              {i + 1}
            </button>
          );
        })}
      </div>
    </div>
  );
}
