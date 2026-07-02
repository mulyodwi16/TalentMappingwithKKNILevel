import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import toast from "react-hot-toast";
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
        <circle cx="12" cy="12" r="10" fill="none" stroke={left < 120 ? "#ef4444" : "#2563eb"} strokeWidth="2.5"
          strokeDasharray={62.8} strokeDashoffset={62.8 - (pct / 100) * 62.8} strokeLinecap="round" />
      </svg>
      <span className={`font-mono font-bold text-sm ${left < 120 ? "text-red-400" : "text-white"}`}>
        {m}:{String(s).padStart(2, "0")}
      </span>
    </div>
  );
}

export default function Exam() {
  const qc = useQueryClient();
  const [answers, setAnswers] = useState({});
  const [started, setStarted] = useState(false);
  const [result, setResult] = useState(null);
  const [current, setCurrent] = useState(0);

  const { data: examData, isLoading } = useQuery({
    queryKey: ["exam"],
    queryFn: () => api.get("/user/exam"),
    enabled: started,
  });

  const submit = useMutation({
    mutationFn: () => api.post("/user/exam/submit", { answers }),
    onSuccess: (data) => {
      setResult(data);
      qc.invalidateQueries(["attempts"]);
      qc.invalidateQueries(["assessments"]);
      qc.invalidateQueries(["profile"]);
      qc.invalidateQueries(["notifications"]);
    },
    onError: (err) => toast.error(err || "Gagal submit"),
  });

  const questions = examData?.questions || [];
  const q = questions[current];
  const answered = Object.keys(answers).length;
  const timeLimit = (examData?.timeLimit || 30) * 60;

  if (!started) {
    return (
      <div className="max-w-xl mx-auto">
        <div className="card p-8 text-center">
          <div className="text-5xl mb-4">✎</div>
          <h2 className="text-2xl font-bold text-white mb-2">Ujian Kompetensi</h2>
          <p className="text-slate-400 text-sm mb-6">
            Ujian ini menilai kompetensi Anda berdasarkan standar SKKNI. Pastikan Anda siap sebelum memulai.
          </p>
          <div className="grid grid-cols-3 gap-3 mb-6">
            {[["12", "Soal"], ["30", "Menit"], ["60%", "Ambang Lulus"]].map(([v, l]) => (
              <div key={l} className="bg-slate-900/60 rounded-xl p-3">
                <p className="text-xl font-bold text-white">{v}</p>
                <p className="text-xs text-slate-500">{l}</p>
              </div>
            ))}
          </div>
          <button onClick={() => setStarted(true)} className="btn-primary w-full py-3">Mulai Ujian →</button>
        </div>
      </div>
    );
  }

  if (isLoading) return <div className="flex items-center justify-center h-64 text-slate-400">Memuat soal…</div>;

  if (result) {
    return (
      <div className="max-w-2xl mx-auto space-y-4">
        <div className="card p-8 text-center">
          <div className={`text-6xl mb-4`}>{result.readiness >= 80 ? "🎉" : result.readiness >= 50 ? "📈" : "📚"}</div>
          <h2 className="text-2xl font-bold text-white mb-1">Hasil Ujian</h2>
          <p className={`text-4xl font-black mb-2 ${result.readiness >= 80 ? "text-emerald-400" : result.readiness >= 50 ? "text-amber-400" : "text-red-400"}`}>
            {result.readiness}%
          </p>
          <p className="text-slate-400">{result.status === "ready" ? "Siap Naik Level ✓" : result.status === "in_progress" ? "Dalam Proses Peningkatan" : "Perlu Peningkatan Kompetensi"}</p>
        </div>

        <div className="card p-6">
          <h3 className="font-semibold text-white mb-4">Hasil per Kompetensi</h3>
          <div className="space-y-3">
            {result.results?.map((r) => (
              <div key={r.competencyCode}>
                <div className="flex justify-between text-sm mb-1.5">
                  <span className="text-slate-300 font-medium">{r.name}</span>
                  <span className={r.passed ? "text-emerald-400" : "text-red-400"}>{r.score}% {r.passed ? "✓" : "✗"}</span>
                </div>
                <div className="h-2 bg-slate-700 rounded-full overflow-hidden">
                  <div className={`h-full rounded-full transition-all ${r.passed ? "bg-emerald-500" : "bg-red-500"}`} style={{ width: `${r.score}%` }} />
                </div>
              </div>
            ))}
          </div>
        </div>

        {result.gaps?.length > 0 && (
          <div className="card p-5 border-amber-500/30">
            <p className="text-sm font-semibold text-amber-400 mb-2">Gap Kompetensi Terdeteksi</p>
            <div className="flex flex-wrap gap-2">
              {result.gaps.map((g) => <span key={g.competencyCode} className="badge badge-not-ready">{g.name}</span>)}
            </div>
          </div>
        )}

        <div className="flex gap-3">
          <Link to="/app/skill-gap" className="btn-primary flex-1 text-center py-2.5">Lihat Skill Gap →</Link>
          <button onClick={() => { setResult(null); setAnswers({}); setCurrent(0); setStarted(false); }} className="btn-outline flex-1">Ujian Ulang</button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto space-y-4">
      {/* Header */}
      <div className="card p-4 flex items-center gap-4">
        <div className="flex-1">
          <div className="flex justify-between text-xs text-slate-500 mb-1.5">
            <span>Soal {current + 1} dari {questions.length}</span>
            <span>{answered} dijawab</span>
          </div>
          <div className="h-1.5 bg-slate-700 rounded-full overflow-hidden">
            <div className="h-full bg-brand-600 rounded-full transition-all" style={{ width: `${((current + 1) / questions.length) * 100}%` }} />
          </div>
        </div>
        <Timer seconds={timeLimit} onDone={() => submit.mutate()} />
      </div>

      {/* Question */}
      {q && (
        <div className="card p-6">
          <div className="text-xs text-brand-400 font-semibold mb-3">Kompetensi: {q.competencyCode}</div>
          <h3 className="text-lg font-semibold text-white mb-6">{q.question}</h3>
          <div className="space-y-3">
            {q.options.map((opt, i) => {
              const selected = answers[q.id] === i;
              return (
                <button
                  key={i}
                  onClick={() => setAnswers((a) => ({ ...a, [q.id]: i }))}
                  className={`w-full text-left p-4 rounded-xl border text-sm font-medium transition-all ${
                    selected
                      ? "bg-brand-600/20 border-brand-500 text-white"
                      : "bg-slate-900/50 border-slate-700 text-slate-300 hover:border-slate-500 hover:text-white"
                  }`}
                >
                  <span className={`inline-flex w-7 h-7 rounded-lg items-center justify-center mr-3 text-xs font-bold ${selected ? "bg-brand-600 text-white" : "bg-slate-700 text-slate-400"}`}>
                    {String.fromCharCode(65 + i)}
                  </span>
                  {opt}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Navigation */}
      <div className="flex gap-3">
        <button onClick={() => setCurrent((c) => Math.max(0, c - 1))} disabled={current === 0} className="btn-outline flex-1">← Sebelumnya</button>
        {current < questions.length - 1 ? (
          <button onClick={() => setCurrent((c) => c + 1)} className="btn-primary flex-1">Berikutnya →</button>
        ) : (
          <button
            onClick={() => submit.mutate()}
            disabled={submit.isPending}
            className="btn-primary flex-1 bg-emerald-600 hover:bg-emerald-700"
          >
            {submit.isPending ? "Mengirim…" : `Submit Ujian (${answered}/${questions.length})`}
          </button>
        )}
      </div>

      {/* Question dots */}
      <div className="flex flex-wrap gap-1.5 justify-center">
        {questions.map((q2, i) => (
          <button
            key={i}
            onClick={() => setCurrent(i)}
            className={`w-7 h-7 rounded-lg text-xs font-bold transition-all ${
              i === current ? "bg-brand-600 text-white" :
              answers[q2.id] !== undefined ? "bg-emerald-600/30 text-emerald-400" : "bg-slate-700 text-slate-400 hover:bg-slate-600"
            }`}
          >{i + 1}</button>
        ))}
      </div>
    </div>
  );
}
