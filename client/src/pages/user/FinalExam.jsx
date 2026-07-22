import { useState, useEffect, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import toast from "react-hot-toast";
import { Award, Loader2, CheckCircle2, AlertTriangle, XCircle, MessageSquareQuote } from "lucide-react";
import api, { AI_TIMEOUT, isTimeout } from "../../api/client.js";
import { rankName, rankColor } from "../../lib/rank.js";
import RankIcon from "../../components/RankIcon.jsx";
import ExamRunner from "../../components/ExamRunner.jsx";
import useExamStore from "../../store/examStore.js";
import { useLang, getLang, dateLocale } from "../../lib/i18n.jsx";

const fmtDate = (d) => (d ? new Date(d).toLocaleDateString(dateLocale(getLang()), { day: "numeric", month: "short", year: "numeric" }) : "-");

// Ujian Kompetensi Utama: SATU-SATUNYA penerbit sertifikat, dan sertifikatnya satu per
// kompetensi. Boleh langsung diambil - latihan unit tidak wajib dilewati dulu.
export default function FinalExam() {
  const { t } = useLang();
  const qc = useQueryClient();
  const { lockExam, unlockExam } = useExamStore();
  const [session, setSession] = useState(null);
  const [answers, setAnswers] = useState({});
  const [step, setStep] = useState(0);
  const [result, setResult] = useState(null);
  const [remaining, setRemaining] = useState(null);

  const { data: status, isLoading } = useQuery({ queryKey: ["final-exam"], queryFn: () => api.get("/skkni/final") });

  useEffect(() => {
    if (!session) return;
    const warn = (e) => { e.preventDefault(); e.returnValue = ""; };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [session]);
  useEffect(() => () => unlockExam(), [unlockExam]);

  // Hitung mundur dari tenggat SERVER supaya refresh melanjutkan sisa waktu.
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

  // Sama seperti tes penempatan: penyusunan soal berjalan di LATAR. Server menjawab
  // "preparing" alih-alih menahan permintaan, jadi tak ada lagi pekerjaan yang terlihat gagal
  // hanya karena koneksinya diputus lebih dulu.
  const [preparing, setPreparing] = useState(null);
  const pollRef = useRef(null);
  useEffect(() => () => clearTimeout(pollRef.current), []);

  const start = useMutation({
    mutationFn: () => api.post("/skkni/final/start", {}, { timeout: AI_TIMEOUT }),
    retry: (n, e) => isTimeout(e) && n < 2,
    retryDelay: 4000,
    onSuccess: (d) => {
      if (d?.preparing) {
        setPreparing({ sinceMs: d.elapsedMs || 0, progress: d.progress || null });
        pollRef.current = setTimeout(() => start.mutate(), 4000);
        return;
      }
      setPreparing(null);
      setSession(d); setAnswers({}); setStep(0); setResult(null); lockExam(t("Ujian Kompetensi Utama"));
    },
    onError: (e) => { setPreparing(null); toast.error(typeof e === "string" ? t(e) : t("Gagal memulai ujian")); },
  });
  const menyusun = start.isPending || !!preparing;

  const submit = useMutation({
    mutationFn: () => api.post("/skkni/final/submit", { answers }),
    onSuccess: (d) => {
      setResult(d);
      setSession(null);
      unlockExam();
      qc.invalidateQueries({ queryKey: ["final-exam"] });
      qc.invalidateQueries({ queryKey: ["overview"] });
      qc.invalidateQueries({ queryKey: ["skill-assessments"] });
    },
    onError: (e) => toast.error(typeof e === "string" ? e : t("Gagal mengumpulkan jawaban")),
  });

  function abandon() {
    if (!window.confirm(t("Keluar dari ujian? Jawaban yang sudah kamu isi akan hilang."))) return;
    setSession(null);
    setAnswers({});
    unlockExam();
  }

  if (isLoading) {
    return <div className="max-w-3xl mx-auto"><div className="card p-10 text-center"><Loader2 className="w-6 h-6 animate-spin mx-auto text-brand-500" /></div></div>;
  }

  if (session?.questions?.length) {
    return (
      <ExamRunner
        title={session.competencyTitle}
        subtitle={t("Ujian sertifikasi - menu lain dikunci sampai selesai")}
        questions={session.questions}
        answers={answers}
        setAnswers={setAnswers}
        step={step}
        setStep={setStep}
        remaining={remaining}
        submitting={submit.isPending}
        onSubmit={() => submit.mutate()}
        onAbandon={abandon}
        essayNote={t("Jelaskan pertimbanganmu, bukan cuma langkahnya. Ujian ini menilai cara kamu mengambil keputusan.")}
      />
    );
  }

  // ── Hasil ──
  if (result) {
    const ok = result.passed;
    return (
      <div className="max-w-3xl mx-auto space-y-4">
        <div className="card p-6 text-center flex flex-col items-center gap-2">
          <div className="w-12 h-12 rounded-2xl flex items-center justify-center" style={{ background: "var(--bg-raised)" }}>
            {ok ? <CheckCircle2 className="w-6 h-6 text-emerald-500" /> : <XCircle className="w-6 h-6 text-amber-500" />}
          </div>
          <h2 className="text-xl font-bold" style={{ color: "var(--text-base)" }}>
            {ok ? t("Selamat, kamu lulus!") : t("Belum lulus kali ini")}
          </h2>
          <p className="text-sm" style={{ color: "var(--text-3)" }}>
            {t("Skormu {n}%, ambang lulus {p}%.", { n: result.score, p: result.passScore })}
          </p>
          {result.rank && (
            <div className="flex items-center gap-2 pt-1">
              <RankIcon level={result.rank.effective} size={34} />
              <span className="font-bold" style={{ color: rankColor(result.rank.effective) }}>{rankName(result.rank.effective)}</span>
            </div>
          )}
          <p className="text-xs" style={{ color: "var(--text-4)" }}>
            {ok
              ? t("Sertifikat kompetensimu sudah terbit dan bisa dilihat di Profil.")
              : t("Nilai unitmu tetap tersimpan sebagai bukti penguasaan. Perbaiki unit terlemah, lalu coba lagi.")}
          </p>
          {ok && <Link to="/app/profile" className="btn-primary text-sm mt-1">{t("Lihat Sertifikat")}</Link>}
        </div>

        <AiReview text={result.review} t={t} />
        <UnitScores rows={result.breakdown} t={t} />
      </div>
    );
  }

  // ── Pengantar ──
  const blocked = !status?.available;
  const cert = status?.certificate;
  const minutes = (status?.unitCount || 0) * (status?.minutesPerUnit || 4);

  return (
    <div className="max-w-3xl mx-auto space-y-4">
      <div>
        <h2 className="text-xl font-bold" style={{ color: "var(--text-base)" }}>{t("Ujian Kompetensi Utama")}</h2>
        <p className="text-sm mt-1" style={{ color: "var(--text-4)" }}>
          {t("Satu ujian menyeluruh untuk membuktikan kompetensimu. Ini satu-satunya yang menerbitkan sertifikat.")}
        </p>
      </div>

      {cert && (
        <div className="card p-4 flex items-center gap-3" style={{ borderLeft: "3px solid #10b981" }}>
          <Award className="w-5 h-5 text-emerald-500 shrink-0" />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold" style={{ color: "var(--text-base)" }}>{t("Kamu sudah bersertifikat")}</p>
            <p className="text-xs" style={{ color: "var(--text-4)" }}>
              {cert.name} · {t("skor {n}%", { n: cert.score })} · {fmtDate(cert.issuedAt)}
            </p>
          </div>
          <Link to="/app/profile" className="btn-outline text-xs shrink-0">{t("Lihat")}</Link>
        </div>
      )}

      {blocked ? (
        <div className="card p-6 flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-semibold" style={{ color: "var(--text-base)" }}>{t("Belum bisa dimulai")}</p>
            <p className="text-sm mt-1" style={{ color: "var(--text-3)" }}>
              {status?.reason === "no-competency"
                ? t("Pilih kompetensi target dulu di Profil.")
                : status?.reason === "no-units"
                  ? t("Kompetensi ini belum punya rincian skill, jadi ujian belum bisa disusun.")
                  : t("Penyusun soal sedang tidak tersedia. Coba lagi nanti.")}
            </p>
            {status?.reason === "no-competency" && (
              <Link to="/app/profile?pick=1" className="btn-primary text-sm inline-flex mt-3">{t("Pilih Kompetensi")}</Link>
            )}
          </div>
        </div>
      ) : (
        <div className="card p-6 space-y-3">
          <ul className="text-sm space-y-1.5" style={{ color: "var(--text-3)" }}>
            <li>{t("Soalnya menuntut pertimbangan lintas aspek sekaligus: mutu, tenggat, keselamatan, dan komunikasi.")}</li>
            <li>{t("Ambang lulus {p}%, lebih tinggi dari latihan unit yang cukup 60%.", { p: status?.passScore || 70 })}</li>
            <li>{t("Waktumu {n} menit. Sisa waktu tetap berjalan walau halaman ditutup.", { n: minutes })}</li>
            <li>{t("Kamu boleh langsung mengambilnya. Latihan unit tidak wajib diselesaikan dulu.")}</li>
            <li>{t("Lulus berarti satu sertifikat untuk seluruh kompetensi, bukan sertifikat per unit.")}</li>
          </ul>
          <p className="text-xs" style={{ color: "var(--text-4)" }}>
            {t("Kompetensi: {title} - {n} unit", { title: status?.competencyTitle || "-", n: status?.unitCount || 0 })}
          </p>
          <button onClick={() => start.mutate()} disabled={menyusun}
            className="btn-primary text-sm flex items-center gap-2 disabled:opacity-70">
            {menyusun
              ? <><Loader2 className="w-4 h-4 animate-spin" /> {t("Menyusun soal…")}</>
              : <><Award className="w-4 h-4" /> {cert ? t("Ulangi Ujian Kompetensi") : t("Mulai Ujian Kompetensi")}</>}
          </button>
          {menyusun && (
            <p className="text-xs" style={{ color: "var(--text-4)" }}>
              {preparing?.progress?.total
                ? t("Bagian {a} dari {b} selesai. Penyusunan berjalan di server - aman ditinggal.", { a: preparing.progress.done, b: preparing.progress.total })
                : t("Penyusunan soal berjalan di server - aman ditinggal. Kalau halaman tertutup, buka lagi dan soalnya tetap dilanjutkan.")}
            </p>
          )}
        </div>
      )}
    </div>
  );
}

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

function UnitScores({ rows, t }) {
  if (!rows?.length) return null;
  return (
    <div className="card p-5">
      <h3 className="font-semibold mb-3" style={{ color: "var(--text-base)" }}>{t("Hasil per unit")}</h3>
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
                <span className="text-sm font-bold tabular-nums w-14 text-right" style={{ color: ok ? "#10b981" : "var(--text-3)" }}>{b.score}%</span>
              </div>
              {(b.feedback || b.mcCorrect != null) && (
                <p className="text-[11px] mt-1" style={{ color: "var(--text-4)" }}>
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
