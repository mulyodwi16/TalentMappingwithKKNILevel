import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Compass, TrendingDown, ArrowRight, AlertTriangle } from "lucide-react";
import api from "../api/client.js";
import { useLang } from "../lib/i18n.jsx";

// Dua panel yang mengubah keputusan HRD:
//   • Corong per posisi - "posisi mana yang perlu kuurus hari ini", tanpa membuka satu-satu.
//   • Kekurangan kolam talenta - "kelas apa yang perlu dibuka", menyambungkan seleksi ke
//     pengembangan. Ini yang membuat platform jadi jembatan, bukan sekadar penyaring.

function Stat({ value, label, tone }) {
  return (
    <div className="text-center px-2">
      <p className="text-lg font-black tabular-nums" style={{ color: tone || "var(--text-base)" }}>{value}</p>
      <p className="text-[10px] uppercase tracking-wider" style={{ color: "var(--text-4)" }}>{label}</p>
    </div>
  );
}

export function JobPipeline() {
  const { t } = useLang();
  const { data, isLoading } = useQuery({ queryKey: ["hrd-pipeline"], queryFn: () => api.get("/hrd/pipeline") });
  const jobs = data?.jobs || [];

  return (
    <div className="card p-6">
      <div className="flex items-center justify-between gap-3 mb-3">
        <h3 className="font-semibold flex items-center gap-2" style={{ color: "var(--text-base)" }}>
          <Compass className="w-4 h-4 text-brand-600" /> {t("Corong Kandidat per Posisi")}
        </h3>
        <Link to="/app/hrd/jobs" className="text-xs text-brand-500 hover:underline flex items-center gap-1">
          {t("Kelola posisi")} <ArrowRight className="w-3 h-3" />
        </Link>
      </div>

      {isLoading ? (
        <p className="text-sm text-center py-6" style={{ color: "var(--text-4)" }}>{t("Memuat…")}</p>
      ) : !jobs.length ? (
        <p className="text-sm text-center py-6" style={{ color: "var(--text-4)" }}>{t("Belum ada posisi terbuka. Buka posisi dulu di Peta Posisi.")}</p>
      ) : (
        <div className="space-y-2">
          {jobs.map((j) => (
            <div key={j.id} className="rounded-xl p-3" style={{ border: "1px solid var(--border)" }}>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm font-semibold truncate" style={{ color: "var(--text-base)" }}>{j.title}</p>
                  <p className="text-[11px] truncate" style={{ color: "var(--text-4)" }}>
                    {j.company || t("Internal")} · {t("kandidat terbaik")}: {j.best ? `${j.best.name} (${j.best.score}%)` : "-"}
                  </p>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <Stat value={j.eligible} label={t("siap")} tone={j.eligible ? "#10b981" : undefined} />
                  <Stat value={j.almost} label={t("tinggal diuji")} tone={j.almost ? "#f59e0b" : undefined} />
                  <Stat value={j.interested} label={t("berminat")} />
                  <Stat value={j.shortlisted} label={t("dipilih")} />
                </div>
              </div>

              {/* Posisi tanpa kandidat siap = sinyal, bukan sekadar angka nol. */}
              {j.eligible === 0 && (
                <p className="text-[11px] mt-2 flex items-start gap-1.5 text-amber-500">
                  <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-px" />
                  {j.hardestSkills?.length
                    ? t("Belum ada yang memenuhi syarat. Paling banyak tersandung: {skills}.", { skills: j.hardestSkills.map((h) => h.skill).join(", ") })
                    : t("Belum ada yang memenuhi syarat.")}
                </p>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export function SkillShortage() {
  const { t } = useLang();
  const { data, isLoading } = useQuery({ queryKey: ["hrd-shortage"], queryFn: () => api.get("/hrd/skill-shortage") });
  const skills = data?.skills || [];

  return (
    <div className="card p-6">
      <h3 className="font-semibold flex items-center gap-2 mb-1" style={{ color: "var(--text-base)" }}>
        <TrendingDown className="w-4 h-4 text-amber-500" /> {t("Kekurangan Kolam Talenta")}
      </h3>
      <p className="text-xs mb-3" style={{ color: "var(--text-4)" }}>
        {t("Skill yang diminta posisimu tapi paling sedikit dikuasai - ini dasar untuk menentukan kelas yang perlu dibuka.")}
      </p>

      {isLoading ? (
        <p className="text-sm text-center py-6" style={{ color: "var(--text-4)" }}>{t("Memuat…")}</p>
      ) : !skills.length ? (
        <p className="text-sm text-center py-6" style={{ color: "var(--text-4)" }}>{t("Belum ada posisi terbuka, jadi belum ada syarat yang bisa dibandingkan.")}</p>
      ) : (
        <div className="space-y-2.5">
          {skills.map((s) => (
            <div key={s.skill}>
              <div className="flex items-baseline justify-between gap-2 mb-1">
                <span className="text-xs truncate" style={{ color: "var(--text-2)" }}>{s.skill}</span>
                <span className="text-[11px] shrink-0 tabular-nums" style={{ color: "var(--text-4)" }}>
                  {t("{a} dari {b} talenta", { a: s.proven, b: data.workerCount })}
                </span>
              </div>
              <div className="h-1.5 rounded-full overflow-hidden flex" style={{ background: "var(--bg-muted)" }}>
                <div className="h-full" style={{ width: `${s.coverage}%`, background: s.coverage >= 50 ? "#10b981" : s.coverage > 0 ? "#f59e0b" : "transparent" }} />
              </div>
              <p className="text-[10px] mt-0.5" style={{ color: "var(--text-4)" }}>
                {t("diminta {n} posisi", { n: s.jobs })}
                {s.claimed > 0 && <span className="text-amber-500"> · {t("{n} mengklaim tapi belum diuji", { n: s.claimed })}</span>}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
