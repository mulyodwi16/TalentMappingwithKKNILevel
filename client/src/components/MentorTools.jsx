import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import {
  ArrowRight, Award, BarChart3, ClipboardCheck, FileUp, GraduationCap, LayoutDashboard,
  Map, Route, ShoppingBag, Target, UserCircle,
} from "lucide-react";
import api from "../api/client.js";
import RankIcon from "./RankIcon.jsx";
import { rankName, rankColor } from "../lib/rank.js";
import { useLang } from "../lib/i18n.jsx";
import { MENTOR_ACTIONS } from "../lib/mentorTools.js";

// Wujud nyata dari tag alat Onyen: tombol pintasan + kartu data di dalam percakapan.
// Datanya diambil dari cache React Query yang sama dengan halaman lain, jadi angka di
// sini tak pernah berbeda dengan angka di Dashboard/Skill Gap.

const ICONS = {
  dashboard: LayoutDashboard, cv: FileUp, penempatan: Target, latihan: ClipboardCheck,
  ujian: Award, skillgap: BarChart3, learningpath: Route, kelas: GraduationCap,
  toko: ShoppingBag, peta: Map, profil: UserCircle,
};

function Card({ title, children }) {
  return (
    <div className="rounded-xl p-3 w-full" style={{ border: "1px solid var(--border-2)", backgroundColor: "var(--bg-raised)" }}>
      <p className="text-[11px] font-semibold uppercase tracking-wider mb-2" style={{ color: "var(--text-4)" }}>{title}</p>
      {children}
    </div>
  );
}

function Bar({ value, color = "rgb(var(--brand-500))" }) {
  return (
    <div className="h-1.5 rounded-full overflow-hidden" style={{ backgroundColor: "var(--bg-muted)" }}>
      <div className="h-full rounded-full transition-all" style={{ width: `${Math.max(0, Math.min(100, value))}%`, background: color }} />
    </div>
  );
}

function Empty({ children }) {
  return <p className="text-xs" style={{ color: "var(--text-4)" }}>{children}</p>;
}

function RankWidget({ ov, t }) {
  const level = ov?.rank?.effective;
  if (!level) return <Card title={t("Skill Rank")}><Empty>{t("Rank belum terpetakan - unggah CV dulu, ya.")}</Empty></Card>;
  const next = ov.rank.next;
  const pct = next && next.cumTotal ? Math.round((next.cumDone / next.cumTotal) * 100) : 100;
  return (
    <Card title={t("Skill Rank")}>
      <div className="flex items-center gap-3">
        <RankIcon level={level} size={44} />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-bold" style={{ color: rankColor(level) }}>{rankName(level)}</p>
          {next ? (
            <>
              <p className="text-[11px] mb-1.5" style={{ color: "var(--text-3)" }}>
                {t("Menuju")} {rankName(next.level)}: {t("kuasai {n} unit lagi", { n: next.need })}
              </p>
              <Bar value={pct} />
            </>
          ) : (
            <p className="text-[11px]" style={{ color: "var(--text-3)" }}>{t("Sudah di puncak tangga kompetensi ini.")}</p>
          )}
        </div>
      </div>
    </Card>
  );
}

function SkillGapWidget({ gaps, t }) {
  if (!gaps.length) return <Card title={t("Gap terbesar")}><Empty>{t("Belum ada data ujian - ambil Tes Penempatan dulu supaya gapmu terlihat.")}</Empty></Card>;
  return (
    <Card title={t("Gap terbesar")}>
      <div className="flex flex-col gap-2">
        {gaps.map((g) => (
          <div key={g.id || g.competencyCode}>
            <div className="flex items-baseline justify-between gap-2 mb-1">
              <span className="text-xs truncate" style={{ color: "var(--text-2)" }}>{g.competencyName}</span>
              <span className="text-[11px] font-semibold tabular-nums shrink-0" style={{ color: "var(--text-4)" }}>{g.currentScore}%</span>
            </div>
            <Bar value={g.currentScore} color={g.currentScore < 50 ? "#ef4444" : "#f59e0b"} />
          </div>
        ))}
      </div>
    </Card>
  );
}

function ReadinessWidget({ ov, t }) {
  const r = ov?.readiness;
  if (!r) return null;
  const label = r.status === "ready" ? t("Siap Naik") : r.status === "in_progress" ? t("Dalam Proses") : t("Perlu Peningkatan");
  const color = r.total >= 80 ? "#10b981" : r.total >= 50 ? "#f59e0b" : "#ef4444";
  return (
    <Card title={t("Kesiapan")}>
      <div className="flex items-baseline gap-2 mb-2">
        <span className="text-xl font-bold tabular-nums" style={{ color }}>{r.total}%</span>
        <span className="text-xs" style={{ color: "var(--text-3)" }}>{label}</span>
      </div>
      <Bar value={r.total} color={color} />
      <p className="text-[11px] mt-2" style={{ color: "var(--text-4)" }}>
        {t("CV {cv} · Ujian {exam} · Sertifikat {cert}", { cv: r.cv, exam: r.exam, cert: r.cert })}
      </p>
    </Card>
  );
}

function ProgressWidget({ ov, t }) {
  const r = ov?.readiness;
  if (!r) return null;
  const pct = r.assessed ? Math.round((r.passed / r.assessed) * 100) : 0;
  return (
    <Card title={t("Progres kompetensi")}>
      <p className="text-sm font-semibold mb-1.5" style={{ color: "var(--text-base)" }}>
        {t("{passed} dari {total} unit dikuasai", { passed: r.passed, total: r.assessed })}
      </p>
      <Bar value={pct} />
      <p className="text-[11px] mt-2" style={{ color: "var(--text-4)" }}>
        {t("Sertifikat kompetensi: {n}", { n: r.certCount })}
      </p>
    </Card>
  );
}

export default function MentorTools({ actions = [], widgets = [], compact = false }) {
  const { t } = useLang();
  const navigate = useNavigate();
  const needData = widgets.length > 0;

  const { data: ov } = useQuery({
    queryKey: ["overview"],
    queryFn: () => api.get("/user/overview"),
    enabled: needData,
  });
  const { data: assessments = [] } = useQuery({
    queryKey: ["assessments"],
    queryFn: () => api.get("/user/skill-assessments"),
    enabled: needData && widgets.includes("skillgap"),
  });

  if (!actions.length && !widgets.length) return null;

  const gaps = assessments.filter((a) => a.gap > 0).sort((a, b) => b.gap - a.gap).slice(0, 3);

  return (
    <div className="flex flex-col gap-2 w-full max-w-full">
      {widgets.map((w) => (
        <div key={w} className="companion-pop">
          {w === "rank" && <RankWidget ov={ov} t={t} />}
          {w === "skillgap" && <SkillGapWidget gaps={gaps} t={t} />}
          {w === "kesiapan" && <ReadinessWidget ov={ov} t={t} />}
          {w === "progres" && <ProgressWidget ov={ov} t={t} />}
        </div>
      ))}

      {actions.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {actions.map((key) => {
            const a = MENTOR_ACTIONS[key];
            const Icon = ICONS[key] || ArrowRight;
            return (
              <button
                key={key}
                onClick={() => navigate(a.route)}
                className={`companion-pop flex items-center gap-1.5 rounded-full font-medium transition-colors hover:border-brand-500 hover:text-brand-600 ${compact ? "px-2.5 py-1 text-[11px]" : "px-3 py-1.5 text-xs"}`}
                style={{ border: "1px solid var(--border-2)", backgroundColor: "var(--bg-raised)", color: "var(--text-2)" }}
              >
                <Icon className={compact ? "w-3 h-3" : "w-3.5 h-3.5"} /> {t(a.label)}
                <ArrowRight className={compact ? "w-3 h-3 opacity-50" : "w-3.5 h-3.5 opacity-50"} />
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
