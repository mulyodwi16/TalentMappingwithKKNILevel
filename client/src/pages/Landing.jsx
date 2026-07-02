import { Suspense, lazy, useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { Sun, Moon } from "lucide-react";

const HeroCanvas = lazy(() => import("../three/HeroCanvas.jsx"));

const LEVELS = [
  { n: 1, title: "Operator Dasar", edu: "SD" },
  { n: 2, title: "Operator", edu: "SMP" },
  { n: 3, title: "Op. Terampil", edu: "SMA/SMK" },
  { n: 4, title: "Teknisi Junior", edu: "D1" },
  { n: 5, title: "Teknisi", edu: "D2/D3" },
  { n: 6, title: "Analis Ahli", edu: "D4/S1" },
  { n: 7, title: "Ahli Profesi", edu: "Profesi" },
  { n: 8, title: "Ahli Spesialis", edu: "S2" },
  { n: 9, title: "Ahli Utama", edu: "S3" },
];

const FEATURES = [
  { icon: "⚡", title: "Auto-Mapping Engine", desc: "Upload CV → sistem langsung prediksi level KKNI berdasarkan pendidikan & sertifikasi." },
  { icon: "✎", title: "Ujian Kompetensi", desc: "Bank soal terstandar SKKNI, timer, penilaian otomatis, riwayat percobaan." },
  { icon: "◎", title: "Skill Gap Radar", desc: "Visualisasi radar chart gap kompetensi aktual vs. yang dibutuhkan target level." },
  { icon: "→", title: "Learning Path AI", desc: "Rekomendasi belajar bertahap berbasis AI (OpenRouter) + katalog resource." },
  { icon: "⊞", title: "Dashboard HRD", desc: "Analitik otomatis: distribusi level, readiness score, status promosi, ekspor Excel." },
  { icon: "◉", title: "Admin Full Control", desc: "CRUD rules mapping, bank soal, request inbox, audit log semua aksi sistem." },
];

const STEPS = [
  { n: "01", title: "Upload CV", desc: "Unggah CV PDF, sistem ekstrak pendidikan, sertifikasi, dan pengalaman otomatis." },
  { n: "02", title: "Auto-Mapping", desc: "Engine memprediksi level KKNI awal berdasarkan rules yang dikonfigurasi Admin." },
  { n: "03", title: "Ujian Kompetensi", desc: "Ikuti ujian berbasis SKKNI untuk verifikasi kompetensi aktual." },
  { n: "04", title: "Gap & Rekomendasi", desc: "Lihat radar chart gap, terima learning path personal, dan track progres." },
];

function useCountUp(target, duration = 1500) {
  const ref = useRef(null);
  useEffect(() => {
    let start = null;
    const step = (ts) => {
      if (!start) start = ts;
      const progress = Math.min((ts - start) / duration, 1);
      if (ref.current) ref.current.textContent = Math.floor(progress * target);
      if (progress < 1) requestAnimationFrame(step);
    };
    const obs = new IntersectionObserver(([e]) => { if (e.isIntersecting) requestAnimationFrame(step); });
    if (ref.current) obs.observe(ref.current);
    return () => obs.disconnect();
  }, [target, duration]);
  return ref;
}

function StatCard({ value, suffix, label }) {
  const ref = useCountUp(value);
  return (
    <div className="text-center">
      <p className="text-3xl font-bold text-white">
        <span ref={ref}>0</span>{suffix}
      </p>
      <p className="text-sm text-slate-400 mt-1">{label}</p>
    </div>
  );
}

export default function Landing() {
  const [dark, setDark] = useState(() => localStorage.getItem("theme") === "dark");
  useEffect(() => {
    document.documentElement.classList.toggle("dark", dark);
    localStorage.setItem("theme", dark ? "dark" : "light");
  }, [dark]);

  return (
    <div className="min-h-screen bg-slate-950 text-white overflow-x-hidden">
      {/* Navbar */}
      <nav className="fixed top-0 inset-x-0 z-50 glass border-b border-white/5 px-6 h-14 flex items-center gap-4">
        <div className="flex items-center gap-2 flex-1">
          <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-brand-600 to-tosca-500 flex items-center justify-center text-xs font-bold">K</div>
          <span className="font-bold text-sm">KKNI Talent Mapping</span>
        </div>
        <button onClick={() => setDark(d => !d)} title={dark ? "Light mode" : "Dark mode"}
          className="p-2 rounded-xl text-slate-400 hover:text-white transition-colors">
          {dark ? <Sun size={16} /> : <Moon size={16} />}
        </button>
        <Link to="/login"    className="text-sm text-slate-400 hover:text-white transition-colors">Masuk</Link>
        <Link to="/register" className="btn-primary text-sm py-2 px-4">Daftar Gratis</Link>
      </nav>

      {/* Hero */}
      <section className="relative min-h-screen flex items-center pt-14">
        {/* Three.js bg */}
        <div className="absolute inset-0 z-0">
          <Suspense fallback={null}>
            <HeroCanvas />
          </Suspense>
          {/* gradient overlay */}
          <div className="absolute inset-0 bg-gradient-to-b from-slate-950/60 via-transparent to-slate-950" />
        </div>

        <div className="relative z-10 container mx-auto px-6 py-20 text-center">
          <span className="inline-block glass rounded-full px-4 py-1.5 text-xs font-semibold text-brand-400 border-brand-500/30 mb-6">
            Berstandar Perpres No. 8 Tahun 2012
          </span>
          <h1 className="text-5xl md:text-7xl font-extrabold leading-tight mb-6">
            Petakan Talenta<br />
            <span className="gradient-text">Berbasis KKNI</span>
          </h1>
          <p className="text-lg md:text-xl text-slate-400 max-w-2xl mx-auto mb-10">
            Sistem pemetaan kompetensi pekerja otomatis. Upload CV → prediksi level KKNI →
            ujian verifikasi → skill gap → learning path personalisasi.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center mb-16">
            <Link to="/register" className="btn-primary text-base py-3 px-8">
              Mulai Sekarang →
            </Link>
            <Link to="/login" className="btn-outline text-base py-3 px-8">
              Sudah Punya Akun
            </Link>
          </div>

          {/* Stats */}
          <div className="glass rounded-2xl px-8 py-6 inline-grid grid-cols-3 gap-8 divide-x divide-white/10">
            <StatCard value={9}   suffix=" Level" label="Jenjang KKNI" />
            <StatCard value={12}  suffix="+"      label="Kompetensi" />
            <StatCard value={100} suffix="%"      label="Otomatis" />
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="py-24 px-6 container mx-auto">
        <h2 className="text-3xl font-bold text-center mb-3">Cara Kerja</h2>
        <p className="text-slate-400 text-center mb-12">Empat langkah menuju peta kompetensi yang akurat</p>
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {STEPS.map((s) => (
            <div key={s.n} className="card p-6 hover:border-brand-500/50 transition-colors group">
              <span className="text-4xl font-black text-slate-700 group-hover:text-brand-500/30 transition-colors">{s.n}</span>
              <h3 className="text-lg font-semibold mt-3 mb-2">{s.title}</h3>
              <p className="text-sm text-slate-400">{s.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* KKNI Levels strip */}
      <section className="py-16 px-6 bg-slate-900/50">
        <div className="container mx-auto">
          <h2 className="text-3xl font-bold text-center mb-10">9 Jenjang KKNI</h2>
          <div className="grid grid-cols-3 sm:grid-cols-5 lg:grid-cols-9 gap-3">
            {LEVELS.map(({ n, title, edu }, i) => (
              <div
                key={n}
                className="card p-3 text-center hover:scale-105 transition-transform cursor-default"
                style={{ borderColor: `hsl(${200 + i * 18}, 80%, ${40 + i * 4}%, 0.4)` }}
              >
                <div
                  className="w-10 h-10 rounded-xl mx-auto mb-2 flex items-center justify-center text-lg font-black"
                  style={{ background: `hsl(${200 + i * 18}, 70%, 25%)`, color: `hsl(${200 + i * 18}, 100%, 75%)` }}
                >
                  {n}
                </div>
                <p className="text-xs font-semibold text-white leading-tight">{title}</p>
                <p className="text-[10px] text-slate-500 mt-1">{edu}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="py-24 px-6 container mx-auto">
        <h2 className="text-3xl font-bold text-center mb-3">Fitur Lengkap</h2>
        <p className="text-slate-400 text-center mb-12">Semua yang dibutuhkan untuk talent mapping modern</p>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {FEATURES.map((f) => (
            <div key={f.title} className="card p-6 hover:border-brand-500/40 transition-all hover:shadow-lg hover:shadow-brand-600/10 group">
              <div className="w-10 h-10 rounded-xl bg-brand-600/10 flex items-center justify-center text-xl mb-4 group-hover:bg-brand-600/20 transition-colors">
                {f.icon}
              </div>
              <h3 className="text-base font-semibold mb-2">{f.title}</h3>
              <p className="text-sm text-slate-400">{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="py-20 px-6 text-center">
        <div className="card max-w-2xl mx-auto p-12 relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-br from-brand-600/10 to-tosca-500/10" />
          <div className="relative">
            <h2 className="text-3xl font-bold mb-4">Siap Memulai?</h2>
            <p className="text-slate-400 mb-8">Daftarkan organisasi Anda dan mulai pemetaan talenta berbasis KKNI.</p>
            <Link to="/register" className="btn-primary text-base py-3 px-8 inline-block">
              Buat Akun Gratis →
            </Link>
            <p className="text-xs text-slate-600 mt-6">
              Demo login: user@demo.id / hrd@demo.id / admin@demo.id — password: demo123
            </p>
          </div>
        </div>
      </section>

      <footer className="border-t border-slate-800 py-8 px-6 text-center text-sm text-slate-600">
        © 2025 KKNI Talent Mapping System · Berstandar Perpres No. 8 Tahun 2012
      </footer>
    </div>
  );
}
