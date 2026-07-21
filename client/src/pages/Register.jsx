import { useState, useRef } from "react";
import { Link, useNavigate } from "react-router-dom";
import toast from "react-hot-toast";
import { ArrowRight, ArrowLeft, Check, Loader2, Target, FileText, Sparkles } from "lucide-react";
import api from "../api/client.js";
import useAuthStore from "../store/authStore.js";
import { ACADEMIC_STATUS } from "../lib/academic.js";
import LangToggle from "../components/LangToggle.jsx";
import ThemeToggle from "../components/ThemeToggle.jsx";
import SkkniPicker from "../components/SkkniPicker.jsx";
import CompetencyPreparing from "../components/CompetencyPreparing.jsx";
import { useLang } from "../lib/i18n.jsx";

// Pengalaman di bidang kompetensi (nilai = perkiraan tahun untuk seed).
const EXPERIENCE = [
  { years: 0, label: "Belum ada" },
  { years: 1, label: "< 1 tahun" },
  { years: 2, label: "1-3 tahun" },
  { years: 4, label: "3-5 tahun" },
  { years: 6, label: "> 5 tahun" },
];

const STEPS = ["Data Diri", "Kompetensi", "Berkas"];

export default function Register() {
  const navigate = useNavigate();
  const setAuth = useAuthStore((s) => s.setAuth);
  const { t } = useLang();

  const [step, setStep] = useState(1);
  const [form, setForm] = useState({ name: "", email: "", password: "", academicStatus: "" });
  const [chosen, setChosen] = useState(null);          // kompetensi terpilih {id, title}
  const [experience, setExperience] = useState(null);  // objek EXPERIENCE
  const [picking, setPicking] = useState(false);
  const [cvData, setCvData] = useState(null);          // { pdfBase64, fileName } - diproses saat finalisasi
  const [finalizing, setFinalizing] = useState(false);
  const [preparing, setPreparing] = useState(null);    // {docId, title} - menunggu unit kompetensi siap
  const cvRef = useRef(null);

  const upd = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  // ── Fase 1: VALIDASI LOKAL saja - akun BELUM dibuat (baru disimpan saat finalisasi). ──
  function submitStep1(e) {
    e.preventDefault();
    if (!form.name.trim()) return toast.error(t("Nama wajib diisi"));
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(form.email)) return toast.error(t("Email tidak valid"));
    if (form.password.length < 6) return toast.error(t("Password minimal 6 karakter"));
    if (!form.academicStatus) return toast.error(t("Pilih status akademikmu terlebih dahulu"));
    setStep(2);
  }

  function nextFromStep2() {
    if (!chosen) return toast.error(t("Pilih kompetensi target dulu, atau lewati onboarding."));
    setStep(3);
  }

  // ── Fase 3: simpan file CV lokal (belum diunggah) ──
  function handleCv(file) {
    if (!file || file.type !== "application/pdf") return toast.error(t("Harap upload file PDF"));
    const reader = new FileReader();
    reader.onload = (e) => setCvData({ pdfBase64: e.target.result, fileName: file.name });
    reader.readAsDataURL(file);
  }

  // ── Finalisasi: BARU DI SINI semua data disimpan (akun → kompetensi → pengalaman → CV). ──
  async function finalize() {
    if (finalizing) return;
    setFinalizing(true);
    try {
      const { token, user } = await api.post("/auth/register", {
        name: form.name, email: form.email, password: form.password, academicStatus: form.academicStatus,
      });
      setAuth(token, user);
      let chooseRes = null;
      if (chosen?.id) { try { chooseRes = await api.post("/skkni/choose", { docId: chosen.id }); } catch { /* non-fatal */ } }
      if (experience) { try { await api.put("/user/profile", { experienceYears: experience.years }); } catch { /* non-fatal */ } }
      if (cvData)     { try { await api.post("/user/cv-parse", cvData); } catch { /* non-fatal */ } }
      toast.success(t("Selamat datang di TalentaAI! 🎉"));
      // Unit kompetensi masih ditarik dari Kemnaker: tahan di layar tunggu dulu, supaya
      // dashboard tidak menyambut user baru dengan Skill Gap & Kelas yang kosong.
      if (chosen?.id && chooseRes && !chooseRes.ready) {
        setPreparing({ docId: chosen.id, title: chooseRes.chosen?.title || chosen.title });
        return;
      }
      navigate("/app/dashboard");
    } catch (err) {
      toast.error(err || t("Registrasi gagal"));
      setStep(1); // mis. email sudah terdaftar → kembali ke fase 1
    } finally {
      setFinalizing(false);
    }
  }

  return (
    <div className="auth-bg min-h-screen flex items-center justify-center p-4 py-12">
      {/* decorative blobs */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute -top-32 -right-32 w-96 h-96 rounded-full blur-3xl" style={{ background: "rgb(var(--brand-400) / 0.22)" }} />
        <div className="absolute bottom-0 -left-16 w-80 h-80 rounded-full blur-3xl" style={{ background: "rgb(var(--tosca-500) / 0.16)" }} />
      </div>

      <div className="fixed top-4 right-4 z-10 flex items-center gap-2">
        <ThemeToggle />
        <LangToggle />
      </div>

      <div className="w-full max-w-md relative">
        {/* logo + heading */}
        <div className="text-center mb-6">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-brand-600 to-tosca-500 flex items-center justify-center text-xl font-black text-white mx-auto mb-4">T</div>
          <h1 className="text-2xl font-bold" style={{ color: "var(--text-base)" }}>{t("Buat Akun Baru")}</h1>
          <p className="mt-1 text-sm" style={{ color: "var(--text-3)" }}>{t("Siapkan diri memenuhi standar kompetensi SKKNI")}</p>
        </div>

        {/* Kompetensi belum siap: tahan di sini dulu, jangan masuk dashboard dengan data kosong. */}
        {preparing ? (
          <CompetencyPreparing
            docId={preparing.docId}
            title={preparing.title}
            onReady={() => navigate("/app/dashboard")}
            onSkip={() => navigate("/app/dashboard")}
            onPickOther={() => navigate("/app/profile?pick=1")}
          />
        ) : (
        <>
        {/* Stepper */}
        <div className="flex items-center justify-center gap-2 mb-5">
          {STEPS.map((label, i) => {
            const n = i + 1;
            const done = step > n;
            const active = step === n;
            return (
              <div key={label} className="flex items-center gap-2">
                <div className="flex items-center gap-1.5">
                  <span className={`w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-bold ${active ? "bg-brand-600 text-white" : done ? "bg-emerald-500 text-white" : ""}`}
                    style={active || done ? {} : { background: "var(--bg-muted)", color: "var(--text-4)" }}>
                    {done ? <Check className="w-3.5 h-3.5" /> : n}
                  </span>
                  <span className="text-[11px] font-medium hidden sm:inline" style={{ color: active ? "var(--text-base)" : "var(--text-4)" }}>{t(label)}</span>
                </div>
                {n < STEPS.length && <span className="w-4 h-px" style={{ background: "var(--border-2)" }} />}
              </div>
            );
          })}
        </div>

        {/* ── FASE 1: Data Diri ── */}
        {step === 1 && (
          <form onSubmit={submitStep1} className="card p-6 sm:p-8 space-y-4">
            {[
              { key: "name",     label: "Nama Lengkap", type: "text",     ph: "Nama lengkapmu" },
              { key: "email",    label: "Email",         type: "email",    ph: "email@contoh.com" },
              { key: "password", label: "Password",      type: "password", ph: "Min. 6 karakter" },
            ].map(({ key, label, type, ph }) => (
              <div key={key}>
                <label className="text-sm font-medium mb-1.5 block" style={{ color: "var(--text-2)" }}>{t(label)}</label>
                <input className="input" type={type} placeholder={t(ph)} value={form[key]} onChange={upd(key)} required />
              </div>
            ))}

            <div>
              <label className="text-sm font-medium mb-1.5 block" style={{ color: "var(--text-2)" }}>{t("Status / pendidikan terakhir")}</label>
              <div className="grid grid-cols-2 gap-2">
                {ACADEMIC_STATUS.map((s) => {
                  const active = form.academicStatus === s.key;
                  return (
                    <button type="button" key={s.key} onClick={() => setForm((f) => ({ ...f, academicStatus: s.key }))}
                      className={`text-left rounded-xl p-3 border transition-colors ${active ? "border-brand-500 bg-brand-600/10" : "hover:border-slate-400"}`}
                      style={active ? {} : { borderColor: "var(--border)" }}>
                      <p className="text-sm font-semibold" style={{ color: "var(--text-base)" }}>{t(s.label)}</p>
                      <p className="text-[11px]" style={{ color: "var(--text-4)" }}>{t(s.desc)}</p>
                    </button>
                  );
                })}
              </div>
            </div>

            <button type="submit" className="btn-primary w-full py-3 mt-2 flex items-center justify-center gap-2">
              {t("Lanjut")} <ArrowRight className="w-4 h-4" />
            </button>
            <p className="text-center text-sm" style={{ color: "var(--text-4)" }}>
              {t("Sudah punya akun?")}{" "}
              <Link to="/login" className="text-brand-600 hover:text-brand-700 font-medium">{t("Masuk")}</Link>
            </p>
          </form>
        )}

        {/* ── FASE 2: Kompetensi ── */}
        {step === 2 && (
          <div className="card p-6 sm:p-8 space-y-4">
            <div>
              <h2 className="text-sm font-semibold flex items-center gap-2" style={{ color: "var(--text-base)" }}>
                <Target className="w-4 h-4 text-brand-600" /> {t("Kompetensi yang ingin dikuasai")}
              </h2>
              <p className="text-xs mt-1" style={{ color: "var(--text-4)" }}>{t("Pilih 1 bidang/profesi SKKNI resmi Kemnaker - jadi acuan kelas, ujian, & rank.")}</p>
            </div>

            {chosen ? (
              <div className="rounded-xl p-3 flex items-start gap-2" style={{ background: "var(--bg-muted)" }}>
                <Check className="w-4 h-4 text-emerald-500 mt-0.5 shrink-0" />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold" style={{ color: "var(--text-base)" }}>{chosen.title}</p>
                  <button onClick={() => setPicking(true)} className="text-[11px] text-brand-600 hover:underline">{t("Ganti kompetensi")}</button>
                </div>
              </div>
            ) : (
              <button onClick={() => setPicking(true)} className="btn-outline w-full py-2.5 flex items-center justify-center gap-2">
                <Target className="w-4 h-4" /> {t("Pilih Kompetensi")}
              </button>
            )}

            <div>
              <label className="text-sm font-medium mb-1.5 block" style={{ color: "var(--text-2)" }}>{t("Pengalaman di bidang ini")}</label>
              <div className="grid grid-cols-3 gap-2">
                {EXPERIENCE.map((ex) => {
                  const active = experience?.years === ex.years;
                  return (
                    <button type="button" key={ex.years} onClick={() => setExperience(ex)}
                      className={`text-xs rounded-lg py-2 border transition-colors ${active ? "border-brand-500 bg-brand-600/10 text-brand-600" : "hover:border-slate-400"}`}
                      style={active ? {} : { borderColor: "var(--border)", color: "var(--text-3)" }}>
                      {t(ex.label)}
                    </button>
                  );
                })}
              </div>
              <p className="text-[11px] mt-1.5" style={{ color: "var(--text-4)" }}>{t("Pengalaman jadi acuan awal - tetap perlu dibuktikan lewat kelas & ujian.")}</p>
            </div>

            <div className="flex items-center gap-2 pt-1">
              <button onClick={() => setStep(1)} className="btn-outline py-2.5 px-4 flex items-center gap-1.5"><ArrowLeft className="w-4 h-4" /> {t("Kembali")}</button>
              <button onClick={nextFromStep2} className="btn-primary flex-1 py-2.5 flex items-center justify-center gap-2">{t("Lanjut")} <ArrowRight className="w-4 h-4" /></button>
            </div>
            <button onClick={finalize} disabled={finalizing} className="w-full text-center text-xs disabled:opacity-60" style={{ color: "var(--text-4)" }}>
              {finalizing ? t("Menyiapkan akun…") : t("Lewati onboarding untuk sekarang")}
            </button>
          </div>
        )}

        {/* ── FASE 3: Berkas (opsional) ── */}
        {step === 3 && (
          <div className="card p-6 sm:p-8 space-y-4">
            <div>
              <h2 className="text-sm font-semibold flex items-center gap-2" style={{ color: "var(--text-base)" }}>
                <FileText className="w-4 h-4 text-brand-600" /> {t("Unggah berkas pendukung")} <span className="text-[11px] font-normal" style={{ color: "var(--text-4)" }}>· {t("opsional")}</span>
              </h2>
              <p className="text-xs mt-1" style={{ color: "var(--text-4)" }}>{t("CV/sertifikat (PDF) di-olah AI jadi acuan skill SEMENTARA. Tanpa berkas, rank mulai dari terendah & naik lewat ujian.")}</p>
            </div>

            {!cvData ? (
              <div
                onClick={() => cvRef.current?.click()}
                className="card p-8 text-center border-2 border-dashed cursor-pointer transition-all hover:border-brand-500"
                style={{ borderColor: "var(--border-2)" }}
              >
                <input ref={cvRef} type="file" accept=".pdf" hidden onChange={(e) => handleCv(e.target.files[0])} />
                <div className="text-4xl mb-2">📄</div>
                <p className="font-semibold text-sm" style={{ color: "var(--text-base)" }}>{t("Letakkan CV (PDF) di sini")}</p>
                <p className="text-xs mt-1" style={{ color: "var(--text-4)" }}>{t("atau klik untuk memilih file")}</p>
              </div>
            ) : (
              <div className="rounded-xl p-4 flex items-center gap-3" style={{ background: "var(--bg-muted)" }}>
                <div className="w-11 h-11 rounded-xl bg-brand-600/15 flex items-center justify-center text-brand-600 shrink-0">
                  <Sparkles className="w-5 h-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold truncate" style={{ color: "var(--text-base)" }}>{cvData.fileName}</p>
                  <p className="text-[11px]" style={{ color: "var(--text-4)" }}>{t("Akan diolah AI setelah pendaftaran selesai.")}</p>
                </div>
                <button onClick={() => setCvData(null)} className="text-[11px] text-brand-600 hover:underline shrink-0">{t("Ganti")}</button>
              </div>
            )}

            <div className="flex items-center gap-2 pt-1">
              <button onClick={() => setStep(2)} disabled={finalizing} className="btn-outline py-2.5 px-4 flex items-center gap-1.5 disabled:opacity-60"><ArrowLeft className="w-4 h-4" /> {t("Kembali")}</button>
              <button onClick={finalize} disabled={finalizing} className="btn-primary flex-1 py-2.5 flex items-center justify-center gap-2 disabled:opacity-70">
                {finalizing ? <><Loader2 className="w-4 h-4 animate-spin" /> {t("Menyiapkan akun…")}</>
                  : <><Check className="w-4 h-4" /> {cvData ? t("Selesai") : t("Lewati & selesai")}</>}
              </button>
            </div>
          </div>
        )}
        </>
        )}

        <p className="text-center mt-4">
          <Link to="/" className="text-sm hover:text-brand-600 transition-colors" style={{ color: "var(--text-4)" }}>
            {t("← Kembali ke Beranda")}
          </Link>
        </p>
      </div>

      {picking && <SkkniPicker selectOnly onClose={() => setPicking(false)} onChosen={(c) => { setChosen(c); setPicking(false); }} />}
    </div>
  );
}
