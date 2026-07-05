import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Link, useSearchParams } from "react-router-dom";
import toast from "react-hot-toast";
import {
  CheckCircle2, Lock, BookOpen, PlayCircle, RotateCcw, GraduationCap, Award, ArrowLeft, Sparkles,
} from "lucide-react";
import api from "../../api/client.js";

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

// ── Pemilih unit: ujian kini PER UNIT kompetensi ──────────────────────────────
function UnitPicker({ chosen, onPick }) {
  const { data, isLoading } = useQuery({ queryKey: ["kelas-units"], queryFn: () => api.get("/kelas/units") });
  if (isLoading) return <div className="text-center py-10 text-sm" style={{ color: "var(--text-4)" }}>Memuat unit…</div>;
  const units = data?.units || [];
  const s = data?.summary;

  return (
    <div className="max-w-6xl mx-auto space-y-4">
      <div className="card p-5">
        <div className="flex items-center gap-2 mb-1">
          <GraduationCap className="w-5 h-5 text-brand-500" />
          <h2 className="text-lg font-bold" style={{ color: "var(--text-base)" }}>Ujian per Unit Kompetensi</h2>
        </div>
        <p className="text-sm mb-1" style={{ color: "var(--text-3)" }}>{chosen.title}</p>
        <p className="text-xs" style={{ color: "var(--text-4)" }}>
          Tiap unit diuji terpisah dengan jumlah soal berbeda sesuai kompleksitasnya. Selesaikan <b>Kelas</b> unit untuk membuka ujiannya — lulus (≥60%) menerbitkan sertifikat unit.
        </p>
        {s && (
          <div className="flex gap-2 mt-3 flex-wrap text-xs">
            <span className="px-2 py-1 rounded-full bg-emerald-500/15 text-emerald-500">{s.passed} lulus</span>
            <span className="px-2 py-1 rounded-full bg-brand-500/15 text-brand-500">{s.ready} siap ujian</span>
            <span className="px-2 py-1 rounded-full bg-amber-500/15 text-amber-500">{s.learning} belajar</span>
            <span className="px-2 py-1 rounded-full bg-[var(--bg-muted)]" style={{ color: "var(--text-4)" }}>{s.locked} terkunci</span>
          </div>
        )}
      </div>

      {/* Library grid: 2–4 kolom (samping) × n baris (ke bawah) */}
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
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
                <span className={`text-[11px] px-1.5 py-0.5 rounded-full ml-auto shrink-0 ${ui.badge}`}>{ui.label}</span>
              </div>
              <p className="text-sm font-semibold leading-snug line-clamp-3 min-h-[3.6em]" style={{ color: "var(--text-base)" }} title={u.title}>{u.title}</p>
              <div className="flex items-center gap-2 text-[11px]" style={{ color: "var(--text-4)" }}>
                {u.score != null && <span>skor {u.score}%</span>}
                {u.questionCount ? <span>· {u.questionCount} soal</span> : null}
              </div>
              {canExam ? (
                <button onClick={() => onPick(u.code)} className="btn-primary text-xs py-2 w-full flex items-center justify-center gap-1.5 mt-auto">
                  {u.state === "passed" ? <><RotateCcw className="w-3.5 h-3.5" /> Ujian Ulang</> : <><PlayCircle className="w-3.5 h-3.5" /> Mulai Ujian</>}
                </button>
              ) : (
                <Link to="/app/kelas" className="btn-outline text-xs py-2 w-full flex items-center justify-center gap-1.5 mt-auto">
                  <ui.Icon className="w-3.5 h-3.5" /> {u.state === "locked" ? "Buka di Kelas" : "Belajar Dulu"}
                </Link>
              )}
            </div>
          );
        })}
      </div>
      {units.length === 0 && (
        <div className="card p-8 text-center text-sm" style={{ color: "var(--text-4)" }}>
          Belum ada unit. <Link to="/app/profile" className="text-brand-500 hover:underline">Pilih kompetensi SKKNI</Link> dulu.
        </div>
      )}
    </div>
  );
}

export default function Exam() {
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
      ["attempts", "assessments", "profile", "overview", "notifications", "skkni-chosen", "kelas-units", "learning-path", "coins"].forEach((k) => qc.invalidateQueries([k]));
    },
    onError: (err) => toast.error(err || "Gagal submit"),
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
          <h2 className="text-2xl font-bold mb-2" style={{ color: "var(--text-base)" }}>Ujian Kompetensi</h2>
          <p className="text-sm mb-4" style={{ color: "var(--text-3)" }}>Ujian ini menilai kompetensi Anda berdasarkan standar SKKNI.</p>
          <div className="rounded-xl p-3 mb-5 text-sm" style={{ background: "var(--bg-muted)", color: "var(--text-3)" }}>
            Belum memilih kompetensi target. <Link to="/app/profile" className="text-brand-500 font-medium hover:underline">Pilih kompetensi SKKNI</Link> agar ujian menjadi per unit & menerbitkan sertifikat.
          </div>
          <button onClick={() => setStarted(true)} className="btn-primary w-full py-3">Mulai Ujian →</button>
        </div>
      </div>
    );
  }

  if (isLoading) return <div className="flex items-center justify-center h-64" style={{ color: "var(--text-4)" }}>{unitMode ? "Menyiapkan soal unit…" : "Memuat soal…"}</div>;

  if (examError && !result) {
    return (
      <div className="max-w-xl mx-auto card p-8 text-center">
        <div className="text-5xl mb-4">⚠️</div>
        <h2 className="text-xl font-bold mb-2" style={{ color: "var(--text-base)" }}>Ujian belum bisa dimulai</h2>
        <p className="text-sm mb-5" style={{ color: "var(--text-3)" }}>{typeof examError === "string" ? examError : "Gagal memuat soal."}</p>
        <div className="flex gap-3">
          {unitMode ? <Link to="/app/kelas" className="btn-outline flex-1">Ke Kelas</Link> : <Link to="/app/profile" className="btn-outline flex-1">Ke Profil</Link>}
          <button onClick={unitMode ? backToList : restartLegacy} className="btn-primary flex-1">Kembali</button>
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
          <h2 className="text-2xl font-bold mb-1" style={{ color: "var(--text-base)" }}>{isUnit ? "Hasil Ujian Unit" : "Hasil Ujian"}</h2>
          {isUnit && <p className="text-sm mb-1" style={{ color: "var(--text-3)" }}>{result.unitTitle}</p>}
          <p className={`text-4xl font-black mb-2 ${pct >= 80 ? "text-emerald-400" : pct >= 60 ? "text-amber-400" : "text-red-400"}`}>{pct}%</p>
          {isUnit ? (
            <p style={{ color: "var(--text-3)" }}>{result.passed ? "LULUS — sertifikat unit terbit ✓" : "Belum lulus (butuh ≥60%). Tinjau umpan balik AI di bawah."}</p>
          ) : (
            <p style={{ color: "var(--text-3)" }}>{result.status === "ready" ? "Siap Naik Level ✓" : result.status === "in_progress" ? "Dalam Proses" : "Perlu Peningkatan"}</p>
          )}
        </div>

        {isUnit && result.certificate && (
          <div className="card p-5" style={{ borderColor: "rgba(16,185,129,0.3)" }}>
            <p className="text-sm font-semibold text-emerald-500 flex items-center gap-1.5 mb-2"><Award className="w-4 h-4" /> Sertifikat unit terbit</p>
            <span className="text-xs bg-emerald-500/10 text-emerald-500 border border-emerald-500/30 rounded-lg px-2.5 py-1 inline-block">{result.certificate}</span>
            <Link to="/app/profile" className="block mt-3 text-xs text-brand-500 hover:underline">Lihat & unduh sertifikat di Profil →</Link>
          </div>
        )}

        {/* Rincian penilaian per soal (MC otomatis, isian/urutan dinilai AI) */}
        {isUnit && result.breakdown?.length > 0 && (
          <div className="card p-6">
            <h3 className="font-semibold mb-4" style={{ color: "var(--text-base)" }}>Penilaian per Soal</h3>
            <div className="space-y-3">
              {result.breakdown.map((b, i) => (
                <div key={i} className="rounded-lg p-3" style={{ background: "var(--bg-raised)", border: "1px solid var(--border)" }}>
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${QTYPE[b.type]?.cls || QTYPE.mc.cls}`}>{QTYPE[b.type]?.label || "Pilihan Ganda"}</span>
                      <p className="text-sm mt-1" style={{ color: "var(--text-2)" }}>{b.question}</p>
                    </div>
                    <span className={`text-sm font-bold shrink-0 ${b.score >= 60 ? "text-emerald-500" : b.score > 0 ? "text-amber-500" : "text-red-400"}`}>{b.score}%</span>
                  </div>
                  {b.feedback && <p className="text-xs mt-1.5 flex gap-1" style={{ color: "var(--text-4)" }}><Sparkles className="w-3 h-3 text-brand-500 shrink-0 mt-0.5" /> {b.feedback}</p>}
                </div>
              ))}
            </div>
          </div>
        )}

        {!isUnit && result.certificates?.length > 0 && (
          <div className="card p-5" style={{ borderColor: "rgba(16,185,129,0.3)" }}>
            <p className="text-sm font-semibold text-emerald-500 mb-2">🎓 Sertifikat terbit ({result.certificates.length})</p>
            <div className="flex flex-wrap gap-2">{result.certificates.map((c) => <span key={c} className="text-xs bg-emerald-500/10 text-emerald-500 border border-emerald-500/30 rounded-lg px-2.5 py-1">{c}</span>)}</div>
          </div>
        )}

        {!isUnit && result.results?.length > 0 && (
          <div className="card p-6">
            <h3 className="font-semibold mb-4" style={{ color: "var(--text-base)" }}>Hasil per Kompetensi</h3>
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
              <button onClick={backToList} className="btn-outline flex-1 flex items-center justify-center gap-1"><ArrowLeft className="w-4 h-4" /> Daftar Unit</button>
              <button onClick={retakeUnit} className="btn-primary flex-1 flex items-center justify-center gap-1"><RotateCcw className="w-4 h-4" /> Ujian Ulang</button>
            </>
          ) : (
            <>
              <Link to="/app/skill-gap" className="btn-primary flex-1 text-center py-2.5">Lihat Skill Gap →</Link>
              <button onClick={restartLegacy} className="btn-outline flex-1">Ujian Ulang</button>
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
          <ArrowLeft className="w-3.5 h-3.5" /> Kembali ke daftar unit
        </button>
      )}
      <div className="card p-4 flex items-center gap-4">
        <div className="flex-1">
          <div className="flex justify-between text-xs mb-1.5" style={{ color: "var(--text-4)" }}>
            <span>{unitMode ? examData?.unitTitle?.slice(0, 40) : `Soal ${current + 1}/${questions.length}`}</span>
            <span>{answered} dijawab</span>
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
            <span className="text-xs text-brand-500 font-semibold">Unit: {q.competencyName || q.competencyCode}</span>
            <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${QTYPE[q.type]?.cls || QTYPE.mc.cls}`}>{QTYPE[q.type]?.label || "Pilihan Ganda"}</span>
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
                  ? "Tuliskan tahapan/urutan pengerjaan yang menurutmu paling efisien. AI menilai logika & efisiensinya."
                  : "Jawab dengan penjelasanmu sendiri. AI menilai penalaran, ketepatan, & kelengkapan."}
              </p>
              <textarea
                value={typeof answers[q.id] === "string" ? answers[q.id] : ""}
                onChange={(e) => setAnswers((a) => ({ ...a, [q.id]: e.target.value }))}
                placeholder={q.type === "steporder" ? "1. …\n2. …\n3. …" : "Tulis jawabanmu di sini…"}
                className="input text-sm h-40 resize-y leading-relaxed"
              />
              <p className="text-[11px] mt-1 text-right" style={{ color: "var(--text-4)" }}>{(typeof answers[q.id] === "string" ? answers[q.id] : "").trim().length} karakter</p>
            </div>
          )}
        </div>
      )}

      <div className="flex gap-3">
        <button onClick={() => setCurrent((c) => Math.max(0, c - 1))} disabled={current === 0} className="btn-outline flex-1">← Sebelumnya</button>
        {current < questions.length - 1 ? (
          <button onClick={() => setCurrent((c) => c + 1)} className="btn-primary flex-1">Berikutnya →</button>
        ) : (
          <button onClick={() => submit.mutate()} disabled={submit.isPending} className="btn-primary flex-1 bg-emerald-600 hover:bg-emerald-700">
            {submit.isPending ? "Mengirim…" : `Submit (${answered}/${questions.length})`}
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
