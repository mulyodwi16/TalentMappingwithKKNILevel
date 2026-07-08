import { useEffect, useState, useCallback, useRef } from "react";
import { Link, useSearchParams } from "react-router-dom";
import toast from "react-hot-toast";
import {
  User, Target, FileText, GraduationCap, Award, Search, Loader2,
  Pencil, Save, X, Briefcase, Building2, Clock, ListChecks, Sparkles,
} from "lucide-react";
import api from "../../api/client.js";
import useAuthStore from "../../store/authStore.js";
import RankBadge from "../../components/RankBadge.jsx";
import RankHero from "../../components/RankHero.jsx";
import RankIdentityCard from "../../components/RankIdentityCard.jsx";
import CertificateModal from "../../components/CertificateModal.jsx";
import AvatarCropModal from "../../components/AvatarCropModal.jsx";
import SkkniPicker from "../../components/SkkniPicker.jsx";
import { RANKS, rankName, rankOf } from "../../lib/rank.js";
import { useLang, getLang, dateLocale } from "../../lib/i18n.jsx";

const fmtDate = (d) => (d ? new Date(d).toLocaleDateString(dateLocale(getLang()), { day: "numeric", month: "short", year: "numeric" }) : "—");

export default function Profile() {
  const { t } = useLang();
  const { user } = useAuthStore();
  const [sp] = useSearchParams();
  const welcome = sp.get("welcome") === "1";
  const [ov, setOv] = useState(null);
  const [chosenDoc, setChosenDoc] = useState(null); // { units: [...] }
  const [loading, setLoading] = useState(true);
  const [viewCert, setViewCert] = useState(null);
  const fileRef = useRef(null);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [cropFile, setCropFile] = useState(null); // File → buka editor posisi/zoom (#2)
  // Aksi cepat mengontrol modal/form di kartu detail (action-first, #2).
  const [skkniPicking, setSkkniPicking] = useState(false);
  const [evidenceOpen, setEvidenceOpen] = useState(false);

  const openEvidence = useCallback(() => {
    setEvidenceOpen(true);
    setTimeout(() => document.getElementById("evidence-card")?.scrollIntoView({ behavior: "smooth", block: "center" }), 60);
  }, []);

  // Deep-link dari Dashboard (aksi cepat): ?welcome/pick → buka picker kompetensi; ?evidence → buka form bukti.
  const pickParam = welcome || sp.get("pick") === "1";
  const evidenceParam = sp.get("evidence") === "1";
  useEffect(() => { if (pickParam && ov && !(welcome && ov.chosenSkkni)) setSkkniPicking(true); }, [pickParam, welcome, ov]);
  useEffect(() => { if (evidenceParam && ov) openEvidence(); }, [evidenceParam, ov, openEvidence]);

  function onAvatarPick(e) {
    const file = e.target.files?.[0];
    e.target.value = ""; // izinkan pilih file sama lagi
    if (!file) return;
    if (!/^image\//.test(file.type)) { toast.error(t("File harus berupa gambar")); return; }
    setCropFile(file); // JANGAN langsung unggah — user atur posisi & ukuran dulu.
  }

  async function saveCroppedAvatar(dataUrl) {
    setUploadingAvatar(true);
    try {
      await api.put("/user/avatar", { avatarUrl: dataUrl });
      toast.success(t("Foto profil diperbarui"));
      setCropFile(null);
      await load();
    } catch (err) {
      toast.error(typeof err === "string" ? err : t("Gagal mengunggah foto"));
    } finally { setUploadingAvatar(false); }
  }

  const load = useCallback(async () => {
    try {
      const data = await api.get("/user/overview");
      setOv(data);
      if (data.chosenSkkni?.id) {
        const c = await api.get("/skkni/chosen");
        setChosenDoc(c.doc || null);
      } else {
        setChosenDoc(null);
      }
    } catch (e) {
      toast.error(typeof e === "string" ? e : "Gagal memuat profil");
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => { load(); }, [load]);

  // Bila unit kompetensi sedang ditarik di latar belakang, polling sampai siap (maks ~2,5 mnt).
  const pending = ov?.chosenSkkni?.id && chosenDoc && !chosenDoc.unitsCached;
  useEffect(() => {
    if (!pending) return;
    let tries = 0;
    const iv = setInterval(async () => {
      tries += 1;
      try {
        const c = await api.get("/skkni/chosen");
        if (c.doc) {
          setChosenDoc(c.doc);
          if (c.doc.unitsCached) { clearInterval(iv); load(); }
        }
      } catch { /* diam */ }
      if (tries >= 30) clearInterval(iv);
    }, 5000);
    return () => clearInterval(iv);
  }, [pending, load]);

  if (loading) return <div className="text-center py-16 text-sm" style={{ color: "var(--text-4)" }}>{t("Memuat profil…")}</div>;
  if (!ov) return null;

  const p = ov.profile || {};
  const cv = ov.cv || {};
  const hasCv = cv.parsedAt || cv.education;

  return (
    <div className="space-y-6">
      <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={onAvatarPick} />
      {cropFile && (
        <AvatarCropModal file={cropFile} saving={uploadingAvatar}
          onSave={saveCroppedAvatar} onClose={() => !uploadingAvatar && setCropFile(null)} />
      )}

      {/* Baris atas: frame rank (kiri) + kartu identitas & Data Diri DI LUAR frame (kanan).
          items-stretch → tinggi frame rank menyejajarkan kolom kanan (tak ada sisa ruang). */}
      <div className="grid lg:grid-cols-[minmax(0,1fr)_320px] gap-4 items-stretch">
        <RankHero
          rank={ov.rank}
          rankInfo={ov.rankInfo}
          readiness={ov.readiness?.total ?? p.readinessScore ?? 0}
          competency={ov.chosenSkkni?.title}
        />
        <div className="space-y-4">
          <RankIdentityCard
            level={ov.rank?.effective ?? p.currentKkniLevel}
            identity={{
              name: p.name,
              email: p.email,
              subtitle: [p.position, p.department].filter(Boolean).join(" · ") || p.academicStatus || t("Talenta"),
              targetLabel: p.targetKkniLevel ? t("Target: {rank}", { rank: rankName(p.targetKkniLevel) }) : null,
              photoUrl: p.avatarUrl,
              uploading: uploadingAvatar,
              onPhotoClick: () => fileRef.current?.click(),
              onPhotoRemove: async () => { await api.put("/user/avatar", { avatarUrl: "" }); toast.success(t("Foto dihapus")); load(); },
            }}
          />
          {/* Data Diri di bawah foto (pindah dari bawah halaman) */}
          <EditableIdentity profile={p} onSaved={load} compact />
        </div>
      </div>

      {/* ── Detail ringkas — 2 kolom agar tak memanjang penuh ke bawah (#1/#3).
          Aksi interaktif (upload CV, ganti kompetensi, tambah bukti, ujian) ada di Dashboard;
          di sini fokus MELIHAT data & pencapaian. Picker/form tetap bisa dibuka via deep-link. ── */}
      <div className="grid lg:grid-cols-2 gap-4 items-start">
        {/* Sertifikat terbaru */}
        <div className="card p-5">
          <div className="flex items-center justify-between gap-2 mb-3">
            <h2 className="text-sm font-semibold flex items-center gap-2" style={{ color: "var(--text-base)" }}>
              <Award className="w-4 h-4 text-brand-600" /> {t("Sertifikat Terbaru")}
            </h2>
            <Link to="/app/exam" className="text-xs text-brand-600 hover:underline">{t("Ikut ujian →")}</Link>
          </div>
          {ov.certificates?.length ? (
            <div className="space-y-2">
              {ov.certificates.slice(0, 4).map((c) => (
                <button key={c.id} onClick={() => setViewCert(c)}
                  className="w-full text-left flex items-center gap-2 rounded-lg p-2.5 transition-colors hover:bg-[var(--bg-muted)]" style={{ border: "1px solid var(--border)" }}>
                  <Award className="w-4 h-4 text-amber-500 shrink-0" />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium truncate" style={{ color: "var(--text-base)" }}>{c.name}</p>
                    <p className="text-[11px]" style={{ color: "var(--text-4)" }}>{t("Skor")} {c.score}% · {fmtDate(c.issuedAt)} · <span className="text-brand-600">{t("lihat sertifikat")}</span></p>
                  </div>
                  {c.kkniLevel ? <RankBadge level={c.kkniLevel} showNum={false} /> : null}
                </button>
              ))}
              {ov.certificates.length > 4 && (
                <p className="text-[11px] text-center pt-1" style={{ color: "var(--text-4)" }}>{t("+{n} sertifikat lainnya", { n: ov.certificates.length - 4 })}</p>
              )}
            </div>
          ) : (
            <p className="text-sm" style={{ color: "var(--text-4)" }}>{t("Belum ada sertifikat. Lulus")} <Link to="/app/exam" className="text-brand-600 hover:underline">{t("Ujian Kompetensi")}</Link> {t("untuk menerbitkannya.")}</p>
          )}
        </div>

        {/* Kelas yang diikuti */}
        <div className="card p-5">
          <div className="flex items-center justify-between gap-2 mb-3">
            <h2 className="text-sm font-semibold flex items-center gap-2" style={{ color: "var(--text-base)" }}>
              <GraduationCap className="w-4 h-4 text-brand-600" /> {t("Kelas yang Diikuti")}
            </h2>
            <Link to="/app/kelas" className="text-xs text-brand-600 hover:underline">{t("Buka Kelas →")}</Link>
          </div>
          {ov.classes?.length ? (
            <div className="space-y-2">
              {ov.classes.slice(0, 4).map((c, i) => (
                <div key={i} className="flex items-center justify-between gap-2 rounded-lg p-2.5" style={{ border: "1px solid var(--border)" }}>
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate" style={{ color: "var(--text-base)" }}>{c.name}</p>
                    <p className="text-[11px]" style={{ color: "var(--text-4)" }}>{c.kind === "avataredu" ? "AvatarEdu" : t("Kelas Premium")} · {fmtDate(c.at)}</p>
                  </div>
                  <span className="text-[10px] font-semibold px-2 py-1 rounded-full bg-emerald-500/10 text-emerald-500 shrink-0">{c.status}</span>
                </div>
              ))}
              {ov.classes.length > 4 && (
                <p className="text-[11px] text-center pt-1" style={{ color: "var(--text-4)" }}>{t("+{n} kelas lainnya", { n: ov.classes.length - 4 })}</p>
              )}
            </div>
          ) : (
            <p className="text-sm" style={{ color: "var(--text-4)" }}>{t("Belum mengikuti kelas. Kunjungi")} <Link to="/app/kelas" className="text-brand-600 hover:underline">{t("Kelas")}</Link>.</p>
          )}
        </div>

        {/* Kompetensi SKKNI target — patokan semua fitur */}
        <SkkniSection chosen={ov.chosenSkkni} doc={chosenDoc} onChanged={load} picking={skkniPicking} setPicking={setSkkniPicking} />

        {/* Ringkasan CV */}
        <div className="card p-5">
          <div className="flex items-center justify-between gap-2 mb-3">
            <h2 className="text-sm font-semibold flex items-center gap-2" style={{ color: "var(--text-base)" }}>
              <FileText className="w-4 h-4 text-brand-600" /> {t("Ringkasan CV")}
            </h2>
            <Link to="/app/cv-upload" className="text-xs text-brand-600 hover:underline">{hasCv ? t("Perbarui CV") : t("Upload CV")}</Link>
          </div>
          {!hasCv ? (
            <p className="text-sm" style={{ color: "var(--text-4)" }}>{t("Belum ada CV. Upload CV agar datamu bisa dibandingkan dengan standar SKKNI.")}</p>
          ) : (
            <div className="space-y-3">
              <div className="grid grid-cols-3 gap-2">
                <MiniStat icon={GraduationCap} label={t("Pendidikan")} value={cv.education || p.education || "—"} />
                <MiniStat icon={Clock} label={t("Pengalaman")} value={t("{n} tahun", { n: cv.experienceYears ?? p.experienceYears ?? 0 })} />
                <MiniStat icon={Sparkles} label={t("Keahlian")} value={t("{n} item", { n: [...new Set([...(cv.skills || []), ...(cv.certifications || [])])].length })} />
              </div>
              {(cv.skills?.length > 0 || cv.certifications?.length > 0) && (
                <div>
                  <p className="text-xs mb-1.5" style={{ color: "var(--text-4)" }}>{t("Keahlian/Sertifikasi terdeteksi")}</p>
                  <div className="flex flex-wrap gap-1.5">
                    {[...new Set([...(cv.skills || []), ...(cv.certifications || [])])].slice(0, 12).map((s) => (
                      <span key={s} className="text-xs rounded-lg px-2 py-0.5" style={{ background: "var(--bg-muted)", color: "var(--text-3)" }}>{s}</span>
                    ))}
                  </div>
                </div>
              )}
              <p className="text-[11px]" style={{ color: "var(--text-4)" }}>
                {cv.fileName ? `${cv.fileName} · ` : ""}{t("diperbarui")} {fmtDate(cv.parsedAt)}
              </p>
            </div>
          )}
        </div>
      </div>

      {/* ── Rincian panjang (Kesiapan/Rank + Bukti) — 2 kolom ── */}
      <div className="grid lg:grid-cols-2 gap-4 items-start">
        <ReadinessCard readiness={ov.readiness} rankInfo={ov.rankInfo} rank={ov.rank} level={ov.rank?.effective ?? p.currentKkniLevel} />
        <EvidenceCard rank={ov.rank} onChanged={load} open={evidenceOpen} setOpen={setEvidenceOpen} />
      </div>

      {viewCert && <CertificateModal cert={viewCert} holder={p.name} onClose={() => setViewCert(null)} />}
    </div>
  );
}

// Rincian skor kesiapan (CV + Ujian + Sertifikat) + penjelasan Rank (diraih dari kompetensi).
function ReadinessCard({ readiness, rankInfo, rank, level }) {
  const { t } = useLang();
  const r = readiness || { total: 0, cv: 0, exam: 0, cert: 0 };
  const rk = level ? rankOf(level) : null;
  const parts = [
    { key: "cv", label: t("CV & Profil"), val: r.cv, max: 25, color: "#38bdf8", icon: FileText },
    { key: "exam", label: t("Hasil Ujian"), val: r.exam, max: 60, color: "#2563eb", icon: ListChecks },
    { key: "cert", label: t("Sertifikat (bonus)"), val: r.cert, max: 15, color: "#10b981", icon: Award },
  ];
  const raisedBySkill = rank && rank.earned > rank.seed;
  return (
    <div className="card p-5">
      <div className="flex items-center justify-between gap-2 mb-3">
        <h2 className="text-sm font-semibold flex items-center gap-2" style={{ color: "var(--text-base)" }}>
          <Target className="w-4 h-4 text-brand-600" /> {t("Skor Kesiapan")}
        </h2>
        <span className="text-2xl font-bold font-mono text-brand-600">{r.total}%</span>
      </div>
      <div className="space-y-2.5">
        {parts.map((p) => (
          <div key={p.key}>
            <div className="flex items-center justify-between text-xs mb-1">
              <span className="flex items-center gap-1.5" style={{ color: "var(--text-3)" }}><p.icon className="w-3 h-3" /> {p.label}</span>
              <span style={{ color: "var(--text-4)" }}>{p.val}<span className="opacity-60">/{p.max}</span></span>
            </div>
            <div className="h-2 rounded-full overflow-hidden" style={{ background: "var(--bg-muted)" }}>
              <div className="h-full rounded-full transition-all" style={{ width: `${(p.val / p.max) * 100}%`, background: p.color }} />
            </div>
          </div>
        ))}
      </div>
      <p className="text-[11px] mt-3" style={{ color: "var(--text-4)" }}>
        {t("Kesiapan = CV (25) + Ujian (60) + Sertifikat (15, bonus).")}
      </p>

      {/* Penjelasan Rank — diraih dari kompetensi, bukan ijazah */}
      <div className="mt-4 pt-3" style={{ borderTop: "1px solid var(--border)" }}>
        <div className="flex items-center justify-between gap-2 mb-1.5">
          <span className="text-xs font-semibold" style={{ color: "var(--text-base)" }}>{t("Rank kamu")}</span>
          {rk && <RankBadge level={level} />}
        </div>
        {rankInfo ? (
          <p className="text-[11px]" style={{ color: "var(--text-3)" }}>
            <b style={{ color: rk?.color }}>{rk?.name}</b> — {rankInfo.title} ({rankInfo.jobGroup}), {t("setara jenjang")} {rankInfo.educationMapping}.
          </p>
        ) : (
          <p className="text-[11px]" style={{ color: "var(--text-4)" }}>{t("Rank belum terpetakan.")}</p>
        )}

        {rank && (
          <div className="mt-2 rounded-lg p-2.5 text-[11px]" style={{ background: "var(--bg-muted)", color: "var(--text-3)" }}>
            <div className="flex items-center gap-1.5 flex-wrap">
              <span>{t("Dari pendidikan:")} <b>{rankName(rank.seed)}</b></span>
              <span aria-hidden>→</span>
              <span>{t("diraih dari kompetensi:")} <b style={{ color: rankOf(rank.earned)?.color }}>{rankName(rank.earned)}</b></span>
            </div>

            {/* Bobot kompetensi & cap rank (transparansi anti-overcapacity) */}
            {rank.weightCap && (
              <div className="mt-1.5 pt-1.5" style={{ borderTop: "1px dashed var(--border-2)" }}>
                <span>{t("Bobot kompetensi:")} <b style={{ color: "var(--text-2)" }}>{rank.weightTier || "—"}</b> · {t("rank maks dari ujian:")} <b style={{ color: rankOf(rank.weightCap)?.color }}>{rankName(rank.weightCap)}</b></span>
                {rank.cappedByWeight && (
                  <p className="mt-1 text-amber-600">
                    {t("Rank ujianmu dibatasi bobot kompetensi ini. Untuk melampaui menuju ahli, tambahkan bukti eksternal: sertifikasi resmi (BNSP/nasional/internasional), portofolio, & pengalaman kerja.")}
                  </p>
                )}
                {rank.weightReason && <p className="mt-0.5" style={{ color: "var(--text-4)" }}>{rank.weightReason}</p>}
              </div>
            )}

            <p className="mt-1.5" style={{ color: "var(--text-4)" }}>
              {raisedBySkill
                ? t("Kompetensimu menaikkan rank di atas jenjang pendidikan. 💪")
                : t("Buktikan lebih banyak kompetensi (lulus ujian, sertifikat, course) untuk naik rank.")}
            </p>
            {rank.next && !rank.cappedByWeight && (
              <p className="mt-1" style={{ color: "var(--text-4)" }}>
                {t("Menuju")} <b>{rankName(rank.next.level)}</b>: {t("kumpulkan {n} poin kompetensi lagi (≈ {a} unit lulus / {b} sertifikat).", { n: rank.next.need, a: Math.ceil(rank.next.need / 8), b: Math.ceil(rank.next.need / 10) })}
              </p>
            )}
          </div>
        )}

        <div className="flex flex-wrap gap-1 mt-2">
          {RANKS.filter((x) => x.level >= 3).map((x) => {
            const capped = rank?.weightCap && x.level > rank.weightCap;
            return (
              <span key={x.level} className="text-[10px] px-1.5 py-0.5 rounded-full"
                style={{ background: x.level === level ? `${x.color}22` : "var(--bg-muted)", color: x.level === level ? x.color : "var(--text-4)", border: x.level === level ? `1px solid ${x.color}66` : "1px solid transparent", opacity: capped ? 0.4 : 1 }}
                title={capped ? t("Perlu bukti eksternal untuk mencapai rank ini") : undefined}>
                {x.name}{capped ? " 🔒" : ""}
              </span>
            );
          })}
        </div>
        <p className="text-[10px] mt-1.5" style={{ color: "var(--text-4)" }}>
          {t("Rank ditentukan kompetensi yang dibuktikan — bukan ijazah. Tiap kompetensi punya bobot berbeda (petani ≠ ahli pertanian): rank via ujian dibatasi bobotnya. Menuju rank ahli butuh bukti eksternal (sertifikasi resmi, portofolio, pengalaman).")}
        </p>
      </div>
    </div>
  );
}

function MiniStat({ icon: Icon, label, value }) {
  return (
    <div className="rounded-xl p-3" style={{ background: "var(--bg-muted)" }}>
      <p className="text-xs flex items-center gap-1 mb-0.5" style={{ color: "var(--text-4)" }}><Icon className="w-3 h-3" /> {label}</p>
      <p className="font-semibold text-sm truncate" style={{ color: "var(--text-base)" }}>{value}</p>
    </div>
  );
}

// ── Bagian kompetensi SKKNI (target + pencarian + unit) ──────────────────────
function SkkniSection({ chosen, doc, onChanged, picking, setPicking }) {
  const { t } = useLang();

  return (
    <div className="card p-5" style={{ borderColor: "var(--brand-600, #2563eb)" }}>
      <div className="flex items-center justify-between gap-2 mb-3">
        <h2 className="text-sm font-semibold flex items-center gap-2" style={{ color: "var(--text-base)" }}>
          <Target className="w-4 h-4 text-brand-600" /> {t("Kompetensi SKKNI Target")}
        </h2>
        <button onClick={() => setPicking(true)} className="text-xs btn-outline py-1 px-2.5 flex items-center gap-1">
          <Search className="w-3 h-3" /> {chosen ? t("Ganti") : t("Pilih kompetensi")}
        </button>
      </div>

      {!chosen ? (
        <p className="text-sm" style={{ color: "var(--text-3)" }}>
          {t("Belum ada kompetensi target. Pilih 1 bidang/profesi SKKNI resmi Kemnaker — ini menjadi")}
          <b> {t("acuan semua fitur")}</b> {t("(skill yang diperlukan, soal ujian, syarat naik rank, analisis gap, mentor).")}
        </p>
      ) : (
        <div className="space-y-3">
          <div>
            <p className="text-base font-semibold" style={{ color: "var(--text-base)" }}>{chosen.title}</p>
            <p className="text-xs" style={{ color: "var(--text-4)" }}>
              {doc?.numberKepmen ? `${doc.numberKepmen} · ` : ""}
              {!doc?.unitsCached ? t("menyiapkan skill…") : t("{n} unit kompetensi (skill)", { n: doc?.unitCount ?? doc?.units?.length ?? 0 })}
            </p>
          </div>
          {!doc?.unitsCached ? (
            <div className="flex items-center gap-2 text-xs rounded-lg px-3 py-2.5" style={{ background: "var(--bg-muted)", color: "var(--text-3)" }}>
              <Loader2 className="w-3.5 h-3.5 animate-spin text-brand-600 shrink-0" />
              {t("Menyiapkan daftar skill dari standar SKKNI Kemnaker… biasanya di bawah 1 menit. Halaman ini akan memperbarui sendiri.")}
            </div>
          ) : doc?.units?.length ? (
            <div>
              <p className="text-xs flex items-center gap-1 mb-1.5" style={{ color: "var(--text-4)" }}><ListChecks className="w-3 h-3" /> {t("Unit kompetensi (skill terstandar)")}</p>
              <div className="max-h-56 overflow-y-auto space-y-1 pr-1">
                {doc.units.map((u) => (
                  <div key={u.code} className="flex items-start gap-2 text-sm rounded-lg px-2.5 py-1.5" style={{ background: "var(--bg-muted)" }}>
                    <span className="text-[10px] font-mono mt-0.5 px-1.5 py-0.5 rounded shrink-0" style={{ background: "var(--bg-surface)", color: "var(--text-4)" }}>{u.code}</span>
                    <span style={{ color: "var(--text-3)" }}>{u.title}</span>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <p className="text-xs" style={{ color: "var(--text-4)" }}>{t("Dokumen ini belum memiliki daftar unit terdigitasi di Kemnaker.")}</p>
          )}
          <p className="text-[11px]" style={{ color: "var(--text-4)" }}>{t("Sumber: API resmi SKKNI Kemnaker (data tersimpan lokal).")}</p>
        </div>
      )}

      {picking && <SkkniPicker onClose={() => setPicking(false)} onChosen={() => { setPicking(false); onChanged(); }} />}
    </div>
  );
}


// ── Data diri editable ───────────────────────────────────────────────────────
// `compact` = tampilan 1 kolom untuk kolom sempit (di bawah kartu identitas, kanan frame rank).
function EditableIdentity({ profile, onSaved, compact = false }) {
  const { t } = useLang();
  const [edit, setEdit] = useState(false);
  const [form, setForm] = useState({});
  const [saving, setSaving] = useState(false);

  function start() {
    setForm({
      name: profile.name || "", department: profile.department || "", position: profile.position || "",
      education: profile.education || "", experienceYears: profile.experienceYears ?? 0,
      targetKkniLevel: profile.targetKkniLevel || "",
    });
    setEdit(true);
  }
  async function save() {
    setSaving(true);
    try {
      const payload = { ...form, experienceYears: Number(form.experienceYears) || 0 };
      if (payload.targetKkniLevel) payload.targetKkniLevel = Number(payload.targetKkniLevel);
      else delete payload.targetKkniLevel;
      await api.put("/user/profile", payload);
      toast.success(t("Data diri diperbarui"));
      setEdit(false);
      onSaved();
    } catch (e) {
      toast.error(typeof e === "string" ? e : t("Gagal menyimpan"));
    } finally {
      setSaving(false);
    }
  }

  const rows = [
    { icon: User, label: t("Nama"), value: profile.name || "—" },
    { icon: Building2, label: t("Departemen"), value: profile.department || "—" },
    { icon: Briefcase, label: t("Posisi"), value: profile.position || "—" },
    { icon: GraduationCap, label: t("Pendidikan"), value: profile.education || "—" },
    { icon: Clock, label: t("Pengalaman"), value: t("{n} tahun", { n: profile.experienceYears ?? 0 }) },
    { icon: Target, label: t("Target Rank"), value: profile.targetKkniLevel ? rankName(profile.targetKkniLevel) : "—" },
  ];

  return (
    <div className="card p-5">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-sm font-semibold flex items-center gap-2" style={{ color: "var(--text-base)" }}><User className="w-4 h-4 text-brand-600" /> {t("Data Diri")}</h2>
        {!edit ? (
          <button onClick={start} className="text-xs btn-outline py-1 px-2.5 flex items-center gap-1"><Pencil className="w-3 h-3" /> {t("Ubah")}</button>
        ) : (
          <div className="flex gap-2">
            <button onClick={() => setEdit(false)} className="text-xs btn-outline py-1 px-2.5">{t("Batal")}</button>
            <button onClick={save} disabled={saving} className="text-xs btn-primary py-1 px-2.5 flex items-center gap-1">
              {saving ? <Loader2 className="w-3 h-3 animate-spin" /> : <Save className="w-3 h-3" />} {t("Simpan")}
            </button>
          </div>
        )}
      </div>

      {!edit ? (
        <div className={`grid gap-2 ${compact ? "" : "sm:grid-cols-2"}`}>
          {rows.map((r) => (
            <div key={r.label} className="flex items-center gap-2 text-sm py-1.5">
              <r.icon className="w-4 h-4 shrink-0" style={{ color: "var(--text-4)" }} />
              <span style={{ color: "var(--text-4)" }}>{r.label}:</span>
              <span className="font-medium truncate" style={{ color: "var(--text-base)" }}>{r.value}</span>
            </div>
          ))}
        </div>
      ) : (
        <div className={`grid gap-3 ${compact ? "" : "sm:grid-cols-2"}`}>
          <Field label={t("Nama")}><input className="input text-sm" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></Field>
          <Field label={t("Departemen")}><input className="input text-sm" value={form.department} onChange={(e) => setForm({ ...form, department: e.target.value })} /></Field>
          <Field label={t("Posisi")}><input className="input text-sm" value={form.position} onChange={(e) => setForm({ ...form, position: e.target.value })} /></Field>
          <Field label={t("Pendidikan")}><input className="input text-sm" value={form.education} onChange={(e) => setForm({ ...form, education: e.target.value })} placeholder={t("mis. S1, SMK")} /></Field>
          <Field label={t("Pengalaman (tahun)")}><input type="number" min="0" className="input text-sm" value={form.experienceYears} onChange={(e) => setForm({ ...form, experienceYears: e.target.value })} /></Field>
          <Field label={t("Target Rank")}>
            <select className="input text-sm" value={form.targetKkniLevel} onChange={(e) => setForm({ ...form, targetKkniLevel: e.target.value })}>
              <option value="">{t("— tidak diset —")}</option>
              {RANKS.map((r) => <option key={r.level} value={r.level}>{r.name} (Rank {r.level})</option>)}
            </select>
          </Field>
        </div>
      )}
    </div>
  );
}

function Field({ label, children }) {
  return (
    <label className="block">
      <span className="text-xs block mb-1" style={{ color: "var(--text-4)" }}>{label}</span>
      {children}
    </label>
  );
}

// ── Bukti kompetensi eksternal (#2b): sertifikasi resmi, portofolio, pengalaman, pelatihan ──
const EV_TYPE = {
  certification: { label: "Sertifikasi resmi", icon: Award },
  portfolio:     { label: "Portofolio",        icon: Briefcase },
  experience:    { label: "Pengalaman kerja",  icon: Building2 },
  training:      { label: "Pelatihan/Webinar", icon: GraduationCap },
};
const EV_STATUS = {
  verified: { label: "Terverifikasi", cls: "bg-emerald-500/15 text-emerald-500" },
  rejected: { label: "Ditolak",       cls: "bg-red-500/15 text-red-400" },
  pending:  { label: "Ditinjau",      cls: "bg-amber-500/15 text-amber-500" },
};

function EvidenceCard({ rank, onChanged, open, setOpen }) {
  const { t } = useLang();
  const [items, setItems] = useState(null);
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({ type: "certification", title: "", issuer: "", description: "", url: "" });

  const load = useCallback(async () => {
    try { const d = await api.get("/evidence"); setItems(d.items || []); } catch { setItems([]); }
  }, []);
  useEffect(() => { load(); }, [load]);

  async function submit(e) {
    e.preventDefault();
    if (!form.title.trim()) { toast.error(t("Judul bukti wajib diisi")); return; }
    setBusy(true);
    try {
      const r = await api.post("/evidence", form, { timeout: 60_000 });
      const st = r.item?.status;
      if (st === "verified") toast.success(t("Bukti terverifikasi AI ✓"));
      else if (st === "rejected") toast.error(t("Bukti belum bisa diverifikasi — lengkapi detail"));
      else toast(t("Bukti disimpan, menunggu tinjauan"), { icon: "🕓" });
      setForm({ type: "certification", title: "", issuer: "", description: "", url: "" });
      setOpen(false);
      await load();
      onChanged?.();
    } catch (e2) {
      toast.error(typeof e2 === "string" ? e2 : t("Gagal menambah bukti"));
    } finally { setBusy(false); }
  }

  async function remove(id) {
    try { await api.delete(`/evidence/${id}`); await load(); onChanged?.(); toast.success(t("Bukti dihapus")); }
    catch { toast.error(t("Gagal menghapus")); }
  }

  const verifiedCount = (items || []).filter((i) => i.status === "verified").length;

  return (
    <div id="evidence-card" className="card p-5">
      <div className="flex items-center justify-between gap-2 mb-1">
        <h2 className="text-sm font-semibold flex items-center gap-2" style={{ color: "var(--text-base)" }}>
          <Sparkles className="w-4 h-4 text-brand-600" /> {t("Bukti Kompetensi Eksternal")}
        </h2>
        <button onClick={() => setOpen(!open)} className="text-xs text-brand-600 hover:underline">{open ? t("Tutup") : t("+ Tambah bukti")}</button>
      </div>
      <p className="text-xs mb-3" style={{ color: "var(--text-4)" }}>
        {t("Sertifikasi resmi (BNSP/nasional/internasional), portofolio, & pengalaman kerja — diverifikasi AI. Ini")} <b>{t("poin plus")}</b> {t("yang bisa menembus batas rank dari ujian menuju tingkat")} <b>{t("ahli")}</b>{rank?.cappedByWeight ? t(" — rank ujianmu sedang tercapai batasnya, tambahkan bukti untuk melampaui.") : "."}
      </p>

      {open && (
        <form onSubmit={submit} className="rounded-xl p-3 mb-3 space-y-2" style={{ background: "var(--bg-raised)", border: "1px solid var(--border)" }}>
          <div className="grid sm:grid-cols-2 gap-2">
            <select className="input text-sm" value={form.type} onChange={(e) => setForm((f) => ({ ...f, type: e.target.value }))}>
              {Object.entries(EV_TYPE).map(([k, v]) => <option key={k} value={k}>{t(v.label)}</option>)}
            </select>
            <input className="input text-sm" placeholder={t("Judul (mis. Sertifikat BNSP Multimedia)")} value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} />
            <input className="input text-sm" placeholder={t("Penerbit/Institusi (mis. BNSP)")} value={form.issuer} onChange={(e) => setForm((f) => ({ ...f, issuer: e.target.value }))} />
            <input className="input text-sm" placeholder={t("Tautan bukti (opsional)")} value={form.url} onChange={(e) => setForm((f) => ({ ...f, url: e.target.value }))} />
          </div>
          <textarea className="input text-sm h-16 resize-none" placeholder={t("Deskripsi: apa yang dikuasai / lingkup pengalaman…")} value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} />
          <button type="submit" disabled={busy} className="btn-primary text-xs py-1.5 w-full flex items-center justify-center gap-1.5">
            {busy ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> {t("Memverifikasi (AI)…")}</> : t("Kirim & Verifikasi")}
          </button>
        </form>
      )}

      {items === null ? (
        <p className="text-xs" style={{ color: "var(--text-4)" }}>{t("Memuat…")}</p>
      ) : items.length === 0 ? (
        <p className="text-xs" style={{ color: "var(--text-4)" }}>{t("Belum ada bukti eksternal.")} {rank?.cappedByWeight ? t("Tambahkan untuk naik ke rank ahli.") : ""}</p>
      ) : (
        <div className="space-y-2">
          {verifiedCount > 0 && rank?.boostedByEvidence && (
            <p className="text-[11px] text-emerald-500">{t("Bukti terverifikasi menaikkan rank efektifmu di atas batas ujian. 💪")}</p>
          )}
          {items.map((it) => {
            // JANGAN beri nama `t` — men-shadow fungsi terjemahan useLang.
            const evType = EV_TYPE[it.type] || EV_TYPE.certification;
            const st = EV_STATUS[it.status] || EV_STATUS.pending;
            const TIcon = evType.icon;
            return (
              <div key={it.id} className="rounded-lg p-3" style={{ background: "var(--bg-raised)", border: "1px solid var(--border)" }}>
                <div className="flex items-start gap-2">
                  <TIcon className="w-4 h-4 mt-0.5 text-brand-500 shrink-0" />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-sm font-medium truncate" style={{ color: "var(--text-base)" }}>{it.title}</p>
                      <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${st.cls}`}>{t(st.label)}</span>
                      {it.status === "verified" && it.rankImplied > 0 && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded-full" style={{ background: `${rankOf(it.rankImplied)?.color}22`, color: rankOf(it.rankImplied)?.color }}>
                          ≈ {rankName(it.rankImplied)}
                        </span>
                      )}
                    </div>
                    <p className="text-[11px]" style={{ color: "var(--text-4)" }}>{t(EV_TYPE[it.type]?.label || "Sertifikasi resmi")}{it.issuer ? ` · ${it.issuer}` : ""}{it.status !== "pending" ? ` · ${t("kredibilitas")} ${it.credibility}%` : ""}</p>
                    {it.verdict && <p className="text-[11px] mt-0.5" style={{ color: "var(--text-3)" }}>{it.verdict}</p>}
                  </div>
                  <button onClick={() => remove(it.id)} className="p-1 rounded hover:bg-red-500/10 shrink-0" style={{ color: "var(--text-4)" }} title={t("Hapus")}><X className="w-3.5 h-3.5" /></button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
