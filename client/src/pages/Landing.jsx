import { Link } from "react-router-dom";
import { Sun, Moon, ArrowRight } from "lucide-react";
import { rankName, rankColor } from "../lib/rank.js";
import RankIcon from "../components/RankIcon.jsx";
import { useLang } from "../lib/i18n.jsx";
import LangToggle from "../components/LangToggle.jsx";
import useIsDark from "../lib/useIsDark.js";
import { applyTheme } from "../lib/theme.js";

const LEVELS = [
// Mulai KKNI 3: jenjang 1-2 (SD/SMP) di bawah usia kerja, lihat lib/rank.js.
  { n: 3, title: "Op. Terampil",    edu: "SMA/SMK" },
  { n: 4, title: "Teknisi Junior",  edu: "D1" },
  { n: 5, title: "Teknisi",         edu: "D2/D3" },
  { n: 6, title: "Analis Ahli",     edu: "D4/S1" },
  { n: 7, title: "Ahli Profesi",    edu: "Profesi" },
  { n: 8, title: "Ahli Spesialis",  edu: "S2" },
  { n: 9, title: "Ahli Utama",      edu: "S3" },
];

const FEATURES = [
  { icon: "⚡", title: "Auto-Mapping Engine",   desc: "Upload CV → prediksi Skill Rank otomatis berdasarkan pendidikan & sertifikasi." },
  { icon: "✎",  title: "Ujian Kompetensi",      desc: "Bank soal terstandar SKKNI, timer, penilaian otomatis per kompetensi." },
  { icon: "◎", title: "Skill Gap Radar",        desc: "Radar chart kompetensi aktual vs target level, urutan prioritas gap." },
  { icon: "🧭", title: "Learning Path AI",      desc: "Rekomendasi belajar bertahap berbasis AI + katalog resource per kompetensi." },
  { icon: "⊞", title: "Dashboard HRD",          desc: "Analitik otomatis: distribusi level, readiness score, ekspor Excel." },
  { icon: "◉", title: "Admin Full Control",     desc: "CRUD rules mapping, bank soal, inbox request, audit log semua aksi." },
];

const STEPS = [
  { n: "01", title: "Upload CV",       desc: "Unggah CV PDF, sistem ekstrak pendidikan, sertifikasi, dan pengalaman otomatis." },
  { n: "02", title: "Auto-Mapping",    desc: "Engine prediksi Skill Rank awal berdasarkan rules yang dikonfigurasi Admin." },
  { n: "03", title: "Ujian",           desc: "Ikuti ujian berbasis SKKNI untuk verifikasi kompetensi aktual." },
  { n: "04", title: "Gap & Belajar",   desc: "Radar chart gap, learning path personal, dan tracking progres." },
];

export default function Landing() {
  const { t } = useLang();
  // Tema pra-login = default (biru navy) dari boot; toggle di sini hanya sesi (tak persist global,
  // tak bocor ke akun). #9: kustomisasi warna hanya per-akun saat login.
  const dark = useIsDark();

  return (
    <div style={{
      backgroundColor: dark ? "#0b1120" : "#f1f5f9",
      color: dark ? "#f1f5f9" : "#172554",
      minHeight: "100vh",
      overflowX: "hidden",
    }}>

      {/* ── Navbar ── */}
      <nav style={{
        position: "fixed", top: 0, left: 0, right: 0, zIndex: 50, height: 56,
        display: "flex", alignItems: "center", padding: "0 24px", gap: 16,
        background: dark ? "rgba(11,17,32,0.85)" : "rgba(241,245,249,0.85)",
        backdropFilter: "blur(12px)",
        borderBottom: `1px solid ${dark ? "rgba(59,130,246,0.15)" : "rgba(59,130,246,0.12)"}`,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, flex: 1 }}>
          <div style={{ width: 28, height: 28, borderRadius: 8, background: "linear-gradient(135deg,#3b82f6,#2563eb)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 900, color: "#fff" }}>K</div>
          <span className="landing-brand-text" style={{ fontWeight: 700, fontSize: 14, color: dark ? "#f1f5f9" : "#172554" }}>TalentaAI</span>
        </div>
        <LangToggle />
        <button onClick={() => applyTheme(dark ? "light" : "dark")} title={dark ? t("Mode terang") : t("Mode gelap")}
          style={{ padding: 8, borderRadius: 10, border: "none", background: "transparent", cursor: "pointer", color: dark ? "#93c5fd" : "#3b82f6" }}>
          {dark ? <Sun size={16} /> : <Moon size={16} />}
        </button>
        <Link to="/login" style={{ fontSize: 14, color: dark ? "#93c5fd" : "#3b82f6", textDecoration: "none", fontWeight: 500 }}>{t("Masuk")}</Link>
        <Link to="/register" style={{ fontSize: 14, fontWeight: 600, color: "#fff", background: "linear-gradient(135deg,#3b82f6,#2563eb)", padding: "8px 18px", borderRadius: 10, textDecoration: "none", boxShadow: "0 4px 14px rgba(59,130,246,0.35)" }}>{t("Daftar Gratis")}</Link>
      </nav>

      {/* ── Hero ── */}
      <section style={{
        minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center",
        textAlign: "center", padding: "80px 24px 60px",
        background: dark
          ? "radial-gradient(ellipse 80% 60% at 50% 0%, rgba(59,130,246,0.18) 0%, transparent 70%)"
          : "radial-gradient(ellipse 80% 60% at 50% 0%, rgba(191,219,254,0.6) 0%, rgba(241,245,249,0) 70%)",
      }}>
        <div style={{ maxWidth: 720 }}>
          <span style={{
            display: "inline-block", fontSize: 12, fontWeight: 700, letterSpacing: "0.08em",
            color: "#3b82f6", background: dark ? "rgba(59,130,246,0.15)" : "rgba(59,130,246,0.1)",
            border: "1px solid rgba(59,130,246,0.3)", borderRadius: 100, padding: "6px 16px", marginBottom: 28,
          }}>{t("Berstandar Perpres No. 8 Tahun 2012")}</span>

          <h1 style={{ fontSize: "clamp(2.4rem,6vw,4.2rem)", fontWeight: 900, lineHeight: 1.1, marginBottom: 20, letterSpacing: "-0.02em" }}>
            {t("Petakan Talenta")}<br />
            <span style={{ background: "linear-gradient(135deg,#3b82f6 0%,#2563eb 50%,#60a5fa 100%)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text" }}>
{t("Naik Skill Rank")}
            </span>
          </h1>

          <p style={{ fontSize: 18, lineHeight: 1.7, color: dark ? "#93c5fd" : "#2563eb", marginBottom: 36, maxWidth: 560, margin: "0 auto 36px" }}>
            <span className="inline-flex flex-wrap items-center justify-center gap-x-2 gap-y-1">
              {[t("Upload CV"), t("prediksi Skill Rank"), t("ujian verifikasi"), t("skill gap"), t("learning path personalisasi")].map((s, i, arr) => (
                <span key={i} className="inline-flex items-center gap-2">
                  <span>{s}</span>
                  {i < arr.length - 1 && <ArrowRight size={14} style={{ opacity: 0.6 }} />}
                </span>
              ))}
            </span>
          </p>

          <div style={{ display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap", marginBottom: 56 }}>
            <Link to="/register" style={{ fontSize: 16, fontWeight: 700, color: "#fff", background: "linear-gradient(135deg,#3b82f6,#2563eb)", padding: "14px 32px", borderRadius: 12, textDecoration: "none", boxShadow: "0 6px 20px rgba(59,130,246,0.4)", display: "inline-flex", alignItems: "center", gap: 8 }}>
              {t("Mulai Sekarang")} <ArrowRight size={18} />
            </Link>
            <Link to="/login" style={{ fontSize: 16, fontWeight: 600, color: dark ? "#93c5fd" : "#2563eb", background: dark ? "rgba(59,130,246,0.1)" : "rgba(59,130,246,0.08)", border: `1px solid ${dark ? "rgba(59,130,246,0.3)" : "rgba(59,130,246,0.25)"}`, padding: "14px 32px", borderRadius: 12, textDecoration: "none" }}>
              {t("Sudah Punya Akun")}
            </Link>
          </div>

          {/* Stats */}
          <div className="landing-stats" style={{ display: "inline-grid", gridTemplateColumns: "repeat(3,1fr)", gap: "0 40px", background: dark ? "rgba(59,130,246,0.08)" : "rgba(255,255,255,0.7)", backdropFilter: "blur(12px)", border: `1px solid ${dark ? "rgba(59,130,246,0.2)" : "rgba(59,130,246,0.15)"}`, borderRadius: 16, padding: "20px 32px" }}>
            {[["9","Tier","Skill Rank"],["12+","Kompetensi","Terstandar SKKNI"],["100%","Otomatis","Tanpa Manual"]].map(([v,s,l]) => (
              <div key={l} style={{ textAlign: "center", padding: "0 8px" }}>
                <p style={{ fontSize: 28, fontWeight: 900, color: "#3b82f6", margin: 0 }}>{v} <span style={{ fontSize: 16 }}>{t(s)}</span></p>
                <p style={{ fontSize: 12, color: dark ? "#93c5fd" : "#3b82f6", margin: "4px 0 0", opacity: 0.8 }}>{t(l)}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── How it works ── */}
      <section style={{ padding: "80px 24px", background: dark ? "#151b2c" : "#ffffff" }}>
        <div style={{ maxWidth: 1100, margin: "0 auto" }}>
          <h2 style={{ textAlign: "center", fontSize: "clamp(1.6rem,3vw,2.2rem)", fontWeight: 800, marginBottom: 8 }}>{t("Cara Kerja")}</h2>
          <p style={{ textAlign: "center", color: dark ? "#93c5fd" : "#3b82f6", marginBottom: 48, fontSize: 16 }}>{t("Empat langkah menuju peta kompetensi yang akurat")}</p>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(220px,1fr))", gap: 20 }}>
            {STEPS.map((s, i) => (
              <div key={s.n} style={{ background: dark ? "rgba(59,130,246,0.07)" : "#f1f5f9", border: `1px solid ${dark ? "rgba(59,130,246,0.18)" : "#dbeafe"}`, borderRadius: 16, padding: "28px 24px" }}>
                <span style={{ fontSize: 36, fontWeight: 900, color: dark ? "rgba(59,130,246,0.4)" : "#bfdbfe", display: "block", marginBottom: 12 }}>{s.n}</span>
                <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 8, color: dark ? "#f1f5f9" : "#172554" }}>{t(s.title)}</h3>
                <p style={{ fontSize: 13, lineHeight: 1.6, color: dark ? "#93c5fd" : "#2563eb", margin: 0, opacity: 0.85 }}>{t(s.desc)}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── KKNI Levels ── */}
      <section style={{ padding: "72px 24px", background: dark ? "#0b1120" : "#eff6ff" }}>
        <div style={{ maxWidth: 1100, margin: "0 auto" }}>
          <h2 style={{ textAlign: "center", fontSize: "clamp(1.6rem,3vw,2.2rem)", fontWeight: 800, marginBottom: 8 }}>{t("Skill Rank Selaras KKNI")}</h2>
          <p style={{ textAlign: "center", fontSize: 14, opacity: 0.8, marginBottom: 40, maxWidth: 640, marginLeft: "auto", marginRight: "auto" }}>
            {t("Tiap tier setara satu jenjang KKNI (Perpres 8/2012). Perjalananmu dimulai dari Gold, jenjang yang setara lulusan SMA/SMK - usia standar masuk dunia kerja.")}
          </p>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(100px,1fr))", gap: 12 }}>
            {LEVELS.map(({ n, edu }) => (
              <div key={n} style={{ background: dark ? "rgba(59,130,246,0.1)" : "#ffffff", border: `1px solid ${dark ? "rgba(59,130,246,0.2)" : "#bfdbfe"}`, borderRadius: 14, padding: "14px 10px", textAlign: "center" }}>
                {/* Emblem rank bergambar (aset RankIcon, sama dgn di aplikasi) - bukan angka polos */}
                <div style={{ display: "flex", justifyContent: "center", marginBottom: 8, filter: `drop-shadow(0 2px 6px ${rankColor(n)}55)` }}>
                  <RankIcon level={n} size={52} title={rankName(n)} />
                </div>
                <p style={{ fontSize: 11, fontWeight: 700, margin: "0 0 4px", color: rankColor(n), lineHeight: 1.3 }}>{rankName(n)}</p>
                <p style={{ fontSize: 10, color: dark ? "#93c5fd" : "#3b82f6", margin: 0, opacity: 0.8 }}>{edu}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Features ── */}
      <section style={{ padding: "80px 24px", background: dark ? "#151b2c" : "#ffffff" }}>
        <div style={{ maxWidth: 1100, margin: "0 auto" }}>
          <h2 style={{ textAlign: "center", fontSize: "clamp(1.6rem,3vw,2.2rem)", fontWeight: 800, marginBottom: 8 }}>{t("Fitur Lengkap")}</h2>
          <p style={{ textAlign: "center", color: dark ? "#93c5fd" : "#3b82f6", marginBottom: 48, fontSize: 16 }}>{t("Semua yang dibutuhkan untuk talent mapping modern")}</p>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(min(100%,300px),1fr))", gap: 20 }}>
            {FEATURES.map((f) => (
              <div key={f.title} style={{ background: dark ? "rgba(59,130,246,0.06)" : "#f1f5f9", border: `1px solid ${dark ? "rgba(59,130,246,0.18)" : "#dbeafe"}`, borderRadius: 16, padding: "24px" }}>
                <div style={{ width: 44, height: 44, borderRadius: 12, background: "linear-gradient(135deg,rgba(59,130,246,0.15),rgba(59,130,246,0.15))", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20, marginBottom: 14 }}>{f.icon}</div>
                <h3 style={{ fontSize: 15, fontWeight: 700, marginBottom: 8, color: dark ? "#f1f5f9" : "#172554" }}>{t(f.title)}</h3>
                <p style={{ fontSize: 13, lineHeight: 1.65, color: dark ? "#93c5fd" : "#2563eb", margin: 0, opacity: 0.85 }}>{t(f.desc)}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA ── */}
      <section style={{ padding: "80px 24px", background: dark ? "#0b1120" : "#f1f5f9" }}>
        <div style={{ maxWidth: 640, margin: "0 auto", textAlign: "center", background: dark ? "rgba(59,130,246,0.1)" : "#ffffff", border: `1px solid ${dark ? "rgba(59,130,246,0.25)" : "#dbeafe"}`, borderRadius: 24, padding: "56px 40px", boxShadow: dark ? "0 0 60px rgba(59,130,246,0.12)" : "0 8px 40px rgba(59,130,246,0.1)" }}>
          <h2 style={{ fontSize: "clamp(1.6rem,3vw,2rem)", fontWeight: 800, marginBottom: 12 }}>{t("Siap Memulai?")}</h2>
          <p style={{ color: dark ? "#93c5fd" : "#2563eb", marginBottom: 32, fontSize: 15, opacity: 0.9 }}>{t("Daftarkan organisasi Anda dan mulai pemetaan talenta hari ini.")}</p>
          <Link to="/register" style={{ fontSize: 16, fontWeight: 700, color: "#fff", background: "linear-gradient(135deg,#3b82f6,#2563eb)", padding: "14px 36px", borderRadius: 12, textDecoration: "none", boxShadow: "0 6px 20px rgba(59,130,246,0.4)", display: "inline-flex", alignItems: "center", gap: 8 }}>
            {t("Buat Akun Gratis")} <ArrowRight size={18} />
          </Link>
          <p style={{ fontSize: 12, color: dark ? "#3b82f6" : "#93c5fd", marginTop: 20 }}>
            Demo: user@demo.id / hrd@demo.id / admin@demo.id - password: demo123
          </p>
        </div>
      </section>

      <footer style={{ padding: "28px 24px", textAlign: "center", fontSize: 13, color: dark ? "#3b82f6" : "#93c5fd", borderTop: `1px solid ${dark ? "rgba(59,130,246,0.15)" : "#dbeafe"}` }}>
        © 2025 TalentaAI · {t("Selaras Perpres No. 8 Tahun 2012")}
      </footer>
    </div>
  );
}
