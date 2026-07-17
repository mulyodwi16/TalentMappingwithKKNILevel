import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import {
  Compass, MapPin, Building2, CheckCircle2, XCircle, Award, Loader2, TrendingUp,
  BookOpen, Target, GraduationCap, PenLine, FileText, ShieldCheck, Clock, ArrowRight, Info,
} from "lucide-react";
import toast from "react-hot-toast";
import api from "../../api/client.js";
import { markMission } from "../../lib/missions.js";
import { rankName } from "../../lib/rank.js";
import { useLang } from "../../lib/i18n.jsx";

function matchColor(score) {
  if (score >= 80) return "#10b981";
  if (score >= 50) return "#f59e0b";
  return "#ef4444";
}

// Status validasi sebuah skill terhadap invariant proyek: bukti sah = LULUS UJIAN.
const SKILL_STATUS = {
  validated: { label: "Tervalidasi", sub: "lulus ujian", Icon: ShieldCheck, color: "#10b981", chip: "bg-emerald-500/15 text-emerald-500" },
  claimed:   { label: "Terdeteksi CV/portofolio", sub: "menunggu validasi ujian", Icon: Clock, color: "#f59e0b", chip: "bg-amber-500/15 text-amber-500" },
  missing:   { label: "Belum ada bukti", sub: "pelajari & buktikan", Icon: XCircle, color: "#ef4444", chip: "bg-red-500/10 text-red-400" },
};

// Form kirim CV/portofolio untuk mengklaim satu skill (AI mendeteksi indikasi bukti).
function ClaimForm({ jobId, skill, onDone }) {
  const { t } = useLang();
  const [detail, setDetail] = useState("");
  const [busy, setBusy] = useState(false);
  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    try {
      const r = await api.post(`/jobs/${jobId}/detect-skill`, { skill, detail }, { timeout: 60_000 });
      if (r.detected) toast.success(t("AI mendeteksi bukti skill ini — kini menunggu validasi ujian."));
      else toast(r.note || t("Belum ada indikasi kuat di CV/portofolio."), { icon: "🔍" });
      onDone();
    } catch (e2) {
      toast.error(typeof e2 === "string" ? e2 : t("Gagal memproses"));
    } finally { setBusy(false); }
  }
  return (
    <form onSubmit={submit} className="mt-2 rounded-lg p-2.5 space-y-2" style={{ background: "var(--bg-raised)", border: "1px solid var(--border)" }}>
      <p className="text-[11px]" style={{ color: "var(--text-4)" }}>
        {t("Ceritakan pengalaman/portofolio yang membuktikan")} <b style={{ color: "var(--text-2)" }}>{skill}</b> {t("(mis. proyek, tautan, hasil kerja). AI + CV-mu akan dinilai.")}
      </p>
      <textarea value={detail} onChange={(e) => setDetail(e.target.value)} rows={2}
        placeholder={t("mis. Mengedit 30+ video promosi untuk klien X, portofolio: link…")}
        className="input text-xs resize-none w-full" />
      <button type="submit" disabled={busy} className="btn-primary text-[11px] py-1.5 px-3 w-full flex items-center justify-center gap-1.5">
        {busy ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> {t("Menilai (AI)…")}</> : t("Kirim untuk dideteksi AI")}
      </button>
    </form>
  );
}

// Rincian langkah memenuhi sebuah posisi (level, pengalaman, tiap skill) + status validasi.
function FulfillmentPlan({ job, onChanged }) {
  const { t } = useLang();
  const m = job.match;
  const [claimFor, setClaimFor] = useState(null);
  if (!m) return null;
  const claimNote = (skill) => (job.claims || []).find((c) => c.skill === skill)?.aiNote;

  const skillRow = (skill, status) => {
    const s = SKILL_STATUS[status];
    return (
      <div key={skill} className="rounded-lg p-2.5" style={{ background: "var(--bg-raised)", border: "1px solid var(--border)" }}>
        <div className="flex items-center gap-2 flex-wrap">
          <s.Icon className="w-4 h-4 shrink-0" style={{ color: s.color }} />
          <span className="text-sm font-medium" style={{ color: "var(--text-base)" }}>{skill}</span>
          <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${s.chip}`}>{t(s.label)}</span>
        </div>
        {status === "claimed" && (
          <p className="text-[11px] mt-1 pl-6" style={{ color: "var(--text-4)" }}>
            {claimNote(skill) || t("Terindikasi dari CV/portofolio.")} <b style={{ color: s.color }}>{t("Lulus ujiannya agar kompetensi ini sah.")}</b>
          </p>
        )}
        {status !== "validated" && (
          <div className="flex items-center gap-2 flex-wrap mt-2 pl-6">
            <Link to="/app/kelas" className="text-[11px] inline-flex items-center gap-1 text-brand-600 hover:underline"><GraduationCap className="w-3 h-3" /> {t("Pelajari di Kelas")}</Link>
            <Link to="/app/exam" className="text-[11px] inline-flex items-center gap-1 font-semibold text-white bg-brand-600 hover:bg-brand-700 px-2 py-0.5 rounded"><PenLine className="w-3 h-3" /> {t("Validasi via Ujian")}</Link>
            {status === "missing" && (
              <button onClick={() => setClaimFor(claimFor === skill ? null : skill)} className="text-[11px] inline-flex items-center gap-1 hover:underline" style={{ color: "var(--text-3)" }}>
                <FileText className="w-3 h-3" /> {t("Kirim CV/Portofolio")}
              </button>
            )}
          </div>
        )}
        {claimFor === skill && <ClaimForm jobId={job.id} skill={skill} onDone={() => { setClaimFor(null); onChanged(); }} />}
      </div>
    );
  };

  return (
    <div className="mt-4 pt-4 space-y-3" style={{ borderTop: "1px solid var(--border)" }}>
      {/* Penjelasan aturan validasi */}
      <div className="rounded-lg p-3 text-xs flex gap-2" style={{ background: "var(--bg-raised)", color: "var(--text-3)" }}>
        <Info className="w-4 h-4 shrink-0 text-brand-500 mt-0.5" />
        <p>{t("Untuk memenuhi target ini:")} <b>{t("kuasai skill di Kelas")}</b>, {t("lalu")} <b>{t("buktikan lewat Ujian")}</b>. {t("CV/portofolio bisa dideteksi AI untuk mempercepat pengenalan skill-mu — tapi kompetensi")} <b>{t("hanya sah setelah lulus ujian")}</b>.</p>
      </div>

      {/* Level & pengalaman */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        <div className="rounded-lg p-2.5 flex items-center gap-2" style={{ background: "var(--bg-raised)" }}>
          {m.levelOk ? <CheckCircle2 className="w-4 h-4 text-emerald-500" /> : <XCircle className="w-4 h-4 text-red-500" />}
          <div className="text-xs">
            <p style={{ color: "var(--text-base)" }}>{m.levelOk ? t("Skill Rank terpenuhi") : t("Skill Rank kurang {n} tier", { n: m.levelGap })}</p>
            {!m.levelOk && <p style={{ color: "var(--text-4)" }}>{t("Naik rank dengan lulus lebih banyak unit ujian & sertifikat.")}</p>}
          </div>
        </div>
        <div className="rounded-lg p-2.5 flex items-center gap-2" style={{ background: "var(--bg-raised)" }}>
          {m.expOk ? <CheckCircle2 className="w-4 h-4 text-emerald-500" /> : <XCircle className="w-4 h-4 text-amber-500" />}
          <div className="text-xs">
            <p style={{ color: "var(--text-base)" }}>{m.expOk ? t("Pengalaman terpenuhi") : t("Pengalaman kurang {n} tahun", { n: m.expGap })}</p>
            {!m.expOk && <p style={{ color: "var(--text-4)" }}>{t("Isi pengalaman di Profil / lampirkan bukti.")}</p>}
          </div>
        </div>
      </div>

      {/* Skill per status */}
      <div>
        <p className="text-xs font-semibold mb-2 flex items-center gap-1.5" style={{ color: "var(--text-3)" }}>
          <Target className="w-3.5 h-3.5 text-brand-600" /> {t("Skill yang diminta ({a}/{b} tervalidasi)", { a: m.matchedSkills?.length || 0, b: job.skills.length })}
        </p>
        <div className="space-y-1.5">
          {(m.matchedSkills || []).map((s) => skillRow(s, "validated"))}
          {(m.claimedSkills || []).map((s) => skillRow(s, "claimed"))}
          {(m.missingSkills || []).map((s) => skillRow(s, "missing"))}
        </div>
      </div>

      {job.modules?.length > 0 && (
        <div className="rounded-lg p-3" style={{ background: "var(--bg-raised)" }}>
          <p className="text-xs font-semibold mb-2 flex items-center gap-1.5" style={{ color: "var(--text-3)" }}><BookOpen className="w-3.5 h-3.5 text-brand-600" /> {t("Modul dari HRD:")}</p>
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

      <Link to="/app/learning-path" className="text-xs text-brand-600 hover:underline inline-flex items-center gap-1">
        {t("Susun Learning Path untuk menutup gap ini")} <ArrowRight className="w-3 h-3" />
      </Link>
    </div>
  );
}

function PositionCard({ job, onTarget, targeting }) {
  const { t } = useLang();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  // Saat dibuka, ambil detail (match + klaim skill) yang selalu segar.
  const { data: detail, isLoading } = useQuery({
    queryKey: ["job", job.id],
    queryFn: () => api.get(`/jobs/${job.id}`),
    enabled: open,
  });
  const view = detail || job;
  const m = view.match;

  return (
    <div className="card p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-base font-bold" style={{ color: "var(--text-base)" }}>{job.title}</p>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs mt-1" style={{ color: "var(--text-3)" }}>
            {job.company && <span className="flex items-center gap-1"><Building2 className="w-3.5 h-3.5" />{job.company}</span>}
            {job.location && <span className="flex items-center gap-1"><MapPin className="w-3.5 h-3.5" />{job.location}</span>}
            <span className="badge bg-brand-500/20 text-brand-400 border border-brand-500/30">{t("min.")} {rankName(job.kkniLevel)}</span>
            <span>{t("min. {n} th", { n: job.minExperience })}</span>
          </div>
        </div>
        {m && (
          <div className="text-center shrink-0">
            <p className="text-2xl font-black" style={{ color: matchColor(m.score) }}>{m.score}%</p>
            <p className="text-[10px]" style={{ color: "var(--text-4)" }}>{t("kesiapan")}</p>
          </div>
        )}
      </div>

      {m && (
        <div className={`mt-2 text-xs font-medium ${m.eligible ? "text-emerald-500" : m.readyToValidate ? "text-amber-500" : "text-amber-600"}`}>
          {m.eligible
            ? t("✓ Skill tervalidasi memenuhi posisi ini")
            : m.readyToValidate
              ? t("Skill sudah dikenali — tinggal lulus ujian untuk memvalidasi")
              : t("Belum memenuhi — buka untuk lihat langkah memenuhinya")}
        </div>
      )}

      {job.description && <p className="text-sm mt-2 line-clamp-2" style={{ color: "var(--text-2)" }}>{job.description}</p>}

      <div className="flex flex-wrap gap-1.5 mt-3">
        {job.skills.map((s) => {
          const validated = m?.matchedSkills?.includes(s);
          const claimed = m?.claimedSkills?.includes(s);
          const cls = validated ? "bg-emerald-500/15 text-emerald-500" : claimed ? "bg-amber-500/15 text-amber-500" : "bg-red-500/10 text-red-400";
          return (
            <span key={s} className={`text-xs px-2 py-0.5 rounded-full flex items-center gap-1 ${cls}`}>
              {m && (validated ? <ShieldCheck className="w-3 h-3" /> : claimed ? <Clock className="w-3 h-3" /> : <XCircle className="w-3 h-3" />)} {s}
            </span>
          );
        })}
      </div>

      <div className="flex items-center gap-2 mt-4">
        <button onClick={() => setOpen((v) => !v)} className="btn-outline text-xs py-1.5 px-3">{open ? t("Tutup") : t("Cara Memenuhi Target")}</button>
        <button onClick={() => onTarget(job)} disabled={targeting}
          className={`text-xs py-1.5 px-4 ml-auto rounded-xl font-medium flex items-center gap-1.5 transition-colors ${job.targeted ? "bg-brand-600 text-white" : "btn-outline"}`}>
          {targeting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : job.targeted ? <CheckCircle2 className="w-3.5 h-3.5" /> : <Target className="w-3.5 h-3.5" />}
          {job.targeted ? t("Jadi Target") : t("Jadikan Target")}
        </button>
      </div>

      {open && (isLoading ? (
        <div className="mt-4 pt-4 flex items-center gap-2 text-xs" style={{ borderTop: "1px solid var(--border)", color: "var(--text-4)" }}>
          <Loader2 className="w-3.5 h-3.5 animate-spin" /> {t("Memuat rincian…")}
        </div>
      ) : (
        <FulfillmentPlan job={view} onChanged={() => { qc.invalidateQueries(["job", job.id]); qc.invalidateQueries(["jobs"]); }} />
      ))}
    </div>
  );
}

export default function Jobs() {
  const { t } = useLang();
  const qc = useQueryClient();
  const [targeting, setTargeting] = useState(null);

  useEffect(() => { markMission("open_jobs"); }, []);

  const { data: jobs = [], isLoading } = useQuery({ queryKey: ["jobs"], queryFn: () => api.get("/jobs") });
  const { data: certs = [] } = useQuery({ queryKey: ["certificates"], queryFn: () => api.get("/user/certificates") });

  async function toggleTarget(job) {
    setTargeting(job.id);
    try {
      const r = await api.post(`/jobs/${job.id}/interest`);
      toast.success(r.targeted ? t("Ditandai sebagai target karier 🎯") : t("Target dilepas"));
      qc.invalidateQueries(["jobs"]);
    } catch (e) {
      toast.error(typeof e === "string" ? e : t("Gagal"));
    } finally { setTargeting(null); }
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold flex items-center gap-2" style={{ color: "var(--text-base)" }}><Compass className="w-5 h-5 text-brand-600" /> {t("Peta Posisi & Kesiapan")}</h2>
        <p className="text-sm mt-1" style={{ color: "var(--text-3)" }}>{t("Posisi target dari HRD. Buka tiap posisi untuk melihat")} <b>{t("langkah konkret memenuhinya")}</b> {t("— dan ingat: kompetensi hanya")} <b>{t("tervalidasi lewat ujian")}</b>{t(", bukan sekadar tertulis di CV.")}</p>
      </div>

      {/* Legend status skill */}
      <div className="card p-4 flex flex-wrap items-center gap-x-5 gap-y-2 text-xs">
        <span className="font-semibold" style={{ color: "var(--text-3)" }}>{t("Status skill:")}</span>
        {Object.entries(SKILL_STATUS).map(([k, s]) => (
          <span key={k} className="flex items-center gap-1.5" style={{ color: "var(--text-3)" }}>
            <s.Icon className="w-3.5 h-3.5" style={{ color: s.color }} /> <b style={{ color: s.color }}>{t(s.label)}</b>
            <span style={{ color: "var(--text-4)" }}>· {t(s.sub)}</span>
          </span>
        ))}
      </div>

      {/* Sertifikat saya */}
      <div className="card p-5">
        <p className="text-sm font-bold mb-2 flex items-center gap-2" style={{ color: "var(--text-base)" }}><Award className="w-4 h-4 text-amber-500" /> {t("Sertifikat Kompetensi Saya (bukti tervalidasi)")}</p>
        {certs.length === 0 ? (
          <p className="text-sm" style={{ color: "var(--text-4)" }}>{t("Belum ada. Lulus ujian kompetensi untuk mendapatkan sertifikat yang")} <b>{t("memvalidasi")}</b> {t("skill-mu ke posisi tertentu.")}</p>
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
        <div className="text-center py-10" style={{ color: "var(--text-4)" }}>{t("Memuat posisi…")}</div>
      ) : jobs.length === 0 ? (
        <div className="card p-10 text-center">
          <div className="text-4xl mb-3">🧭</div>
          <p className="font-bold" style={{ color: "var(--text-base)" }}>{t("Belum ada posisi")}</p>
          <p className="text-sm mt-1" style={{ color: "var(--text-3)" }}>{t("HRD belum memetakan posisi target. Cek lagi nanti.")}</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 items-start">
          {jobs.map((job) => (
            <PositionCard key={job.id} job={job} onTarget={toggleTarget} targeting={targeting === job.id} />
          ))}
        </div>
      )}
    </div>
  );
}
