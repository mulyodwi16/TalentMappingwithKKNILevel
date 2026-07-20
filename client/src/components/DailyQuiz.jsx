import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { CalendarCheck, Loader2, CheckCircle2, XCircle, Coins, Sparkles, X } from "lucide-react";
import toast from "react-hot-toast";
import api from "../api/client.js";
import { useCoins } from "../hooks/useCoins.js";
import { useLang } from "../lib/i18n.jsx";

// Course Harian: kuis singkat (soal digenerate AI dari kompetensi, beda tiap hari).
// Menyelesaikannya menandai misi harian & memberi Koin.
// Soalnya tampil sebagai POP-UP di tengah layar, bukan panel yang memuai di dalam kartu -
// panel yang memuai mendorong seluruh isi Dashboard turun dan bikin halaman melompat.
export default function DailyQuiz() {
  const { t } = useLang();
  const [quiz, setQuiz] = useState(null);
  const [answers, setAnswers] = useState({});
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [open, setOpen] = useState(false);
  const { setBalance, refresh } = useCoins();

  async function load() {
    setLoading(true);
    try { setQuiz(await api.get("/missions/quiz")); }
    catch (e) { toast.error(typeof e === "string" ? e : t("Gagal memuat course harian")); }
    finally { setLoading(false); }
  }
  useEffect(() => { load(); }, []);

  // Esc menutup pop-up (kecuali saat jawaban sedang dikirim).
  useEffect(() => {
    if (!open) return;
    const onKey = (e) => { if (e.key === "Escape" && !submitting) setOpen(false); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, submitting]);

  async function submit() {
    if (submitting) return;
    if (Object.keys(answers).length < (quiz?.questions?.length || 0)) { toast.error(t("Jawab semua soal dulu")); return; }
    setSubmitting(true);
    try {
      const d = await api.post("/missions/quiz/submit", { answers });
      setResult(d);
      if (d.coin?.awarded > 0) { setBalance(d.coin.balance); toast.success(t("+{n} Koin!", { n: d.coin.awarded })); }
      else toast.success(t("Skor kamu {a}/{b}", { a: d.score, b: d.total }));
      refresh();
    } catch (e) {
      toast.error(typeof e === "string" ? e : t("Gagal submit"));
    } finally { setSubmitting(false); }
  }

  const done = quiz?.completed || result;
  const topic = quiz?.competency ? t("Topik hari ini: {topic}", { topic: quiz.competency }) : t("Kuis singkat harian");

  const modal = open && (
    <div className="is-modal fixed inset-0 z-[60] flex items-center justify-center p-4" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={submitting ? undefined : () => setOpen(false)} />
      <div className="relative w-full max-w-lg rounded-2xl shadow-2xl overflow-hidden max-h-[90vh] flex flex-col"
        style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }}>

        <div className="flex items-start justify-between gap-3 px-5 py-4 bg-gradient-to-r from-amber-400 to-orange-500 text-white shrink-0">
          <div className="min-w-0">
            <p className="text-sm font-bold flex items-center gap-1.5">
              <CalendarCheck className="w-4 h-4" /> {t("Course Harian")}
            </p>
            <p className="text-xs text-white/80 mt-0.5 truncate">{topic}</p>
          </div>
          <button onClick={() => !submitting && setOpen(false)} disabled={submitting}
            className="p-1 rounded-lg hover:bg-white/20 transition-colors disabled:opacity-50 shrink-0" aria-label={t("Tutup")}>
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="overflow-y-auto p-5 space-y-4">
          {!result && quiz?.questions?.map((q) => (
            <div key={q.id}>
              <p className="text-sm font-medium mb-2" style={{ color: "var(--text-base)" }}>{q.id + 1}. {q.q}</p>
              <div className="grid gap-1.5">
                {q.options.map((opt, oi) => (
                  <button
                    key={oi}
                    onClick={() => setAnswers((a) => ({ ...a, [q.id]: oi }))}
                    className={`text-left text-sm rounded-lg px-3 py-2 transition-colors ${answers[q.id] === oi ? "bg-brand-600 text-white" : "hover:bg-brand-500/10"}`}
                    style={answers[q.id] === oi ? {} : { border: "1px solid var(--border-2)", color: "var(--text-2)" }}
                  >
                    {String.fromCharCode(65 + oi)}. {opt}
                  </button>
                ))}
              </div>
            </div>
          ))}

          {result && (
            <>
              <div className="rounded-xl p-4 text-center" style={{ backgroundColor: "var(--bg-raised)" }}>
                <p className="text-3xl font-black text-brand-600">{result.score}/{result.total}</p>
                <p className="text-xs" style={{ color: "var(--text-3)" }}>{t("Skor Course Harian ({pct}%)", { pct: result.pct })}</p>
              </div>
              {result.review?.map((r, i) => (
                <div key={i} className="text-sm rounded-lg p-3" style={{ border: "1px solid var(--border)" }}>
                  <p className="font-medium mb-1.5 flex items-start gap-1.5" style={{ color: "var(--text-base)" }}>
                    {r.correct ? <CheckCircle2 className="w-4 h-4 text-emerald-500 mt-0.5 shrink-0" /> : <XCircle className="w-4 h-4 text-red-500 mt-0.5 shrink-0" />}
                    {r.q}
                  </p>
                  <p className="text-xs ml-5" style={{ color: "var(--text-3)" }}>
                    {t("Jawaban benar:")} <b style={{ color: "var(--text-2)" }}>{r.options[r.answerKey]}</b>
                  </p>
                </div>
              ))}
              <p className="text-xs text-center" style={{ color: "var(--text-4)" }}>{t("Soal baru menanti besok - beda dari hari ini 🎯")}</p>
            </>
          )}
        </div>

        <div className="px-5 py-4 shrink-0" style={{ borderTop: "1px solid var(--border)" }}>
          {result ? (
            <button onClick={() => setOpen(false)} className="btn-primary w-full text-sm py-2.5">{t("Tutup")}</button>
          ) : (
            <button onClick={submit} disabled={submitting} className="btn-primary w-full text-sm py-2.5 flex items-center justify-center gap-1.5">
              {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Coins className="w-4 h-4" />} {t("Kumpulkan Jawaban")}
            </button>
          )}
        </div>
      </div>
    </div>
  );

  return (
    <div className="card p-5 border-l-4" style={{ borderLeftColor: "#f59e0b" }}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center text-white shrink-0">
            <CalendarCheck className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-bold flex items-center gap-1.5" style={{ color: "var(--text-base)" }}>
              {t("Course Harian")} <Sparkles className="w-3.5 h-3.5 text-amber-500" />
            </p>
            <p className="text-xs" style={{ color: "var(--text-3)" }}>
              {loading ? t("Menyiapkan soal…") : topic}
              {done && t(" · selesai ✓")}
            </p>
          </div>
        </div>
        {done ? (
          <span className="flex items-center gap-1.5 text-sm font-medium text-emerald-500 shrink-0">
            <CheckCircle2 className="w-4 h-4" /> {t("Selesai")}
          </span>
        ) : (
          <button onClick={() => setOpen(true)} disabled={loading || !quiz?.questions?.length} className="btn-primary text-sm py-2 px-4 shrink-0">
            {t("Mulai")}
          </button>
        )}
      </div>

      {/* Portal ke body: di dalam .page-enter (animasi opacity) pop-up akan terperangkap
          konteks penumpukan & tertimpa Topbar - pola yang sama dengan ExamRunner. */}
      {modal && createPortal(modal, document.body)}
    </div>
  );
}
