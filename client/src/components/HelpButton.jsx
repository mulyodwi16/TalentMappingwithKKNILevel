import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  HelpCircle, LayoutDashboard, Upload, ClipboardCheck, Target, BookOpen, Bot,
  Coins, Sparkles, PartyPopper, ArrowRight, ArrowLeft, X,
} from "lucide-react";
import useAuthStore from "../store/authStore.js";

const SEEN_KEY = "kkni-tour-seen";

function steps(name) {
  return [
    {
      Icon: PartyPopper, color: "from-brand-600 to-tosca-500",
      title: `Selamat datang, ${name || "Talenta"}! 🎉`,
      body: "Akun kamu sudah aktif. Yuk kenali semua fitur KKNI Talent Mapping dalam 1 menit — biar kariermu cepat naik jenjang.",
      tip: "Kamu bisa membuka panduan ini kapan saja lewat tombol ? di kanan atas.",
    },
    {
      Icon: LayoutDashboard, color: "from-brand-600 to-brand-400",
      title: "Dashboard",
      body: "Ringkasan jenjang KKNI kamu saat ini, target, readiness score, dan status kesiapan promosi (Siap Naik / Dalam Proses / Perlu Peningkatan).",
      tip: "Klaim juga Bonus Login Harian di sini untuk kumpulkan Koin.",
      href: "/app/dashboard", hrefLabel: "Buka Dashboard",
    },
    {
      Icon: Upload, color: "from-amber-500 to-orange-500",
      title: "Upload CV → Auto-Mapping",
      body: "Unggah CV (PDF). Sistem mengekstrak pendidikan, sertifikasi, & pengalaman lalu memprediksi jenjang KKNI awalmu otomatis.",
      tip: "Memetakan CV pertama kali memberi bonus Koin.",
      href: "/app/cv-upload", hrefLabel: "Unggah CV",
    },
    {
      Icon: ClipboardCheck, color: "from-brand-500 to-indigo-500",
      title: "Ujian Kompetensi",
      body: "Bank soal terstandar SKKNI dengan timer & penilaian otomatis per kompetensi. Hasilnya memvalidasi jenjangmu.",
      tip: "Setiap ujian yang selesai memberi Koin. Boleh ujian ulang untuk menutup gap.",
      href: "/app/exam", hrefLabel: "Mulai Ujian",
    },
    {
      Icon: Target, color: "from-rose-500 to-red-500",
      title: "Skill Gap Analyzer",
      body: "Radar kompetensi 'dimiliki' vs 'dibutuhkan' target jenjang, plus daftar gap terurut prioritas & readiness score.",
      href: "/app/skill-gap", hrefLabel: "Lihat Skill Gap",
    },
    {
      Icon: BookOpen, color: "from-blue-500 to-sky-500",
      title: "Learning Path",
      body: "Rekomendasi belajar bertahap berdasarkan gap-mu, plus kursus dari AvatarEdu.ai yang otomatis dicarikan sesuai kompetensi yang kurang.",
      tip: "Tandai progres tiap materi: belum / dikerjakan / selesai.",
      href: "/app/learning-path", hrefLabel: "Buka Learning Path",
    },
    {
      Icon: Bot, color: "from-slate-700 to-brand-600",
      title: "AI Mentor Karier",
      body: "Tanya apa saja soal jenjang & kompetensimu — AI Mentor tahu data pemetaanmu dan memberi langkah konkret. Ada juga chat mengambang di pojok kanan bawah semua halaman.",
      tip: "Coba tanya: 'Kompetensi apa yang jadi gap saya?'",
      href: "/app/mentor", hrefLabel: "Tanya AI Mentor",
    },
    {
      Icon: Coins, color: "from-amber-400 to-amber-600",
      title: "Koin Talenta, Login Harian & Toko",
      body: "Kumpulkan Koin dari login harian (streak!), memetakan CV, menyelesaikan ujian, & mengikuti kursus. Tukar Koin dengan kelas premium di Toko.",
      tip: "Di Toko juga ada katalog kursus & kelas AvatarEdu yang bisa langsung kamu ikuti.",
      href: "/app/toko", hrefLabel: "Buka Toko",
    },
    {
      Icon: Sparkles, color: "from-brand-600 to-emerald-500",
      title: "Siap mulai!",
      body: "Langkah paling berdampak: Upload CV dulu untuk dapat jenjang awal, lalu ambil Ujian Kompetensi. Koin & progres pertamamu menanti!",
      tip: "Butuh bantuan? AI Mentor siap 24/7 di pojok kanan bawah.",
      href: "/app/cv-upload", hrefLabel: "Mulai dari Upload CV",
    },
  ];
}

function TourModal({ name, onClose }) {
  const navigate = useNavigate();
  const [i, setI] = useState(0);
  const all = steps(name);
  const s = all[i];
  const Icon = s.Icon;
  const last = i === all.length - 1;

  function go(href) { onClose(); navigate(href); }

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-2xl overflow-hidden" style={{ backgroundColor: "var(--bg-surface)", border: "1px solid var(--border)", boxShadow: "var(--shadow)" }}>
        {/* Header bergradien */}
        <div className={`relative bg-gradient-to-br ${s.color} text-white p-6`}>
          <button onClick={onClose} className="absolute top-3 right-3 text-white/80 hover:text-white" aria-label="Tutup"><X className="w-5 h-5" /></button>
          <div className="rounded-xl bg-white/15 w-12 h-12 flex items-center justify-center mb-3"><Icon className="w-6 h-6" /></div>
          <h2 className="text-lg font-bold leading-snug pr-6 text-white">{s.title}</h2>
        </div>

        <div className="p-6 space-y-3">
          <p className="text-sm leading-relaxed" style={{ color: "var(--text-2)" }}>{s.body}</p>
          {s.tip && (
            <div className="flex items-start gap-2 rounded-lg p-2.5" style={{ backgroundColor: "var(--bg-muted)", border: "1px solid var(--border)" }}>
              <Sparkles className="w-3.5 h-3.5 text-brand-600 mt-0.5 shrink-0" />
              <p className="text-xs leading-relaxed" style={{ color: "var(--text-3)" }}>{s.tip}</p>
            </div>
          )}
          {s.href && (
            <button onClick={() => go(s.href)} className="flex items-center gap-2 text-sm font-medium text-brand-600 hover:underline">
              {s.hrefLabel} <ArrowRight className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Footer: progress + navigasi */}
        <div className="flex items-center justify-between flex-wrap gap-2 px-4 sm:px-6 py-4" style={{ borderTop: "1px solid var(--border)" }}>
          <div className="flex flex-wrap gap-1.5 order-2 sm:order-1">
            {all.map((_, idx) => (
              <span key={idx} className={`h-1.5 rounded-full transition-all ${idx === i ? "w-5 bg-brand-600" : "w-1.5"}`} style={idx === i ? {} : { backgroundColor: "var(--border-2)" }} />
            ))}
          </div>
          <div className="flex gap-2 ml-auto order-1 sm:order-2">
            {i > 0 && <button className="btn-outline text-sm py-1.5 px-3 flex items-center gap-1" onClick={() => setI((n) => n - 1)}><ArrowLeft className="w-4 h-4" /> Kembali</button>}
            {last
              ? <button className="btn-primary text-sm py-1.5 px-4" onClick={onClose}>Selesai</button>
              : <button className="btn-primary text-sm py-1.5 px-4 flex items-center gap-1" onClick={() => setI((n) => n + 1)}>Lanjut <ArrowRight className="w-4 h-4" /></button>}
          </div>
        </div>
      </div>
    </div>
  );
}

// Tombol bantuan (?) di topbar + tur fitur. Auto-tampil sekali saat pertama login (User).
export default function HelpButton() {
  const user = useAuthStore((s) => s.user);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (user?.role === "user" && !localStorage.getItem(SEEN_KEY)) {
      localStorage.setItem(SEEN_KEY, "1");
      setOpen(true);
    }
  }, [user?.role]);

  if (user?.role !== "user") return null;

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        title="Panduan fitur"
        className="p-2 rounded-xl transition-colors hover:bg-brand-50"
        style={{ color: "var(--text-3)" }}
        aria-label="Bantuan"
      >
        <HelpCircle size={18} />
      </button>
      {open && <TourModal name={user?.name} onClose={() => setOpen(false)} />}
    </>
  );
}
