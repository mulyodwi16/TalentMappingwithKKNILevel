import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Sun, Moon } from "lucide-react";

const LEVELS = [
  { n: 1, title: "Operator Dasar",  edu: "SD" },
  { n: 2, title: "Operator",        edu: "SMP" },
  { n: 3, title: "Op. Terampil",    edu: "SMA/SMK" },
  { n: 4, title: "Teknisi Junior",  edu: "D1" },
  { n: 5, title: "Teknisi",         edu: "D2/D3" },
  { n: 6, title: "Analis Ahli",     edu: "D4/S1" },
  { n: 7, title: "Ahli Profesi",    edu: "Profesi" },
  { n: 8, title: "Ahli Spesialis",  edu: "S2" },
  { n: 9, title: "Ahli Utama",      edu: "S3" },
];

const FEATURES = [
  { icon: "⚡", title: "Auto-Mapping Engine",   desc: "Upload CV → prediksi level KKNI otomatis berdasarkan pendidikan & sertifikasi." },
  { icon: "✎",  title: "Ujian Kompetensi",      desc: "Bank soal terstandar SKKNI, timer, penilaian otomatis per kompetensi." },
  { icon: "◎", title: "Skill Gap Radar",        desc: "Radar chart kompetensi aktual vs target level, urutan prioritas gap." },
  { icon: "→",  title: "Learning Path AI",      desc: "Rekomendasi belajar bertahap berbasis AI + katalog resource per kompetensi." },
  { icon: "⊞", title: "Dashboard HRD",          desc: "Analitik otomatis: distribusi level, readiness score, ekspor Excel." },
  { icon: "◉", title: "Admin Full Control",     desc: "CRUD rules mapping, bank soal, inbox request, audit log semua aksi." },
];

const STEPS = [
  { n: "01", title: "Upload CV",       desc: "Unggah CV PDF, sistem ekstrak pendidikan, sertifikasi, dan pengalaman otomatis." },
  { n: "02", title: "Auto-Mapping",    desc: "Engine prediksi level KKNI awal berdasarkan rules yang dikonfigurasi Admin." },
  { n: "03", title: "Ujian",           desc: "Ikuti ujian berbasis SKKNI untuk verifikasi kompetensi aktual." },
  { n: "04", title: "Gap & Belajar",   desc: "Radar chart gap, learning path personal, dan tracking progres." },
];

export default function Landing() {
  const [dark, setDark] = useState(() => localStorage.getItem("theme") === "dark");

  useEffect(() => {
    document.documentElement.classList.toggle("dark", dark);
    localStorage.setItem("theme", dark ? "dark" : "light");
  }, [dark]);

  return (
    <div style={{
      backgroundColor: dark ? "#0f0e1a" : "#f5f7ff",
      color: dark ? "#f0f0ff" : "#1e1b4b",
      minHeight: "100vh",
      overflowX: "hidden",
    }}>

      {/* ── Navbar ── */}
      <nav style={{
        position: "fixed", top: 0, left: 0, right: 0, zIndex: 50, height: 56,
        display: "flex", alignItems: "center", padding: "0 24px", gap: 16,
        background: dark ? "rgba(15,14,26,0.85)" : "rgba(245,247,255,0.85)",
        backdropFilter: "blur(12px)",
        borderBottom: `1px solid ${dark ? "rgba(99,102,241,0.15)" : "rgba(99,102,241,0.12)"}`,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, flex: 1 }}>
          <div style={{ width: 28, height: 28, borderRadius: 8, background: "linear-gradient(135deg,#6366f1,#8b5cf6)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 900, color: "#fff" }}>K</div>
          <span style={{ fontWeight: 700, fontSize: 14, color: dark ? "#f0f0ff" : "#1e1b4b" }}>KKNI Talent Mapping</span>
        </div>
        <button onClick={() => setDark(d => !d)} title={dark ? "Light mode" : "Dark mode"}
          style={{ padding: 8, borderRadius: 10, border: "none", background: "transparent", cursor: "pointer", color: dark ? "#a5b4fc" : "#6366f1" }}>
          {dark ? <Sun size={16} /> : <Moon size={16} />}
        </button>
        <Link to="/login" style={{ fontSize: 14, color: dark ? "#a5b4fc" : "#6366f1", textDecoration: "none", fontWeight: 500 }}>Masuk</Link>
        <Link to="/register" style={{ fontSize: 14, fontWeight: 600, color: "#fff", background: "linear-gradient(135deg,#6366f1,#8b5cf6)", padding: "8px 18px", borderRadius: 10, textDecoration: "none", boxShadow: "0 4px 14px rgba(99,102,241,0.35)" }}>Daftar Gratis</Link>
      </nav>

      {/* ── Hero ── */}
      <section style={{
        minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center",
        textAlign: "center", padding: "80px 24px 60px",
        background: dark
          ? "radial-gradient(ellipse 80% 60% at 50% 0%, rgba(99,102,241,0.18) 0%, transparent 70%)"
          : "radial-gradient(ellipse 80% 60% at 50% 0%, rgba(199,210,254,0.6) 0%, rgba(245,247,255,0) 70%)",
      }}>
        <div style={{ maxWidth: 720 }}>
          <span style={{
            display: "inline-block", fontSize: 12, fontWeight: 700, letterSpacing: "0.08em",
            color: "#6366f1", background: dark ? "rgba(99,102,241,0.15)" : "rgba(99,102,241,0.1)",
            border: "1px solid rgba(99,102,241,0.3)", borderRadius: 100, padding: "6px 16px", marginBottom: 28,
          }}>Berstandar Perpres No. 8 Tahun 2012</span>

          <h1 style={{ fontSize: "clamp(2.4rem,6vw,4.2rem)", fontWeight: 900, lineHeight: 1.1, marginBottom: 20, letterSpacing: "-0.02em" }}>
            Petakan Talenta<br />
            <span style={{ background: "linear-gradient(135deg,#6366f1 0%,#8b5cf6 50%,#a78bfa 100%)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text" }}>
              Berbasis KKNI
            </span>
          </h1>

          <p style={{ fontSize: 18, lineHeight: 1.7, color: dark ? "#a5b4fc" : "#4f46e5", marginBottom: 36, maxWidth: 560, margin: "0 auto 36px" }}>
            Upload CV → prediksi level KKNI → ujian verifikasi → skill gap → learning path personalisasi.
          </p>

          <div style={{ display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap", marginBottom: 56 }}>
            <Link to="/register" style={{ fontSize: 16, fontWeight: 700, color: "#fff", background: "linear-gradient(135deg,#6366f1,#8b5cf6)", padding: "14px 32px", borderRadius: 12, textDecoration: "none", boxShadow: "0 6px 20px rgba(99,102,241,0.4)" }}>
              Mulai Sekarang →
            </Link>
            <Link to="/login" style={{ fontSize: 16, fontWeight: 600, color: dark ? "#a5b4fc" : "#4f46e5", background: dark ? "rgba(99,102,241,0.1)" : "rgba(99,102,241,0.08)", border: `1px solid ${dark ? "rgba(99,102,241,0.3)" : "rgba(99,102,241,0.25)"}`, padding: "14px 32px", borderRadius: 12, textDecoration: "none" }}>
              Sudah Punya Akun
            </Link>
          </div>

          {/* Stats */}
          <div style={{ display: "inline-grid", gridTemplateColumns: "repeat(3,1fr)", gap: "0 40px", background: dark ? "rgba(99,102,241,0.08)" : "rgba(255,255,255,0.7)", backdropFilter: "blur(12px)", border: `1px solid ${dark ? "rgba(99,102,241,0.2)" : "rgba(99,102,241,0.15)"}`, borderRadius: 16, padding: "20px 32px" }}>
            {[["9","Level","Jenjang KKNI"],["12+","Kompetensi","Terstandar SKKNI"],["100%","Otomatis","Tanpa Manual"]].map(([v,s,l]) => (
              <div key={l} style={{ textAlign: "center", padding: "0 8px" }}>
                <p style={{ fontSize: 28, fontWeight: 900, color: "#6366f1", margin: 0 }}>{v} <span style={{ fontSize: 16 }}>{s}</span></p>
                <p style={{ fontSize: 12, color: dark ? "#a5b4fc" : "#6366f1", margin: "4px 0 0", opacity: 0.8 }}>{l}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── How it works ── */}
      <section style={{ padding: "80px 24px", background: dark ? "#13121f" : "#ffffff" }}>
        <div style={{ maxWidth: 1100, margin: "0 auto" }}>
          <h2 style={{ textAlign: "center", fontSize: "clamp(1.6rem,3vw,2.2rem)", fontWeight: 800, marginBottom: 8 }}>Cara Kerja</h2>
          <p style={{ textAlign: "center", color: dark ? "#a5b4fc" : "#6366f1", marginBottom: 48, fontSize: 16 }}>Empat langkah menuju peta kompetensi yang akurat</p>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(220px,1fr))", gap: 20 }}>
            {STEPS.map((s, i) => (
              <div key={s.n} style={{ background: dark ? "rgba(99,102,241,0.07)" : "#f5f7ff", border: `1px solid ${dark ? "rgba(99,102,241,0.18)" : "#e0e7ff"}`, borderRadius: 16, padding: "28px 24px" }}>
                <span style={{ fontSize: 36, fontWeight: 900, color: dark ? "rgba(99,102,241,0.4)" : "#c7d2fe", display: "block", marginBottom: 12 }}>{s.n}</span>
                <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 8, color: dark ? "#f0f0ff" : "#1e1b4b" }}>{s.title}</h3>
                <p style={{ fontSize: 13, lineHeight: 1.6, color: dark ? "#a5b4fc" : "#4f46e5", margin: 0, opacity: 0.85 }}>{s.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── KKNI Levels ── */}
      <section style={{ padding: "72px 24px", background: dark ? "#0f0e1a" : "#eef2ff" }}>
        <div style={{ maxWidth: 1100, margin: "0 auto" }}>
          <h2 style={{ textAlign: "center", fontSize: "clamp(1.6rem,3vw,2.2rem)", fontWeight: 800, marginBottom: 40 }}>9 Jenjang KKNI</h2>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(100px,1fr))", gap: 12 }}>
            {LEVELS.map(({ n, title, edu }, i) => (
              <div key={n} style={{ background: dark ? "rgba(99,102,241,0.1)" : "#ffffff", border: `1px solid ${dark ? "rgba(99,102,241,0.2)" : "#c7d2fe"}`, borderRadius: 14, padding: "14px 10px", textAlign: "center" }}>
                <div style={{ width: 40, height: 40, borderRadius: 10, margin: "0 auto 10px", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18, fontWeight: 900, background: `hsl(${240 + i * 10},70%,${dark ? 20 : 92}%)`, color: `hsl(${240 + i * 10},80%,${dark ? 75 : 40}%)` }}>{n}</div>
                <p style={{ fontSize: 11, fontWeight: 700, margin: "0 0 4px", color: dark ? "#f0f0ff" : "#1e1b4b", lineHeight: 1.3 }}>{title}</p>
                <p style={{ fontSize: 10, color: dark ? "#a5b4fc" : "#6366f1", margin: 0, opacity: 0.8 }}>{edu}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Features ── */}
      <section style={{ padding: "80px 24px", background: dark ? "#13121f" : "#ffffff" }}>
        <div style={{ maxWidth: 1100, margin: "0 auto" }}>
          <h2 style={{ textAlign: "center", fontSize: "clamp(1.6rem,3vw,2.2rem)", fontWeight: 800, marginBottom: 8 }}>Fitur Lengkap</h2>
          <p style={{ textAlign: "center", color: dark ? "#a5b4fc" : "#6366f1", marginBottom: 48, fontSize: 16 }}>Semua yang dibutuhkan untuk talent mapping modern</p>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(300px,1fr))", gap: 20 }}>
            {FEATURES.map((f) => (
              <div key={f.title} style={{ background: dark ? "rgba(99,102,241,0.06)" : "#f5f7ff", border: `1px solid ${dark ? "rgba(99,102,241,0.18)" : "#e0e7ff"}`, borderRadius: 16, padding: "24px" }}>
                <div style={{ width: 44, height: 44, borderRadius: 12, background: "linear-gradient(135deg,rgba(99,102,241,0.15),rgba(139,92,246,0.15))", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20, marginBottom: 14 }}>{f.icon}</div>
                <h3 style={{ fontSize: 15, fontWeight: 700, marginBottom: 8, color: dark ? "#f0f0ff" : "#1e1b4b" }}>{f.title}</h3>
                <p style={{ fontSize: 13, lineHeight: 1.65, color: dark ? "#a5b4fc" : "#4f46e5", margin: 0, opacity: 0.85 }}>{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA ── */}
      <section style={{ padding: "80px 24px", background: dark ? "#0f0e1a" : "#f5f7ff" }}>
        <div style={{ maxWidth: 640, margin: "0 auto", textAlign: "center", background: dark ? "rgba(99,102,241,0.1)" : "#ffffff", border: `1px solid ${dark ? "rgba(99,102,241,0.25)" : "#e0e7ff"}`, borderRadius: 24, padding: "56px 40px", boxShadow: dark ? "0 0 60px rgba(99,102,241,0.12)" : "0 8px 40px rgba(99,102,241,0.1)" }}>
          <h2 style={{ fontSize: "clamp(1.6rem,3vw,2rem)", fontWeight: 800, marginBottom: 12 }}>Siap Memulai?</h2>
          <p style={{ color: dark ? "#a5b4fc" : "#4f46e5", marginBottom: 32, fontSize: 15, opacity: 0.9 }}>Daftarkan organisasi Anda dan mulai pemetaan talenta berbasis KKNI hari ini.</p>
          <Link to="/register" style={{ fontSize: 16, fontWeight: 700, color: "#fff", background: "linear-gradient(135deg,#6366f1,#8b5cf6)", padding: "14px 36px", borderRadius: 12, textDecoration: "none", boxShadow: "0 6px 20px rgba(99,102,241,0.4)", display: "inline-block" }}>
            Buat Akun Gratis →
          </Link>
          <p style={{ fontSize: 12, color: dark ? "#6366f1" : "#a5b4fc", marginTop: 20 }}>
            Demo: user@demo.id / hrd@demo.id / admin@demo.id — password: demo123
          </p>
        </div>
      </section>

      <footer style={{ padding: "28px 24px", textAlign: "center", fontSize: 13, color: dark ? "#6366f1" : "#a5b4fc", borderTop: `1px solid ${dark ? "rgba(99,102,241,0.15)" : "#e0e7ff"}` }}>
        © 2025 KKNI Talent Mapping System · Berstandar Perpres No. 8 Tahun 2012
      </footer>
    </div>
  );
}
