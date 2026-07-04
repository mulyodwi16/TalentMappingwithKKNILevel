import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { Compass, MapPin, Building2, CheckCircle2, XCircle, Award, Loader2, TrendingUp, Star, BookOpen, Target } from "lucide-react";
import toast from "react-hot-toast";
import api from "../../api/client.js";
import { markMission } from "../../lib/missions.js";

function matchColor(score) {
  if (score >= 80) return "#10b981";
  if (score >= 50) return "#f59e0b";
  return "#ef4444";
}

function PositionCard({ job, onTarget, targeting }) {
  const [open, setOpen] = useState(false);
  const m = job.match;
  return (
    <div className="card p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-base font-bold" style={{ color: "var(--text-base)" }}>{job.title}</p>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs mt-1" style={{ color: "var(--text-3)" }}>
            {job.company && <span className="flex items-center gap-1"><Building2 className="w-3.5 h-3.5" />{job.company}</span>}
            {job.location && <span className="flex items-center gap-1"><MapPin className="w-3.5 h-3.5" />{job.location}</span>}
            <span className="badge bg-brand-500/20 text-brand-400 border border-brand-500/30">KKNI {job.kkniLevel}+</span>
            <span>min. {job.minExperience} th</span>
          </div>
        </div>
        {m && (
          <div className="text-center shrink-0">
            <p className="text-2xl font-black" style={{ color: matchColor(m.score) }}>{m.score}%</p>
            <p className="text-[10px]" style={{ color: "var(--text-4)" }}>kesiapan</p>
          </div>
        )}
      </div>

      {m && (
        <div className={`mt-2 text-xs font-medium ${m.eligible ? "text-emerald-500" : "text-amber-600"}`}>
          {m.eligible ? "✓ Skill-mu sudah memenuhi posisi ini" : "Belum sepenuhnya memenuhi — cek yang perlu dikejar"}
        </div>
      )}

      {job.description && <p className="text-sm mt-2 line-clamp-2" style={{ color: "var(--text-2)" }}>{job.description}</p>}

      <div className="flex flex-wrap gap-1.5 mt-3">
        {job.skills.map((s) => {
          const has = m ? m.matchedSkills.includes(s) : false;
          return (
            <span key={s} className={`text-xs px-2 py-0.5 rounded-full flex items-center gap-1 ${has ? "bg-emerald-500/15 text-emerald-500" : "bg-red-500/10 text-red-400"}`}>
              {m && (has ? <CheckCircle2 className="w-3 h-3" /> : <XCircle className="w-3 h-3" />)} {s}
            </span>
          );
        })}
      </div>

      <div className="flex items-center gap-2 mt-4">
        <button onClick={() => setOpen((v) => !v)} className="btn-outline text-xs py-1.5 px-3">{open ? "Tutup" : "Detail & Modul"}</button>
        <button
          onClick={() => onTarget(job)}
          disabled={targeting}
          className={`text-xs py-1.5 px-4 ml-auto rounded-xl font-medium flex items-center gap-1.5 transition-colors ${job.targeted ? "bg-brand-600 text-white" : "btn-outline"}`}
        >
          {targeting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : job.targeted ? <CheckCircle2 className="w-3.5 h-3.5" /> : <Target className="w-3.5 h-3.5" />}
          {job.targeted ? "Jadi Target" : "Jadikan Target"}
        </button>
      </div>

      {open && (
        <div className="mt-4 pt-4 space-y-3 text-sm" style={{ borderTop: "1px solid var(--border)" }}>
          {m && (
            <>
              <p className="flex items-center gap-2" style={{ color: "var(--text-2)" }}>
                {m.levelOk ? <CheckCircle2 className="w-4 h-4 text-emerald-500" /> : <XCircle className="w-4 h-4 text-red-500" />}
                Jenjang KKNI {m.levelOk ? "terpenuhi" : `kurang ${m.levelGap} tingkat`}
              </p>
              <p className="flex items-center gap-2" style={{ color: "var(--text-2)" }}>
                {m.expOk ? <CheckCircle2 className="w-4 h-4 text-emerald-500" /> : <XCircle className="w-4 h-4 text-red-500" />}
                Pengalaman {m.expOk ? "terpenuhi" : `kurang ${m.expGap} tahun`}
              </p>
              {m.missingSkills.length > 0 && (
                <div className="rounded-lg p-3" style={{ backgroundColor: "var(--bg-raised)" }}>
                  <p className="text-xs font-semibold mb-1 flex items-center gap-1.5" style={{ color: "var(--text-3)" }}><TrendingUp className="w-3.5 h-3.5 text-amber-500" /> Yang perlu dikejar:</p>
                  <p className="text-xs" style={{ color: "var(--text-2)" }}>{m.missingSkills.join(", ")}</p>
                </div>
              )}
            </>
          )}
          {job.modules?.length > 0 && (
            <div className="rounded-lg p-3" style={{ backgroundColor: "var(--bg-raised)" }}>
              <p className="text-xs font-semibold mb-2 flex items-center gap-1.5" style={{ color: "var(--text-3)" }}><BookOpen className="w-3.5 h-3.5 text-brand-600" /> Modul untuk memenuhi posisi ini (dari HRD):</p>
              <ul className="space-y-1">
                {job.modules.map((mod, i) => (
                  <li key={i} className="text-xs flex items-center gap-1.5" style={{ color: "var(--text-2)" }}>
                    <span className="text-brand-600">▸</span>
                    {mod.url ? <a href={mod.url} target="_blank" rel="noopener noreferrer" className="text-brand-600 hover:underline">{mod.title}</a> : mod.title}
                  </li>
                ))}
              </ul>
            </div>
          )}
          <Link to="/app/learning-path" className="text-xs text-brand-600 hover:underline inline-flex items-center gap-1">Buka Learning Path untuk menutup gap →</Link>
        </div>
      )}
    </div>
  );
}

export default function Jobs() {
  const qc = useQueryClient();
  const [targeting, setTargeting] = useState(null);

  useEffect(() => { markMission("open_jobs"); }, []);

  const { data: jobs = [], isLoading } = useQuery({ queryKey: ["jobs"], queryFn: () => api.get("/jobs") });
  const { data: certs = [] } = useQuery({ queryKey: ["certificates"], queryFn: () => api.get("/user/certificates") });

  async function toggleTarget(job) {
    setTargeting(job.id);
    try {
      const r = await api.post(`/jobs/${job.id}/interest`);
      toast.success(r.targeted ? "Ditandai sebagai target karier 🎯" : "Target dilepas");
      qc.invalidateQueries(["jobs"]);
    } catch (e) {
      toast.error(typeof e === "string" ? e : "Gagal");
    } finally { setTargeting(null); }
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold flex items-center gap-2" style={{ color: "var(--text-base)" }}><Compass className="w-5 h-5 text-brand-600" /> Peta Posisi & Kesiapan</h2>
        <p className="text-sm mt-1" style={{ color: "var(--text-3)" }}>Posisi target dari HRD — cek apakah skill-mu sudah memenuhi, lihat yang perlu dikejar, dan jadikan target kariermu.</p>
      </div>

      {/* Sertifikat & skill saya */}
      <div className="card p-5">
        <p className="text-sm font-bold mb-2 flex items-center gap-2" style={{ color: "var(--text-base)" }}><Award className="w-4 h-4 text-amber-500" /> Sertifikat Kompetensi Saya</p>
        {certs.length === 0 ? (
          <p className="text-sm" style={{ color: "var(--text-4)" }}>Belum ada. Lulus ujian kompetensi untuk mendapatkan sertifikat yang menaikkan kesiapanmu ke posisi tertentu.</p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {certs.map((c) => (
              <span key={c.id} className="text-xs px-2.5 py-1 rounded-full bg-amber-500/15 text-amber-600 flex items-center gap-1">
                <Award className="w-3 h-3" /> {c.name} · {c.score}%
              </span>
            ))}
          </div>
        )}
      </div>

      {isLoading ? (
        <div className="text-center py-10" style={{ color: "var(--text-4)" }}>Memuat posisi…</div>
      ) : jobs.length === 0 ? (
        <div className="card p-10 text-center">
          <div className="text-4xl mb-3">🧭</div>
          <p className="font-bold" style={{ color: "var(--text-base)" }}>Belum ada posisi</p>
          <p className="text-sm mt-1" style={{ color: "var(--text-3)" }}>HRD belum memetakan posisi target. Cek lagi nanti.</p>
        </div>
      ) : (
        <div className="grid lg:grid-cols-2 gap-4">
          {jobs.map((job) => (
            <PositionCard key={job.id} job={job} onTarget={toggleTarget} targeting={targeting === job.id} />
          ))}
        </div>
      )}
    </div>
  );
}
