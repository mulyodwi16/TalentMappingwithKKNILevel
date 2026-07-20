import { useMemo } from "react";
import { createPortal } from "react-dom";
import { ArrowLeft, ArrowRight, CheckCircle2, Loader2, X, Lock, Timer } from "lucide-react";
import { useLang } from "../lib/i18n.jsx";

const mmss = (s) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;

// Pelari ujian bersama untuk Tes Penempatan & Ujian Kompetensi Utama.
//
// Dirender lewat portal ke <body>: kalau tetap di dalam pohon halaman, dia terkurung di
// konteks penumpukan .page-enter (animasi opacity) sehingga z-index-nya tak bisa menang
// atas Topbar. Pola yang sama dipakai pop-up Bantuan.
export default function ExamRunner({
  title, subtitle, questions, answers, setAnswers, step, setStep,
  remaining, submitting, onSubmit, onAbandon, essayNote,
}) {
  const { t } = useLang();

  // Soal dikelompokkan per unit: satu unit per layar (2 soal).
  const groups = useMemo(() => {
    const map = new Map();
    for (const q of questions || []) {
      const g = map.get(q.unitCode) || { unitCode: q.unitCode, unitTitle: q.unitTitle, items: [] };
      g.items.push(q);
      map.set(q.unitCode, g);
    }
    return [...map.values()];
  }, [questions]);

  if (!groups.length) return null;
  const g = groups[Math.min(step, groups.length - 1)];
  const last = step >= groups.length - 1;
  const answered = g.items.filter((q) => {
    const v = answers[q.index];
    return q.type === "mc" ? v != null : String(v || "").trim().length > 0;
  }).length;

  return createPortal(
    <div className="is-modal fixed inset-0 z-[60] overflow-y-auto" style={{ background: "var(--bg-page)" }}>
      <div className="max-w-3xl mx-auto p-4 sm:p-6 space-y-4">
        <div className="card p-4">
          <div className="flex items-center justify-between gap-3 mb-2">
            <div className="min-w-0">
              <p className="text-sm font-semibold truncate" style={{ color: "var(--text-base)" }}>{title}</p>
              <p className="text-[11px] flex items-center gap-1" style={{ color: "var(--text-4)" }}>
                <Lock className="w-3 h-3" /> {subtitle || t("Mode ujian - menu lain dikunci sampai selesai")}
              </p>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              {remaining != null && (
                // Di bawah 5 menit warnanya berubah jadi peringatan.
                <span className={`text-sm font-bold tabular-nums flex items-center gap-1 ${remaining <= 300 ? "text-amber-500" : ""}`}
                  style={remaining <= 300 ? {} : { color: "var(--text-3)" }}>
                  <Timer className="w-4 h-4" /> {mmss(remaining)}
                </span>
              )}
              <span className="text-xs hidden sm:inline" style={{ color: "var(--text-4)" }}>
                {t("Unit {a} dari {b}", { a: step + 1, b: groups.length })}
              </span>
              <button onClick={onAbandon} className="icon-btn" title={t("Keluar dari tes")}><X className="w-4 h-4" /></button>
            </div>
          </div>
          <div className="h-1.5 w-full rounded-full overflow-hidden" style={{ background: "var(--bg-raised)" }}>
            <div className="h-full rounded-full bg-brand-500 transition-all" style={{ width: `${((step + 1) / groups.length) * 100}%` }} />
          </div>
        </div>

        <div className="card p-6 space-y-5">
          <div>
            <p className="text-[11px] uppercase tracking-wide" style={{ color: "var(--text-4)" }}>{t("Unit kompetensi")}</p>
            <h3 className="font-bold" style={{ color: "var(--text-base)" }}>{g.unitTitle}</h3>
          </div>

          {g.items.map((q, qi) => (
            <div key={q.index} className="space-y-2">
              <p className="text-sm font-medium" style={{ color: "var(--text-base)" }}>{qi + 1}. {q.q}</p>
              {q.type === "mc" ? (
                <div className="grid grid-cols-1 gap-1.5">
                  {q.options.map((opt, oi) => (
                    <button key={oi} onClick={() => setAnswers((a) => ({ ...a, [q.index]: oi }))}
                      className={`text-left text-sm rounded-lg px-3 py-2 transition-colors ${answers[q.index] === oi ? "bg-brand-600 text-white" : "hover:bg-brand-500/10"}`}
                      style={answers[q.index] === oi ? {} : { border: "1px solid var(--border-2)", color: "var(--text-2)" }}>
                      {String.fromCharCode(65 + oi)}. {opt}
                    </button>
                  ))}
                </div>
              ) : (
                <>
                  <textarea value={answers[q.index] || ""} onChange={(e) => setAnswers((a) => ({ ...a, [q.index]: e.target.value }))}
                    rows={4} className="input text-sm w-full" placeholder={t("Tulis jawabanmu berdasarkan pengalaman kerja nyata…")} />
                  <p className="text-[11px]" style={{ color: "var(--text-4)" }}>
                    {essayNote || t("Tidak harus lengkap. Yang dinilai pemahaman konteksnya, boleh dengan bahasamu sendiri.")}
                  </p>
                </>
              )}
            </div>
          ))}

          <p className="text-[11px]" style={{ color: "var(--text-4)" }}>
            {answered < g.items.length
              ? t("Boleh dikosongkan kalau memang belum menguasai - hasilnya jadi acuan belajar.")
              : t("Semua soal unit ini sudah dijawab.")}
          </p>

          <div className="flex items-center gap-2 pt-1">
            <button onClick={() => setStep((s) => Math.max(0, s - 1))} disabled={step === 0}
              className="btn-outline py-2 px-3 text-sm flex items-center gap-1.5 disabled:opacity-40">
              <ArrowLeft className="w-4 h-4" /> {t("Sebelumnya")}
            </button>
            {last ? (
              <button onClick={onSubmit} disabled={submitting}
                className="btn-primary flex-1 py-2.5 text-sm flex items-center justify-center gap-2 disabled:opacity-70">
                {submitting ? <><Loader2 className="w-4 h-4 animate-spin" /> {t("Menilai jawaban…")}</> : <><CheckCircle2 className="w-4 h-4" /> {t("Kumpulkan Jawaban")}</>}
              </button>
            ) : (
              <button onClick={() => setStep((s) => Math.min(groups.length - 1, s + 1))}
                className="btn-primary flex-1 py-2.5 text-sm flex items-center justify-center gap-1.5">
                {t("Berikutnya")} <ArrowRight className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}
