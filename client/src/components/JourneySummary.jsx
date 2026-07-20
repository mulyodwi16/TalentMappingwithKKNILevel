import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Award, BarChart3, Crosshair, FileText, GraduationCap, Route, ArrowRight } from "lucide-react";
import api from "../api/client.js";
import { rankName, rankColor } from "../lib/rank.js";
import { useLang } from "../lib/i18n.jsx";

// Ringkasan perjalanan di Dashboard: enam kondisi penting yang selama ini tersebar di
// halaman lain (kompetensi, skill gap, learning path, pemahaman, sertifikat, data penunjang).
// Dashboard adalah halaman pertama yang dilihat - pengguna harus tahu posisinya tanpa
// membuka enam menu dulu. Tiap kartu adalah pintasan ke halaman aslinya.

function Card({ to, icon: Icon, color, title, value, sub, bar, tone }) {
  return (
    <Link to={to} className="card p-4 hover:scale-[1.02] transition-transform flex flex-col gap-2 min-w-0">
      <div className="flex items-center gap-2 min-w-0">
        <span className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0" style={{ background: `${color}1f`, color }}>
          <Icon className="w-4 h-4" />
        </span>
        <p className="text-xs font-semibold uppercase tracking-wider truncate" style={{ color: "var(--text-4)" }}>{title}</p>
        <ArrowRight className="w-3.5 h-3.5 ml-auto shrink-0" style={{ color: "var(--text-4)" }} />
      </div>
      <p className="text-lg font-bold leading-tight truncate" style={{ color: tone || "var(--text-base)" }}>{value}</p>
      {bar != null && (
        <div className="h-1.5 rounded-full overflow-hidden" style={{ background: "var(--bg-muted)" }}>
          <div className="h-full rounded-full transition-all" style={{ width: `${Math.max(0, Math.min(100, bar))}%`, background: color }} />
        </div>
      )}
      <p className="text-xs leading-snug" style={{ color: "var(--text-3)" }}>{sub}</p>
    </Link>
  );
}

export default function JourneySummary({ overview, assessments = [] }) {
  const { t } = useLang();

  // Rencana belajar dibaca (bukan disusun) - penyusunan tetap milik halaman Learning Path.
  const { data: lp } = useQuery({ queryKey: ["learning-path"], queryFn: () => api.get("/learning-path/") });

  const rank = overview?.rank;
  const readiness = overview?.readiness;
  const cv = overview?.cv || {};
  const certs = overview?.certificates || [];
  const classes = overview?.classes || [];

  const gaps = assessments.filter((a) => a.gap > 0).sort((a, b) => b.gap - a.gap);
  const mastered = assessments.filter((a) => a.currentScore >= 60).length;
  const steps = lp?.plan?.steps || [];
  const stepsDone = steps.filter((s) => s.progress === "done").length;
  const nextStep = steps.find((s) => s.progress !== "done");

  const links = cv.links || {};
  const linkCount = ["linkedin", "instagram", "portfolio", "other"].filter((k) => links[k]).length;
  const extraCerts = (cv.extraCertifications || []).length;
  const evidence = readiness?.evidenceCount || 0;
  const supporting = (cv.parsedAt ? 1 : 0) + (linkCount ? 1 : 0) + (extraCerts ? 1 : 0) + (evidence ? 1 : 0);

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
      {/* 1. Kompetensi & tangga rank */}
      <Card
        to="/app/profile" icon={Crosshair} color="#6366f1"
        title={t("Kompetensi Saat Ini")}
        value={overview?.chosenSkkni?.title || t("Belum dipilih")}
        tone={rank?.effective ? rankColor(rank.effective) : undefined}
        bar={rank?.next?.cumTotal ? Math.round((rank.next.cumDone / rank.next.cumTotal) * 100) : rank?.effective ? 100 : 0}
        sub={
          !rank?.effective ? t("Unggah CV atau ambil tes untuk memetakan rank-mu.")
            : rank.next ? `${rankName(rank.effective)} - ${t("kuasai {n} unit lagi", { n: rank.next.need })} ${t("menuju")} ${rankName(rank.next.level)}`
              : `${rankName(rank.effective)} - ${t("sudah di puncak kompetensi ini")}`
        }
      />

      {/* 2. Skill gap */}
      <Card
        to="/app/skill-gap" icon={BarChart3} color="#f59e0b"
        title={t("Skill Gap")}
        value={assessments.length === 0 ? t("Belum terukur") : t("{n} unit bisa ditingkatkan", { n: gaps.length })}
        bar={assessments.length ? Math.round((mastered / assessments.length) * 100) : 0}
        sub={
          assessments.length === 0 ? t("Ambil Tes Penempatan supaya gap-mu langsung terlihat.")
            : gaps.length ? `${t("Terbesar:")} ${gaps[0].competencyName} (${gaps[0].currentScore}%)`
              : t("Semua unit terukur sudah terpenuhi.")
        }
      />

      {/* 3. Learning path */}
      <Card
        to="/app/learning-path" icon={Route} color="#8b5cf6"
        title={t("Learning Path")}
        value={steps.length ? t("{a} dari {b} langkah", { a: stepsDone, b: steps.length }) : t("Belum tersusun")}
        bar={steps.length ? Math.round((stepsDone / steps.length) * 100) : 0}
        sub={nextStep ? `${t("Berikutnya:")} ${nextStep.title}` : steps.length ? t("Semua langkah tuntas.") : t("Pilih kompetensi dulu - rencana disusun otomatis.")}
      />

      {/* 4. Pemahaman dari kelas & latihan */}
      <Card
        to="/app/exam" icon={GraduationCap} color="#12a594"
        title={t("Pemahaman")}
        value={assessments.length ? t("{a} dari {b} unit dikuasai", { a: mastered, b: assessments.length }) : t("Belum ada latihan")}
        bar={assessments.length ? Math.round((mastered / assessments.length) * 100) : 0}
        sub={t("{n} kelas diikuti", { n: classes.length })}
      />

      {/* 5. Sertifikat kompetensi */}
      <Card
        to={certs.length ? "/app/profile" : "/app/final-exam"} icon={Award} color="#10b981"
        title={t("Sertifikat")}
        value={certs.length ? t("{n} sertifikat", { n: certs.length }) : t("Belum ada")}
        sub={certs.length ? certs[0].name : t("Terbit dari Ujian Kompetensi Utama - satu untuk seluruh kompetensi.")}
      />

      {/* 6. Data penunjang diri */}
      <Card
        to="/app/cv-upload" icon={FileText} color="#2563eb"
        title={t("Data Penunjang")}
        value={cv.parsedAt ? t("CV sudah ada") : t("CV belum ada")}
        bar={(supporting / 4) * 100}
        sub={t("{a} tautan · {b} sertifikasi tambahan · {c} bukti terverifikasi", { a: linkCount, b: extraCerts, c: evidence })}
      />
    </div>
  );
}
