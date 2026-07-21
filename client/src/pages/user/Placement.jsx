import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate } from "react-router-dom";
import toast from "react-hot-toast";
import {
  Target, Loader2, CheckCircle2, AlertTriangle, Sparkles, RotateCcw, MessageSquareQuote, Lock, Coins,
} from "lucide-react";
import api from "../../api/client.js";
import { rankName, rankColor } from "../../lib/rank.js";
import RankIcon from "../../components/RankIcon.jsx";
import ExamRunner from "../../components/ExamRunner.jsx";
import useExamStore from "../../store/examStore.js";
import { useLang, getLang, dateLocale } from "../../lib/i18n.jsx";

const fmtDate = (d) => (d ? new Date(d).toLocaleDateString(dateLocale(getLang()), { day: "numeric", month: "short", year: "numeric" }) : "-");

// Tes Penempatan: mengukur kemampuan awal supaya Skill Gap tidak kosong dan user tidak
// perlu mengulang unit yang sudah dikuasai. TIDAK menerbitkan sertifikat.
export default function Placement() {
  const { t } = useLang();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const { lockExam, unlockExam } = useExamStore();
  const [session, setSession] = useState(null);   // {competencyTitle, questions[]}
  const [answers, setAnswers] = useState({});
  const [step, setStep] = useState(0);            // indeks unit yang sedang dikerjakan
  const [result, setResult] = useState(null);
  const [remaining, setRemaining] = useState(null); // detik tersisa (dari tenggat server)

  const { data: status, isLoading } = useQuery({ queryKey: ["placement"], queryFn: () => api.get("/skkni/placement") });

  // Selama tes berlangsung: cegah menutup/refresh tab tanpa sadar, dan pastikan
  // kunci selalu terlepas kalau komponen dilepas (mis. logout paksa).
  useEffect(() => {
    if (!session) return;
    const warn = (e) => { e.preventDefault(); e.returnValue = ""; };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [session]);
  useEffect(() => () => unlockExam(), [unlockExam]);

  // Hitung mundur dari tenggat SERVER (bukan durasi yang dihitung ulang di klien), supaya
  // refresh di tengah tes melanjutkan sisa waktu. Habis waktu → kumpulkan otomatis sekali.
  useEffect(() => {
    if (!session?.expiresAt) { setRemaining(null); return; }
    const deadline = new Date(session.expiresAt).getTime();
    const tick = () => setRemaining(Math.max(0, Math.round((deadline - Date.now()) / 1000)));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [session]);

  useEffect(() => {
    if (remaining !== 0 || !session || submit.isPending || submit.isSuccess) return;
    toast(t("Waktu habis. Jawabanmu dikumpulkan otomatis."));
    submit.mutate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [remaining, session]);

  const start = useMutation({
    mutationFn: () => api.post("/skkni/placement/start"),
    onSuccess: (d) => { setSession(d); setAnswers({}); setStep(0); setResult(null); lockExam(t("Tes Penempatan")); },
    onError: (e) => toast.error(typeof e === "string" ? e : t("Gagal memulai tes")),
  });

  const unlock = useMutation({
    mutationFn: () => api.post("/skkni/placement/unlock"),
    onSuccess: (d) => {
      toast.success(t("Tes Penempatan terbuka lagi. Sisa kesempatan: {n}.", { n: d.attemptsLeft }));
      qc.invalidateQueries({ queryKey: ["placement"] });
      qc.invalidateQueries({ queryKey: ["overview"] });
      qc.invalidateQueries({ queryKey: ["coins"] });
    },
    onError: (e) => toast.error(typeof e === "string" ? e : t("Saldo Koin belum cukup.")),
  });

  const submit = useMutation({
    mutationFn: () => api.post("/skkni/placement/submit", { answers }),
    onSuccess: (d) => {
      setResult(d);
      setSession(null);
      unlockExam();
      qc.invalidateQueries({ queryKey: ["placement"] });
      qc.invalidateQueries({ queryKey: ["overview"] });
      qc.invalidateQueries({ queryKey: ["skill-assessments"] });
      qc.invalidateQueries({ queryKey: ["learning-path"] });
    },
    onError: (e) => toast.error(typeof e === "string" ? e : t("Gagal mengumpulkan jawaban")),
  });

  function abandon() {
    if (!window.confirm(t("Keluar dari tes? Jawaban yang sudah kamu isi akan hilang."))) return;
    setSession(null);
    setAnswers({});
    unlockExam();
  }

  if (isLoading) {
    return <div className="max-w-3xl mx-auto"><div className="card p-10 text-center"><Loader2 className="w-6 h-6 animate-spin mx-auto text-brand-500" /></div></div>;
  }

  // ── Sedang mengerjakan: overlay layar penuh (ExamRunner) ──
  if (session?.questions?.length) {
    return (
      <ExamRunner
        title={session.competencyTitle}
        questions={session.questions}
        answers={answers}
        setAnswers={setAnswers}
        step={step}
        setStep={setStep}
        remaining={remaining}
        submitting={submit.isPending}
        onSubmit={() => submit.mutate()}
        onAbandon={abandon}
      />
    );
  }

  // ── Hasil ──
  if (result) {
    return (
      <div className="max-w-3xl mx-auto space-y-4">
        <div className="card p-6 text-center flex flex-col items-center gap-2">
          <div className="w-12 h-12 rounded-2xl flex items-center justify-center" style={{ background: "var(--bg-raised)" }}>
            <CheckCircle2 className="w-6 h-6 text-emerald-500" />
          </div>
          <h2 className="text-xl font-bold" style={{ color: "var(--text-base)" }}>{t("Tes Penempatan selesai")}</h2>
          <p className="text-sm" style={{ color: "var(--text-3)" }}>
            {t("Skor rata-rata {n}%, {a} dari {b} unit sudah kamu kuasai.", { n: result.score, a: result.passedUnits, b: result.unitCount })}
          </p>
          {result.rank && (
            <div className="flex items-center gap-2 pt-1">
              <RankIcon level={result.rank.effective} size={34} />
              <span className="font-bold" style={{ color: rankColor(result.rank.effective) }}>{rankName(result.rank.effective)}</span>
            </div>
          )}
          <p className="text-xs" style={{ color: "var(--text-4)" }}>{t("Tes ini tidak menerbitkan sertifikat. Sertifikat hanya dari ujian kompetensi utama.")}</p>
        </div>

        <AiReview text={result.review} t={t} />
        <UnitScores title={t("Hasil per unit")} rows={result.breakdown} t={t} />

        <div className="flex flex-wrap gap-2">
          <button onClick={() => navigate("/app/skill-gap")} className="btn-primary text-sm flex items-center gap-1.5"><Target className="w-4 h-4" /> {t("Lihat Skill Gap")}</button>
          <Link to="/app/learning-path" className="btn-outline text-sm flex items-center gap-1.5"><Sparkles className="w-4 h-4" /> {t("Susun Learning Path")}</Link>
        </div>
      </div>
    );
  }

  // ── Pengantar / ringkasan hasil sebelumnya ──
  const blocked = !status?.available;
  return (
    <div className="max-w-3xl mx-auto space-y-4">
      <div>
        <h2 className="text-xl font-bold" style={{ color: "var(--text-base)" }}>{t("Tes Penempatan")}</h2>
        <p className="text-sm mt-1" style={{ color: "var(--text-4)" }}>
          {t("Semacam ujian percepatan: kalau kamu sudah punya pengalaman, kemampuan yang sudah dikuasai langsung diakui supaya kamu lanjut mengembangkan skill, bukan mengulang dari awal.")}
        </p>
      </div>

      {blocked ? (
        <div className="card p-6 flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-semibold" style={{ color: "var(--text-base)" }}>{t("Belum bisa dimulai")}</p>
            <p className="text-sm mt-1" style={{ color: "var(--text-3)" }}>
              {status?.reason === "no-competency"
                ? t("Pilih kompetensi target dulu di Profil.")
                : status?.reason === "no-units"
                  ? t("Kompetensi ini belum punya rincian skill, jadi tes belum bisa disusun.")
                  : t("Penyusun soal sedang tidak tersedia. Coba lagi nanti.")}
            </p>
            {status?.reason === "no-competency" && (
              <Link to="/app/profile?pick=1" className="btn-primary text-sm inline-flex mt-3">{t("Pilih Kompetensi")}</Link>
            )}
          </div>
        </div>
      ) : (
        <>
          <div className="card p-6 space-y-3">
            <p className="text-sm" style={{ color: "var(--text-3)" }}>
              {t("Kamu akan mengerjakan 2 soal untuk tiap unit kompetensi: satu pilihan ganda dan satu uraian singkat berbasis kasus kerja. Soalnya sengaja dibuat menantang supaya hasilnya jujur.")}
            </p>
            <ul className="text-sm space-y-1.5" style={{ color: "var(--text-3)" }}>
              <li>{t("Unit yang kamu kuasai (nilai 60 ke atas) boleh kamu lewati, tapi tetap bisa dipelajari ulang kapan saja.")}</li>
              <li>{t("Hasilnya mengisi Skill Gap dan jadi acuan Learning Path.")}</li>
              <li>{t("Waktumu {n} menit, dihitung {m} menit per unit. Sisa waktu tetap berjalan walau halaman ditutup.", {
                n: (status?.unitCount || 0) * (status?.minutesPerUnit || 3), m: status?.minutesPerUnit || 3,
              })}</li>
              <li>{t("Selama tes berlangsung, menu lain dan AI Mentor dikunci supaya kamu fokus.")}</li>
              <li>{t("Tes ini tidak menerbitkan sertifikat. Sertifikat hanya dari ujian kompetensi utama.")}</li>
              <li>{t("Ini pengukuran baseline, bukan latihan berulang. Kamu punya {n} kali kesempatan; sesudahnya bisa dibuka lagi dengan Koin. Untuk berlatih terus, pakai Latihan Unit.", { n: status?.freeAttempts || 2 })}</li>
            </ul>
            <p className="text-xs" style={{ color: "var(--text-4)" }}>
              {status?.capped
                ? t("Kompetensi: {title}. Dari {total} unit, tes memilih {n} yang mewakili dari dasar sampai lanjutan supaya tetap ringkas.", { title: status?.competencyTitle || "-", total: status?.totalUnits || 0, n: status?.unitCount || 0 })
                : t("Kompetensi: {title} - {n} unit", { title: status?.competencyTitle || "-", n: status?.unitCount || 0 })}
            </p>

            {status?.locked ? (
              <div className="rounded-xl p-4 space-y-2" style={{ background: "var(--bg-raised)", border: "1px solid var(--border)" }}>
                <p className="text-sm font-semibold flex items-center gap-2" style={{ color: "var(--text-base)" }}>
                  <Lock className="w-4 h-4 text-amber-500" /> {t("Kesempatan tes penempatan sudah habis")}
                </p>
                <p className="text-xs" style={{ color: "var(--text-4)" }}>
                  {t("Baseline-mu sudah tercatat di bawah. Untuk mengukur ulang, buka satu kesempatan lagi dengan {c} Koin. Koin dikumpulkan dari login harian dan aktivitas belajar.", { c: status?.unlockCost || 400 })}
                </p>
                <div className="flex flex-wrap items-center gap-2 pt-0.5">
                  <button onClick={() => unlock.mutate()} disabled={unlock.isPending}
                    className="btn-primary text-sm flex items-center gap-2 disabled:opacity-70">
                    {unlock.isPending
                      ? <><Loader2 className="w-4 h-4 animate-spin" /> {t("Membuka…")}</>
                      : <><Coins className="w-4 h-4" /> {t("Buka lagi - {c} Koin", { c: status?.unlockCost || 400 })}</>}
                  </button>
                  <Link to="/app/toko" className="text-xs text-brand-500 hover:underline">{t("Kumpulkan Koin di Toko")}</Link>
                </div>
              </div>
            ) : (
              <>
                <button onClick={() => start.mutate()} disabled={start.isPending}
                  className="btn-primary text-sm flex items-center gap-2 disabled:opacity-70">
                  {start.isPending
                    ? <><Loader2 className="w-4 h-4 animate-spin" /> {t("Menyusun soal…")}</>
                    : <><Target className="w-4 h-4" /> {status?.taken ? t("Ulangi Tes Penempatan") : t("Mulai Tes Penempatan")}</>}
                </button>
                <p className="text-xs" style={{ color: "var(--text-4)" }}>
                  {start.isPending
                    ? t("Penyusunan soal pertama kali bisa memakan waktu sekitar satu menit, setelah itu tersimpan.")
                    : t("Sisa kesempatan: {n} kali.", { n: status?.attemptsLeft ?? 2 })}
                </p>
              </>
            )}
          </div>

          {status?.taken && (
            <>
              <div className="card p-4 flex items-center gap-3">
                <RotateCcw className="w-4 h-4 text-brand-500 shrink-0" />
                <p className="text-sm" style={{ color: "var(--text-3)" }}>
                  {t("Terakhir diambil {d}: skor {n}%, {a} dari {b} unit dikuasai.", {
                    d: fmtDate(status.taken.takenAt), n: status.taken.score, a: status.taken.passedUnits, b: status.taken.unitCount,
                  })}
                </p>
              </div>
              <AiReview text={status.taken.review} t={t} />
              <UnitScores title={t("Baseline saat ini")} rows={status.taken.breakdown} t={t} />
            </>
          )}
        </>
      )}
    </div>
  );
}

// Ulasan menyeluruh dari AI atas hasil tes.
function AiReview({ text, t }) {
  if (!text) return null;
  return (
    <div className="card p-5" style={{ borderLeft: "3px solid rgb(var(--brand-500))" }}>
      <h3 className="font-semibold flex items-center gap-2 mb-2" style={{ color: "var(--text-base)" }}>
        <MessageSquareQuote className="w-4 h-4 text-brand-500" /> {t("Ulasan AI")}
      </h3>
      <p className="text-sm leading-relaxed" style={{ color: "var(--text-3)" }}>{text}</p>
    </div>
  );
}

function UnitScores({ title, rows, t }) {
  if (!rows?.length) return null;
  return (
    <div className="card p-5">
      <h3 className="font-semibold mb-3" style={{ color: "var(--text-base)" }}>{title}</h3>
      <div className="space-y-3">
        {rows.map((b) => {
          const ok = b.score >= 60;
          return (
            <div key={b.unitCode}>
              <div className="flex items-center gap-3">
                <div className="min-w-0 flex-1">
                  <p className="text-sm truncate" style={{ color: "var(--text-2)" }}>{b.unitTitle}</p>
                  <div className="h-1.5 mt-1 rounded-full overflow-hidden" style={{ background: "var(--bg-raised)" }}>
                    <div className="h-full rounded-full" style={{ width: `${b.score}%`, background: ok ? "#10b981" : "rgb(var(--brand-500))" }} />
                  </div>
                </div>
                <span className="text-sm font-bold tabular-nums w-14 text-right" style={{ color: ok ? "#10b981" : "var(--text-3)" }}>
                  {b.score}%
                </span>
                <span className="text-[11px] w-20 text-right" style={{ color: "var(--text-4)" }}>
                  {ok ? t("dikuasai") : t("perlu belajar")}
                </span>
              </div>
              {(b.feedback || b.mcCorrect != null) && (
                <p className="text-[11px] mt-1 pl-0.5" style={{ color: "var(--text-4)" }}>
                  {b.mcCorrect != null && (
                    <span style={{ color: b.mcCorrect ? "#10b981" : "#ef4444" }}>
                      {b.mcCorrect ? t("Pilihan ganda benar") : t("Pilihan ganda salah")}
                    </span>
                  )}
                  {b.feedback && <>{b.mcCorrect != null ? " - " : ""}{b.feedback}</>}
                </p>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
