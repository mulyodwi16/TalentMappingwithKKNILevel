import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  HelpCircle, LayoutDashboard, Upload, ClipboardCheck, Target, BookOpen, Bot,
  Coins, Sparkles, PartyPopper, ArrowRight, ArrowLeft, X, GraduationCap, Compass,
  Trophy, Scale, ShieldCheck, Gauge, Brain, ListChecks, BadgeCheck,
} from "lucide-react";
import useAuthStore from "../store/authStore.js";
import TourArt from "./TourArt.jsx";

const SEEN_KEY = "kkni-tour-seen";

function steps(name) {
  return [
    {
      art: "welcome", Icon: PartyPopper, color: "from-brand-600 to-tosca-500",
      title: `Selamat datang, ${name || "Talenta"}! 🎉`,
      body: "Akunmu sudah aktif. Mari kenali semua fitur TalentaAI dalam satu menit agar kariermu cepat naik rank.",
      tip: "Panduan ini bisa dibuka kapan saja lewat tombol ? di kanan atas. Ada juga tab \"Cara Kerja Sistem\" untuk penjelasan skoring, rank, & AI.",
    },
    {
      art: "dashboard", Icon: LayoutDashboard, color: "from-brand-600 to-brand-400",
      title: "Dashboard — Panggung Rank",
      body: "Skill Rank kamu ditonjolkan ala main-menu game ranked: emblem, progres menuju rank berikutnya, ladder 9 tier, dan statistik (unit lulus, sertifikat, kesiapan). Saat kamu naik rank, ada animasi perayaan.",
      tip: "Klaim Bonus Login Harian & kerjakan Course Harian di sini untuk kumpulkan Koin.",
      href: "/app/dashboard", hrefLabel: "Buka Dashboard",
    },
    {
      art: "cv", Icon: Upload, color: "from-amber-500 to-orange-500",
      title: "Upload CV & Data Validasi",
      body: "Unggah CV (PDF) — sistem mengekstrak pendidikan, keahlian, & pengalaman lalu memprediksi seed rank. Lengkapi juga portofolio, LinkedIn/medsos, & sertifikat sebagai data pendukung validasi.",
      tip: "CV cuma jadi bahan pembanding & seed — kompetensi sebenarnya divalidasi lewat ujian.",
      href: "/app/cv-upload", hrefLabel: "Unggah CV",
    },
    {
      art: "path", Icon: GraduationCap, color: "from-emerald-500 to-teal-500",
      title: "Kelas per Unit Kompetensi",
      body: "Tiap unit SKKNI punya materi belajar (disusun AI) + kursus AvatarEdu. Selesaikan kelas untuk membuka ujian unitnya. Koin bisa membuka unit lebih cepat, tapi tak memberi sertifikat.",
      tip: "Belajar berurutan, atau lompati dengan Koin bila ingin cepat.",
      href: "/app/kelas", hrefLabel: "Buka Kelas",
    },
    {
      art: "exam", Icon: ClipboardCheck, color: "from-brand-500 to-indigo-500",
      title: "Ujian Kompetensi per Unit",
      body: "Ujian dibuka per unit (10–15 soal) dengan 3 tipe: pilihan ganda, studi kasus situasional, & urutan langkah. Isian dinilai AI. Lulus (≥60%) menerbitkan sertifikat unit & menaikkan rank.",
      tip: "Soal diacak tiap percobaan — menguji pemahaman, bukan keberuntungan.",
      href: "/app/exam", hrefLabel: "Mulai Ujian",
    },
    {
      art: "gap", Icon: Target, color: "from-rose-500 to-red-500",
      title: "Skill Gap Analyzer",
      body: "Radar kompetensi 'dimiliki' vs 'target', daftar gap terurut prioritas, dan langkah menutup tiap gap yang ditarik langsung dari Learning Path-mu.",
      href: "/app/skill-gap", hrefLabel: "Lihat Skill Gap",
    },
    {
      art: "path", Icon: BookOpen, color: "from-blue-500 to-sky-500",
      title: "Learning Path Personal",
      body: "AI menyusun rencana bertahap dari SELURUH datamu (CV, kelas, ujian, unit lulus, keahlian, bukti). Progres tiap langkah dilacak OTOMATIS dari aktivitasmu — tak perlu centang manual.",
      tip: "Tiap langkah punya tautan ke fitur untuk mengerjakannya (Kelas/Ujian/Bukti).",
      href: "/app/learning-path", hrefLabel: "Buka Learning Path",
    },
    {
      art: "gap", Icon: Compass, color: "from-cyan-500 to-brand-500",
      title: "Peta Posisi & Kesiapan",
      body: "Posisi target dari HRD + langkah konkret memenuhinya. Skill dipilah: tervalidasi (lulus ujian), terdeteksi CV/portofolio (menunggu ujian), atau belum ada bukti.",
      tip: "CV/portofolio bisa dideteksi AI sebagai klaim — tapi kompetensi sah hanya setelah lulus ujian.",
      href: "/app/jobs", hrefLabel: "Buka Peta Posisi",
    },
    {
      art: "mentor", Icon: Bot, color: "from-slate-700 to-brand-600",
      title: "AI Mentor Karier",
      body: "Tanya apa saja soal Skill Rank & kompetensimu — AI Mentor memahami data pemetaanmu dan memberi langkah konkret. Tombol chat cepat tersedia di pojok kanan bawah semua halaman.",
      tip: "Coba tanya: 'Kompetensi apa yang jadi gap saya?'",
      href: "/app/mentor", hrefLabel: "Tanya AI Mentor",
    },
    {
      art: "coins", Icon: Coins, color: "from-amber-400 to-amber-600",
      title: "Koin Talenta & Toko",
      body: "Kumpulkan Koin dari login harian (streak!), memetakan CV, menyelesaikan ujian & kelas. Tukar Koin untuk membuka akses kelas/ujian lebih cepat.",
      tip: "Penting: Koin membeli AKSES, bukan BUKTI — sertifikat & rank tetap hanya dari lulus ujian.",
      href: "/app/toko", hrefLabel: "Buka Toko",
    },
    {
      art: "start", Icon: Sparkles, color: "from-brand-600 to-emerald-500",
      title: "Siap mulai!",
      body: "Langkah paling berdampak: Upload CV → pilih kompetensi target → belajar di Kelas → buktikan lewat Ujian. Ingin paham cara skoring & rank? Buka tab 'Cara Kerja Sistem'.",
      tip: "Butuh bantuan? AI Mentor siap 24/7 di pojok kanan bawah.",
      href: "/app/cv-upload", hrefLabel: "Mulai dari Upload CV",
    },
  ];
}

// Penjelasan cara kerja sistem inti (permintaan #6): skoring, ranking, AI, validasi.
const SYSTEMS = [
  {
    Icon: Trophy, color: "#a855f7", title: "Skill Rank (Bronze → Legend)",
    points: [
      "9 tier: Bronze, Silver, Gold, Platinum, Emerald, Diamond, Master, Grandmaster, Legend.",
      "Rank ditentukan KOMPETENSI yang dibuktikan — bukan ijazah. Lulusan SMK terampil bisa menyalip S3.",
      "Pendidikan hanya jadi 'seed' (titik awal); rank efektif = maksimum dari seed, kompetensi, & bukti.",
    ],
  },
  {
    Icon: Gauge, color: "#2563eb", title: "Cara Rank Dihitung",
    points: [
      "Skor penguasaan = (unit lulus × 8) + (sertifikat × 10) + (kelas selesai × 4).",
      "Skor itu dipetakan ke tier: mis. Gold mulai 0, Emerald 32, Diamond 55, Master 85, Legend 160.",
      "Rank efektif = MAX(seed pendidikan, rank dari kompetensi [dibatasi bobot], rank dari bukti eksternal).",
    ],
  },
  {
    Icon: Scale, color: "#f59e0b", title: "Bobot Kompetensi & Batas Rank",
    points: [
      "Tiap kompetensi punya bobot kesulitan berbeda — petani ≠ ahli pertanian.",
      "Rank hasil ujian DIBATASI bobot kompetensi (cap), mencegah 'overcapacity' (rank ahli dari skill dasar).",
      "AI mengklasifikasikan bobot tiap kompetensi (rank maksimal 5–9) secara otomatis.",
    ],
  },
  {
    Icon: BadgeCheck, color: "#10b981", title: "Bukti Eksternal → Tingkat Ahli",
    points: [
      "Sertifikasi resmi (BNSP/nasional/internasional), portofolio, & pengalaman bisa MENEMBUS batas bobot.",
      "AI menilai kredibilitas & relevansinya; hanya yang terverifikasi yang menaikkan rank.",
      "Tetap butuh koroborasi ujian — bukti menaikkan maksimal +2 tier di atas rank ujian.",
    ],
  },
  {
    Icon: ClipboardCheck, color: "#6366f1", title: "Ujian 3 Tipe (Validasi Nyata)",
    points: [
      "Tiap unit: 10–15 soal campuran — pilihan ganda, studi kasus situasional, & urutan langkah.",
      "Isian & urutan dinilai AI (skor + umpan balik); pilihan ganda dinilai otomatis.",
      "Lulus = skor ≥ 60% per unit → sertifikat unit terbit & rank diperbarui. Soal diacak tiap percobaan.",
    ],
  },
  {
    Icon: ShieldCheck, color: "#ef4444", title: "Validasi Kompetensi",
    points: [
      "Kompetensi hanya SAH setelah lulus ujian proyek ini — bukan karena tertulis di CV.",
      "CV/portofolio bisa dideteksi AI sebagai 'klaim' (mempercepat pengenalan), tapi belum tervalidasi.",
      "Di Peta Posisi, skill ditandai: tervalidasi / terdeteksi-menunggu-ujian / belum ada bukti.",
    ],
  },
  {
    Icon: Gauge, color: "#38bdf8", title: "Skor Kesiapan",
    points: [
      "Total 100 = CV & Profil (25) + Hasil Ujian (60) + Sertifikat (15, bonus).",
      "Dihitung ulang otomatis setelah kamu unggah CV atau menyelesaikan ujian.",
      "Status: Siap Naik (≥80), Dalam Proses (≥50), atau Perlu Peningkatan.",
    ],
  },
  {
    Icon: Brain, color: "#8b5cf6", title: "Cara Kerja AI",
    points: [
      "AI menyusun materi kelas, membuat soal ujian, menilai jawaban isian, & mengklasifikasi bobot kompetensi.",
      "AI juga memverifikasi bukti eksternal, mendeteksi klaim skill dari CV/portofolio, & menyusun Learning Path.",
      "AI memakai datamu sebagai konteks — tapi tidak menggantikan ujian sebagai penentu kompetensi.",
    ],
  },
  {
    Icon: Coins, color: "#f59e0b", title: "Koin Talenta",
    points: [
      "Didapat dari login harian (streak), memetakan CV, menyelesaikan ujian & kelas.",
      "Dipakai untuk membuka akses kelas/ujian lebih cepat (lompati urutan).",
      "Koin membeli AKSES, bukan BUKTI — tidak pernah memberi sertifikat atau menaikkan rank langsung.",
    ],
  },
];

function TourView({ name, onClose, onSwitch }) {
  const navigate = useNavigate();
  const [i, setI] = useState(0);
  const all = steps(name);
  const s = all[i];
  const Icon = s.Icon;
  const last = i === all.length - 1;
  function go(href) { onClose(); navigate(href); }

  return (
    <>
      <div className={`relative bg-gradient-to-br ${s.color} text-white px-6 pt-5 pb-5 overflow-hidden`}>
        <div className="absolute -right-8 -top-10 w-40 h-40 rounded-full bg-white/10 pointer-events-none" />
        <button onClick={onClose} className="absolute top-3 right-3 z-10 text-white/80 hover:text-white" aria-label="Tutup"><X className="w-5 h-5" /></button>
        <div className="relative h-24 sm:h-28 mb-2"><TourArt kind={s.art} /></div>
        <div className="relative flex items-center gap-2.5">
          <div className="rounded-lg bg-white/15 w-9 h-9 flex items-center justify-center shrink-0"><Icon className="w-5 h-5" /></div>
          <h2 className="text-lg font-bold leading-snug pr-6 text-white">{s.title}</h2>
        </div>
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
        <button onClick={onSwitch} className="flex items-center gap-2 text-xs font-medium hover:underline" style={{ color: "var(--text-4)" }}>
          <ListChecks className="w-3.5 h-3.5" /> Pelajari cara kerja sistem (skor, rank, AI) →
        </button>
      </div>

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
    </>
  );
}

function SystemsView({ onClose, onSwitch }) {
  return (
    <>
      <div className="relative bg-gradient-to-br from-brand-600 to-tosca-500 text-white px-6 pt-5 pb-5 overflow-hidden">
        <div className="absolute -right-8 -top-10 w-40 h-40 rounded-full bg-white/10 pointer-events-none" />
        <button onClick={onClose} className="absolute top-3 right-3 z-10 text-white/80 hover:text-white" aria-label="Tutup"><X className="w-5 h-5" /></button>
        <div className="relative flex items-center gap-2.5">
          <div className="rounded-lg bg-white/15 w-9 h-9 flex items-center justify-center shrink-0"><ListChecks className="w-5 h-5" /></div>
          <div>
            <h2 className="text-lg font-bold leading-snug text-white">Cara Kerja Sistem</h2>
            <p className="text-xs text-white/80">Skoring, ranking, ujian, validasi & AI — bagaimana semuanya bekerja.</p>
          </div>
        </div>
      </div>

      <div className="p-4 sm:p-5 space-y-3 overflow-y-auto" style={{ maxHeight: "60vh" }}>
        {SYSTEMS.map((sys) => (
          <div key={sys.title} className="rounded-xl p-4" style={{ background: "var(--bg-muted)", border: "1px solid var(--border)" }}>
            <div className="flex items-center gap-2 mb-2">
              <div className="w-8 h-8 rounded-lg grid place-items-center shrink-0" style={{ background: `${sys.color}22`, color: sys.color }}>
                <sys.Icon className="w-4 h-4" />
              </div>
              <h3 className="text-sm font-bold" style={{ color: "var(--text-base)" }}>{sys.title}</h3>
            </div>
            <ul className="space-y-1.5">
              {sys.points.map((p, i) => (
                <li key={i} className="text-xs leading-relaxed flex gap-2" style={{ color: "var(--text-3)" }}>
                  <span className="mt-1 w-1 h-1 rounded-full shrink-0" style={{ background: sys.color }} />{p}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>

      <div className="flex items-center justify-between gap-2 px-4 sm:px-6 py-4" style={{ borderTop: "1px solid var(--border)" }}>
        <button onClick={onSwitch} className="btn-outline text-sm py-1.5 px-3 flex items-center gap-1"><ArrowLeft className="w-4 h-4" /> Panduan Fitur</button>
        <button onClick={onClose} className="btn-primary text-sm py-1.5 px-4">Selesai</button>
      </div>
    </>
  );
}

function HelpModal({ name, onClose }) {
  const [view, setView] = useState("tour"); // tour | systems
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-2xl overflow-hidden flex flex-col" style={{ backgroundColor: "var(--bg-surface)", border: "1px solid var(--border)", boxShadow: "var(--shadow)", maxHeight: "92vh" }}>
        {view === "tour"
          ? <TourView name={name} onClose={onClose} onSwitch={() => setView("systems")} />
          : <SystemsView onClose={onClose} onSwitch={() => setView("tour")} />}
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
      <button onClick={() => setOpen(true)} title="Panduan fitur & cara kerja sistem"
        className="p-2 rounded-xl transition-colors hover:bg-brand-50" style={{ color: "var(--text-3)" }} aria-label="Bantuan">
        <HelpCircle size={18} />
      </button>
      {open && <HelpModal name={user?.name} onClose={() => setOpen(false)} />}
    </>
  );
}
