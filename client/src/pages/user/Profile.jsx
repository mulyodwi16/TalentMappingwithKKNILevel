import { useEffect, useState, useCallback, useRef } from "react";
import { Link, useSearchParams } from "react-router-dom";
import toast from "react-hot-toast";
import {
  User, Target, FileText, GraduationCap, Award, Search, Loader2, CheckCircle2,
  Pencil, Save, X, Briefcase, Building2, Clock, ListChecks, Sparkles, RefreshCw,
} from "lucide-react";
import api from "../../api/client.js";
import useAuthStore from "../../store/authStore.js";
import RankBadge from "../../components/RankBadge.jsx";
import RankHero from "../../components/RankHero.jsx";
import RankIdentityCard from "../../components/RankIdentityCard.jsx";
import CertificateModal from "../../components/CertificateModal.jsx";
import AvatarCropModal from "../../components/AvatarCropModal.jsx";
import { RANKS, rankName, rankOf } from "../../lib/rank.js";

const fmtDate = (d) => (d ? new Date(d).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" }) : "—");

export default function Profile() {
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

  function onAvatarPick(e) {
    const file = e.target.files?.[0];
    e.target.value = ""; // izinkan pilih file sama lagi
    if (!file) return;
    if (!/^image\//.test(file.type)) { toast.error("File harus berupa gambar"); return; }
    setCropFile(file); // JANGAN langsung unggah — user atur posisi & ukuran dulu.
  }

  async function saveCroppedAvatar(dataUrl) {
    setUploadingAvatar(true);
    try {
      await api.put("/user/avatar", { avatarUrl: dataUrl });
      toast.success("Foto profil diperbarui");
      setCropFile(null);
      await load();
    } catch (err) {
      toast.error(typeof err === "string" ? err : "Gagal mengunggah foto");
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

  if (loading) return <div className="text-center py-16 text-sm" style={{ color: "var(--text-4)" }}>Memuat profil…</div>;
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

      {/* Baris atas: frame rank (kiri) + kartu identitas & Data Diri DI LUAR frame (kanan) */}
      <div className="grid lg:grid-cols-[minmax(0,1fr)_320px] gap-4 items-start">
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
              subtitle: [p.position, p.department].filter(Boolean).join(" · ") || p.academicStatus || "Talenta",
              targetLabel: p.targetKkniLevel ? `Target: ${rankName(p.targetKkniLevel)}` : null,
              photoUrl: p.avatarUrl,
              uploading: uploadingAvatar,
              onPhotoClick: () => fileRef.current?.click(),
              onPhotoRemove: async () => { await api.put("/user/avatar", { avatarUrl: "" }); toast.success("Foto dihapus"); load(); },
            }}
          />
          {/* Data Diri di bawah foto (pindah dari bawah halaman) */}
          <EditableIdentity profile={p} onSaved={load} compact />
        </div>
      </div>

      {/* Rincian Skor Kesiapan + penjelasan Rank */}
      <ReadinessCard readiness={ov.readiness} rankInfo={ov.rankInfo} rank={ov.rank} level={ov.rank?.effective ?? p.currentKkniLevel} />

      {/* Bukti kompetensi eksternal — poin plus menembus cap bobot kompetensi */}
      <EvidenceCard rank={ov.rank} onChanged={load} />

      {/* Kompetensi SKKNI target — patokan semua fitur */}
      <SkkniSection chosen={ov.chosenSkkni} doc={chosenDoc} onChanged={load} autoOpen={welcome && !ov.chosenSkkni} />

      {/* Ringkasan CV */}
      <div className="card p-5">
        <div className="flex items-center justify-between gap-2 mb-3">
          <h2 className="text-sm font-semibold flex items-center gap-2" style={{ color: "var(--text-base)" }}>
            <FileText className="w-4 h-4 text-brand-600" /> Ringkasan CV
          </h2>
          <Link to="/app/cv-upload" className="text-xs text-brand-600 hover:underline">{hasCv ? "Perbarui CV" : "Upload CV"}</Link>
        </div>
        {!hasCv ? (
          <p className="text-sm" style={{ color: "var(--text-4)" }}>Belum ada CV. Upload CV agar datamu bisa dibandingkan dengan standar SKKNI.</p>
        ) : (
          <div className="space-y-3">
            <div className="grid sm:grid-cols-3 gap-3">
              <MiniStat icon={GraduationCap} label="Pendidikan" value={cv.education || p.education || "—"} />
              <MiniStat icon={Clock} label="Pengalaman" value={`${cv.experienceYears ?? p.experienceYears ?? 0} tahun`} />
              <MiniStat icon={Sparkles} label="Keahlian terdeteksi" value={`${[...new Set([...(cv.skills || []), ...(cv.certifications || [])])].length} item`} />
            </div>
            {(cv.skills?.length > 0 || cv.certifications?.length > 0) && (
              <div>
                <p className="text-xs mb-1.5" style={{ color: "var(--text-4)" }}>Keahlian/Sertifikasi terdeteksi</p>
                <div className="flex flex-wrap gap-1.5">
                  {[...new Set([...(cv.skills || []), ...(cv.certifications || [])])].map((s) => (
                    <span key={s} className="text-xs rounded-lg px-2 py-0.5" style={{ background: "var(--bg-muted)", color: "var(--text-3)" }}>{s}</span>
                  ))}
                </div>
              </div>
            )}
            <p className="text-[11px]" style={{ color: "var(--text-4)" }}>
              {cv.fileName ? `${cv.fileName} · ` : ""}diperbarui {fmtDate(cv.parsedAt)}
            </p>
          </div>
        )}
      </div>

      {/* Kelas yang diikuti + Sertifikat */}
      <div className="grid md:grid-cols-2 gap-4">
        <div className="card p-5">
          <h2 className="text-sm font-semibold flex items-center gap-2 mb-3" style={{ color: "var(--text-base)" }}>
            <GraduationCap className="w-4 h-4 text-brand-600" /> Kelas yang Diikuti
          </h2>
          {ov.classes?.length ? (
            <div className="space-y-2">
              {ov.classes.map((c, i) => (
                <div key={i} className="flex items-center justify-between gap-2 rounded-lg p-2.5" style={{ border: "1px solid var(--border)" }}>
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate" style={{ color: "var(--text-base)" }}>{c.name}</p>
                    <p className="text-[11px]" style={{ color: "var(--text-4)" }}>{c.kind === "avataredu" ? "AvatarEdu" : "Kelas Premium"} · {fmtDate(c.at)}</p>
                  </div>
                  <span className="text-[10px] font-semibold px-2 py-1 rounded-full bg-emerald-500/10 text-emerald-500 shrink-0">{c.status}</span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm" style={{ color: "var(--text-4)" }}>Belum mengikuti kelas. Kunjungi <Link to="/app/toko" className="text-brand-600 hover:underline">Toko & Kelas</Link>.</p>
          )}
        </div>

        <div className="card p-5">
          <h2 className="text-sm font-semibold flex items-center gap-2 mb-3" style={{ color: "var(--text-base)" }}>
            <Award className="w-4 h-4 text-brand-600" /> Sertifikat Kompetensi
          </h2>
          {ov.certificates?.length ? (
            <div className="space-y-2">
              {ov.certificates.map((c) => (
                <button key={c.id} onClick={() => setViewCert(c)}
                  className="w-full text-left flex items-center gap-2 rounded-lg p-2.5 transition-colors hover:bg-[var(--bg-muted)]" style={{ border: "1px solid var(--border)" }}>
                  <Award className="w-4 h-4 text-amber-500 shrink-0" />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium truncate" style={{ color: "var(--text-base)" }}>{c.name}</p>
                    <p className="text-[11px]" style={{ color: "var(--text-4)" }}>Skor {c.score}% · {fmtDate(c.issuedAt)} · <span className="text-brand-600">lihat sertifikat</span></p>
                  </div>
                  {c.kkniLevel ? <RankBadge level={c.kkniLevel} showNum={false} /> : null}
                </button>
              ))}
            </div>
          ) : (
            <p className="text-sm" style={{ color: "var(--text-4)" }}>Belum ada sertifikat. Lulus <Link to="/app/exam" className="text-brand-600 hover:underline">Ujian Kompetensi</Link> untuk menerbitkannya.</p>
          )}
        </div>
      </div>

      {viewCert && <CertificateModal cert={viewCert} holder={p.name} onClose={() => setViewCert(null)} />}
    </div>
  );
}

// Rincian skor kesiapan (CV + Ujian + Sertifikat) + penjelasan Rank (diraih dari kompetensi).
function ReadinessCard({ readiness, rankInfo, rank, level }) {
  const r = readiness || { total: 0, cv: 0, exam: 0, cert: 0 };
  const rk = level ? rankOf(level) : null;
  const parts = [
    { key: "cv", label: "CV & Profil", val: r.cv, max: 25, color: "#38bdf8", icon: FileText },
    { key: "exam", label: "Hasil Ujian", val: r.exam, max: 60, color: "#2563eb", icon: ListChecks },
    { key: "cert", label: "Sertifikat (bonus)", val: r.cert, max: 15, color: "#10b981", icon: Award },
  ];
  const raisedBySkill = rank && rank.earned > rank.seed;
  return (
    <div className="card p-5">
      <div className="flex items-center justify-between gap-2 mb-3">
        <h2 className="text-sm font-semibold flex items-center gap-2" style={{ color: "var(--text-base)" }}>
          <Target className="w-4 h-4 text-brand-600" /> Skor Kesiapan
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
        Kesiapan = CV (25) + Ujian (60) + Sertifikat (15, bonus).
      </p>

      {/* Penjelasan Rank — diraih dari kompetensi, bukan ijazah */}
      <div className="mt-4 pt-3" style={{ borderTop: "1px solid var(--border)" }}>
        <div className="flex items-center justify-between gap-2 mb-1.5">
          <span className="text-xs font-semibold" style={{ color: "var(--text-base)" }}>Rank kamu</span>
          {rk && <RankBadge level={level} />}
        </div>
        {rankInfo ? (
          <p className="text-[11px]" style={{ color: "var(--text-3)" }}>
            <b style={{ color: rk?.color }}>{rk?.name}</b> — {rankInfo.title} ({rankInfo.jobGroup}), setara jenjang {rankInfo.educationMapping}.
          </p>
        ) : (
          <p className="text-[11px]" style={{ color: "var(--text-4)" }}>Rank belum terpetakan.</p>
        )}

        {rank && (
          <div className="mt-2 rounded-lg p-2.5 text-[11px]" style={{ background: "var(--bg-muted)", color: "var(--text-3)" }}>
            <div className="flex items-center gap-1.5 flex-wrap">
              <span>Dari pendidikan: <b>{rankName(rank.seed)}</b></span>
              <span aria-hidden>→</span>
              <span>diraih dari kompetensi: <b style={{ color: rankOf(rank.earned)?.color }}>{rankName(rank.earned)}</b></span>
            </div>

            {/* Bobot kompetensi & cap rank (transparansi anti-overcapacity) */}
            {rank.weightCap && (
              <div className="mt-1.5 pt-1.5" style={{ borderTop: "1px dashed var(--border-2)" }}>
                <span>Bobot kompetensi: <b style={{ color: "var(--text-2)" }}>{rank.weightTier || "—"}</b> · rank maks dari ujian: <b style={{ color: rankOf(rank.weightCap)?.color }}>{rankName(rank.weightCap)}</b></span>
                {rank.cappedByWeight && (
                  <p className="mt-1 text-amber-600">
                    Rank ujianmu <b>dibatasi</b> bobot kompetensi ini. Untuk melampaui menuju <b>ahli</b>, tambahkan <b>bukti eksternal</b>: sertifikasi resmi (BNSP/nasional/internasional), portofolio, & pengalaman kerja.
                  </p>
                )}
                {rank.weightReason && <p className="mt-0.5" style={{ color: "var(--text-4)" }}>{rank.weightReason}</p>}
              </div>
            )}

            <p className="mt-1.5" style={{ color: "var(--text-4)" }}>
              {raisedBySkill
                ? `Kompetensimu menaikkan rank di atas jenjang pendidikan. 💪`
                : `Buktikan lebih banyak kompetensi (lulus ujian, sertifikat, course) untuk naik rank.`}
            </p>
            {rank.next && !rank.cappedByWeight && (
              <p className="mt-1" style={{ color: "var(--text-4)" }}>
                Menuju <b>{rankName(rank.next.level)}</b>: kumpulkan {rank.next.need} poin kompetensi lagi (≈ {Math.ceil(rank.next.need / 8)} unit lulus / {Math.ceil(rank.next.need / 10)} sertifikat).
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
                title={capped ? "Perlu bukti eksternal untuk mencapai rank ini" : undefined}>
                {x.name}{capped ? " 🔒" : ""}
              </span>
            );
          })}
        </div>
        <p className="text-[10px] mt-1.5" style={{ color: "var(--text-4)" }}>
          Rank ditentukan <b>kompetensi yang dibuktikan</b> — bukan ijazah. Tiap kompetensi punya <b>bobot berbeda</b> (petani ≠ ahli pertanian): rank via ujian dibatasi bobotnya. Menuju rank ahli butuh <b>bukti eksternal</b> (sertifikasi resmi, portofolio, pengalaman).
        </p>
      </div>
    </div>
  );
}

function MiniStat({ icon: Icon, label, value }) {
  return (
    <div className="rounded-xl p-3" style={{ background: "var(--bg-muted)" }}>
      <p className="text-xs flex items-center gap-1 mb-0.5" style={{ color: "var(--text-4)" }}><Icon className="w-3 h-3" /> {label}</p>
      <p className="font-semibold text-sm" style={{ color: "var(--text-base)" }}>{value}</p>
    </div>
  );
}

// ── Bagian kompetensi SKKNI (target + pencarian + unit) ──────────────────────
function SkkniSection({ chosen, doc, onChanged, autoOpen = false }) {
  const [picking, setPicking] = useState(autoOpen);

  return (
    <div className="card p-5" style={{ borderColor: "var(--brand-600, #2563eb)" }}>
      <div className="flex items-center justify-between gap-2 mb-3">
        <h2 className="text-sm font-semibold flex items-center gap-2" style={{ color: "var(--text-base)" }}>
          <Target className="w-4 h-4 text-brand-600" /> Kompetensi SKKNI Target
        </h2>
        <button onClick={() => setPicking(true)} className="text-xs btn-outline py-1 px-2.5 flex items-center gap-1">
          <Search className="w-3 h-3" /> {chosen ? "Ganti" : "Pilih kompetensi"}
        </button>
      </div>

      {!chosen ? (
        <p className="text-sm" style={{ color: "var(--text-3)" }}>
          Belum ada kompetensi target. Pilih 1 bidang/profesi SKKNI resmi Kemnaker — ini menjadi
          <b> acuan semua fitur</b> (skill yang diperlukan, soal ujian, syarat naik rank, analisis gap, mentor).
        </p>
      ) : (
        <div className="space-y-3">
          <div>
            <p className="text-base font-semibold" style={{ color: "var(--text-base)" }}>{chosen.title}</p>
            <p className="text-xs" style={{ color: "var(--text-4)" }}>
              {doc?.numberKepmen ? `${doc.numberKepmen} · ` : ""}
              {!doc?.unitsCached ? "menyiapkan skill…" : `${doc?.unitCount ?? doc?.units?.length ?? 0} unit kompetensi (skill)`}
            </p>
          </div>
          {!doc?.unitsCached ? (
            <div className="flex items-center gap-2 text-xs rounded-lg px-3 py-2.5" style={{ background: "var(--bg-muted)", color: "var(--text-3)" }}>
              <Loader2 className="w-3.5 h-3.5 animate-spin text-brand-600 shrink-0" />
              Menyiapkan daftar skill dari standar SKKNI Kemnaker… biasanya di bawah 1 menit. Halaman ini akan memperbarui sendiri.
            </div>
          ) : doc?.units?.length ? (
            <div>
              <p className="text-xs flex items-center gap-1 mb-1.5" style={{ color: "var(--text-4)" }}><ListChecks className="w-3 h-3" /> Unit kompetensi (skill terstandar)</p>
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
            <p className="text-xs" style={{ color: "var(--text-4)" }}>Dokumen ini belum memiliki daftar unit terdigitasi di Kemnaker.</p>
          )}
          <p className="text-[11px]" style={{ color: "var(--text-4)" }}>Sumber: API resmi SKKNI Kemnaker (data tersimpan lokal).</p>
        </div>
      )}

      {picking && <SkkniPicker onClose={() => setPicking(false)} onChosen={() => { setPicking(false); onChanged(); }} />}
    </div>
  );
}

// Modal pencarian & pemilihan kompetensi SKKNI — kategori + infinite scroll (muat per 100,
// item di luar layar di-hide via content-visibility agar hemat, scroll tetap jalan sampai habis).
const PAGE = 100;
function SkkniPicker({ onClose, onChosen }) {
  const [q, setQ] = useState("");
  const [cats, setCats] = useState([]);
  const [activeCat, setActiveCat] = useState("all");
  const [items, setItems] = useState([]);
  const [total, setTotal] = useState(0);
  const [searching, setSearching] = useState(false);   // pencarian/replace awal
  const [loadingMore, setLoadingMore] = useState(false);
  const [choosing, setChoosing] = useState(null);
  const listRef = useRef(null);
  // Simpan q/kategori terbaru untuk loadMore tanpa stale closure.
  const stateRef = useRef({ q: "", cat: "all", len: 0, total: 0, loading: false });
  stateRef.current = { q, cat: activeCat, len: items.length, total, loading: searching || loadingMore };

  const fetchPage = (term, category, offset) =>
    api.get(`/skkni/search?q=${encodeURIComponent(term || "")}&category=${encodeURIComponent(category || "all")}&offset=${offset}`);

  const search = useCallback(async (term, category) => {
    setSearching(true);
    try {
      const d = await fetchPage(term, category, 0);
      setItems(d.items || []);
      setTotal(d.total ?? (d.items?.length || 0));
      if (listRef.current) listRef.current.scrollTop = 0;
    } catch (e) {
      toast.error(typeof e === "string" ? e : "Gagal mencari");
    } finally {
      setSearching(false);
    }
  }, []);

  const loadMore = useCallback(async () => {
    const st = stateRef.current;
    if (st.loading || st.len >= st.total) return;
    setLoadingMore(true);
    try {
      const d = await fetchPage(st.q, st.cat, st.len);
      setItems((prev) => [...prev, ...(d.items || [])]);
      if (typeof d.total === "number") setTotal(d.total);
    } catch { /* diam */ } finally {
      setLoadingMore(false);
    }
  }, []);

  function onScroll(e) {
    const el = e.currentTarget;
    if (el.scrollHeight - el.scrollTop - el.clientHeight < 240) loadMore();
  }

  useEffect(() => {
    api.get("/skkni/categories").then((d) => setCats(d.categories || [])).catch(() => {});
    search("", "all");
  }, [search]);

  function pickCat(key) { setActiveCat(key); search(q, key); }

  async function choose(item) {
    if (choosing) return;
    setChoosing(item.id);
    try {
      const r = await api.post("/skkni/choose", { docId: item.id });
      if (r.ready) toast.success(`Kompetensi target: ${r.chosen?.title} (${r.chosen?.unitCount} skill)`);
      else toast.success(`Kompetensi dipilih: ${r.chosen?.title}. Menyiapkan skill dari Kemnaker…`);
      onChosen();
    } catch (e) {
      toast.error(typeof e === "string" ? e : "Gagal menetapkan kompetensi");
    } finally {
      setChoosing(null);
    }
  }

  const chip = (key, label, count) => (
    <button key={key} onClick={() => pickCat(key)}
      className={`text-xs px-2.5 py-1 rounded-full whitespace-nowrap transition-colors ${activeCat === key ? "bg-brand-600 text-white" : "hover:bg-[var(--bg-muted)]"}`}
      style={activeCat === key ? {} : { border: "1px solid var(--border)", color: "var(--text-3)" }}>
      {label}{count != null ? ` · ${count}` : ""}
    </button>
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(0,0,0,0.5)" }} onClick={onClose}>
      <div className="w-full max-w-lg rounded-2xl p-5 max-h-[85vh] flex flex-col" style={{ background: "var(--bg-surface)", border: "1px solid var(--border)" }} onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-3">
          <div>
            <h3 className="font-semibold flex items-center gap-2" style={{ color: "var(--text-base)" }}><Search className="w-4 h-4 text-brand-600" /> Pilih Kompetensi Target</h3>
            <p className="text-[11px] mt-0.5" style={{ color: "var(--text-4)" }}>Pilih bidang/profesi sesuai tujuan kariermu — jadi acuan semua fitur.</p>
          </div>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-red-50 hover:text-red-500" style={{ color: "var(--text-4)" }}><X className="w-4 h-4" /></button>
        </div>

        <form onSubmit={(e) => { e.preventDefault(); search(q, activeCat); }} className="flex gap-2 mb-3">
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Cari profesi (mis. perawat, akuntansi, desain)…" className="input text-sm flex-1" autoFocus />
          <button type="submit" className="btn-primary text-sm px-3" disabled={searching}>{searching ? <Loader2 className="w-4 h-4 animate-spin" /> : "Cari"}</button>
        </form>

        {/* Chip kategori (wrap, tanpa scrollbar) */}
        <div className="flex flex-wrap gap-1.5 mb-3">
          {chip("all", "Semua")}
          {cats.map((c) => chip(c.key, c.label, c.count))}
        </div>

        <div ref={listRef} onScroll={onScroll} className="flex-1 overflow-y-auto space-y-1.5 -mx-1 px-1">
          {searching ? (
            <p className="text-sm text-center py-8" style={{ color: "var(--text-4)" }}>Memuat…</p>
          ) : items.length === 0 ? (
            <p className="text-sm text-center py-8" style={{ color: "var(--text-4)" }}>Tidak ada hasil di kategori ini. Coba kata kunci atau kategori lain.</p>
          ) : items.map((it) => (
            <button key={it.id} onClick={() => choose(it)} disabled={!!choosing}
              className="w-full text-left rounded-xl p-3 transition-colors hover:bg-[var(--bg-muted)] disabled:opacity-60 flex items-start gap-2"
              style={{ border: "1px solid var(--border)", contentVisibility: "auto", containIntrinsicSize: "auto 68px" }}>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium" style={{ color: "var(--text-base)" }}>{it.title}</p>
                <p className="text-[11px] flex items-center gap-1.5" style={{ color: "var(--text-4)" }}>
                  <span className="px-1.5 py-0.5 rounded" style={{ background: "var(--bg-muted)" }}>{it.category}</span>
                  {it.unitsCached ? <span className="text-emerald-500">{it.unitCount} skill siap</span> : <span>Standar SKKNI</span>}
                </p>
              </div>
              {choosing === it.id ? <Loader2 className="w-4 h-4 animate-spin text-brand-600 shrink-0 mt-0.5" />
                : it.unitsCached ? <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" /> : null}
            </button>
          ))}
          {!searching && items.length > 0 && (
            <p className="text-[11px] text-center pt-2 pb-1" style={{ color: "var(--text-4)" }}>
              {loadingMore ? "Memuat lagi…" : items.length >= total ? `${total} kompetensi (semua ditampilkan)` : `${items.length} dari ${total} — scroll untuk memuat lagi`}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Data diri editable ───────────────────────────────────────────────────────
// `compact` = tampilan 1 kolom untuk kolom sempit (di bawah kartu identitas, kanan frame rank).
function EditableIdentity({ profile, onSaved, compact = false }) {
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
      toast.success("Data diri diperbarui");
      setEdit(false);
      onSaved();
    } catch (e) {
      toast.error(typeof e === "string" ? e : "Gagal menyimpan");
    } finally {
      setSaving(false);
    }
  }

  const rows = [
    { icon: User, label: "Nama", value: profile.name || "—" },
    { icon: Building2, label: "Departemen", value: profile.department || "—" },
    { icon: Briefcase, label: "Posisi", value: profile.position || "—" },
    { icon: GraduationCap, label: "Pendidikan", value: profile.education || "—" },
    { icon: Clock, label: "Pengalaman", value: `${profile.experienceYears ?? 0} tahun` },
    { icon: Target, label: "Target Rank", value: profile.targetKkniLevel ? rankName(profile.targetKkniLevel) : "—" },
  ];

  return (
    <div className="card p-5">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-sm font-semibold flex items-center gap-2" style={{ color: "var(--text-base)" }}><User className="w-4 h-4 text-brand-600" /> Data Diri</h2>
        {!edit ? (
          <button onClick={start} className="text-xs btn-outline py-1 px-2.5 flex items-center gap-1"><Pencil className="w-3 h-3" /> Ubah</button>
        ) : (
          <div className="flex gap-2">
            <button onClick={() => setEdit(false)} className="text-xs btn-outline py-1 px-2.5">Batal</button>
            <button onClick={save} disabled={saving} className="text-xs btn-primary py-1 px-2.5 flex items-center gap-1">
              {saving ? <Loader2 className="w-3 h-3 animate-spin" /> : <Save className="w-3 h-3" />} Simpan
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
          <Field label="Nama"><input className="input text-sm" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></Field>
          <Field label="Departemen"><input className="input text-sm" value={form.department} onChange={(e) => setForm({ ...form, department: e.target.value })} /></Field>
          <Field label="Posisi"><input className="input text-sm" value={form.position} onChange={(e) => setForm({ ...form, position: e.target.value })} /></Field>
          <Field label="Pendidikan"><input className="input text-sm" value={form.education} onChange={(e) => setForm({ ...form, education: e.target.value })} placeholder="mis. S1, SMK" /></Field>
          <Field label="Pengalaman (tahun)"><input type="number" min="0" className="input text-sm" value={form.experienceYears} onChange={(e) => setForm({ ...form, experienceYears: e.target.value })} /></Field>
          <Field label="Target Rank">
            <select className="input text-sm" value={form.targetKkniLevel} onChange={(e) => setForm({ ...form, targetKkniLevel: e.target.value })}>
              <option value="">— tidak diset —</option>
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

function EvidenceCard({ rank, onChanged }) {
  const [items, setItems] = useState(null);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({ type: "certification", title: "", issuer: "", description: "", url: "" });

  const load = useCallback(async () => {
    try { const d = await api.get("/evidence"); setItems(d.items || []); } catch { setItems([]); }
  }, []);
  useEffect(() => { load(); }, [load]);

  async function submit(e) {
    e.preventDefault();
    if (!form.title.trim()) { toast.error("Judul bukti wajib diisi"); return; }
    setBusy(true);
    try {
      const r = await api.post("/evidence", form, { timeout: 60_000 });
      const st = r.item?.status;
      if (st === "verified") toast.success("Bukti terverifikasi AI ✓");
      else if (st === "rejected") toast.error("Bukti belum bisa diverifikasi — lengkapi detail");
      else toast("Bukti disimpan, menunggu tinjauan", { icon: "🕓" });
      setForm({ type: "certification", title: "", issuer: "", description: "", url: "" });
      setOpen(false);
      await load();
      onChanged?.();
    } catch (e2) {
      toast.error(typeof e2 === "string" ? e2 : "Gagal menambah bukti");
    } finally { setBusy(false); }
  }

  async function remove(id) {
    try { await api.delete(`/evidence/${id}`); await load(); onChanged?.(); toast.success("Bukti dihapus"); }
    catch { toast.error("Gagal menghapus"); }
  }

  const verifiedCount = (items || []).filter((i) => i.status === "verified").length;

  return (
    <div className="card p-5">
      <div className="flex items-center justify-between gap-2 mb-1">
        <h2 className="text-sm font-semibold flex items-center gap-2" style={{ color: "var(--text-base)" }}>
          <Sparkles className="w-4 h-4 text-brand-600" /> Bukti Kompetensi Eksternal
        </h2>
        <button onClick={() => setOpen((o) => !o)} className="text-xs text-brand-600 hover:underline">{open ? "Tutup" : "+ Tambah bukti"}</button>
      </div>
      <p className="text-xs mb-3" style={{ color: "var(--text-4)" }}>
        Sertifikasi resmi (BNSP/nasional/internasional), portofolio, & pengalaman kerja — diverifikasi AI. Ini <b>poin plus</b> yang bisa menembus batas rank dari ujian menuju tingkat <b>ahli</b>{rank?.cappedByWeight ? " — rank ujianmu sedang tercapai batasnya, tambahkan bukti untuk melampaui." : "."}
      </p>

      {open && (
        <form onSubmit={submit} className="rounded-xl p-3 mb-3 space-y-2" style={{ background: "var(--bg-raised)", border: "1px solid var(--border)" }}>
          <div className="grid sm:grid-cols-2 gap-2">
            <select className="input text-sm" value={form.type} onChange={(e) => setForm((f) => ({ ...f, type: e.target.value }))}>
              {Object.entries(EV_TYPE).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
            </select>
            <input className="input text-sm" placeholder="Judul (mis. Sertifikat BNSP Multimedia)" value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} />
            <input className="input text-sm" placeholder="Penerbit/Institusi (mis. BNSP)" value={form.issuer} onChange={(e) => setForm((f) => ({ ...f, issuer: e.target.value }))} />
            <input className="input text-sm" placeholder="Tautan bukti (opsional)" value={form.url} onChange={(e) => setForm((f) => ({ ...f, url: e.target.value }))} />
          </div>
          <textarea className="input text-sm h-16 resize-none" placeholder="Deskripsi: apa yang dikuasai / lingkup pengalaman…" value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} />
          <button type="submit" disabled={busy} className="btn-primary text-xs py-1.5 w-full flex items-center justify-center gap-1.5">
            {busy ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Memverifikasi (AI)…</> : "Kirim & Verifikasi"}
          </button>
        </form>
      )}

      {items === null ? (
        <p className="text-xs" style={{ color: "var(--text-4)" }}>Memuat…</p>
      ) : items.length === 0 ? (
        <p className="text-xs" style={{ color: "var(--text-4)" }}>Belum ada bukti eksternal. {rank?.cappedByWeight ? "Tambahkan untuk naik ke rank ahli." : ""}</p>
      ) : (
        <div className="space-y-2">
          {verifiedCount > 0 && rank?.boostedByEvidence && (
            <p className="text-[11px] text-emerald-500">Bukti terverifikasi menaikkan rank efektifmu di atas batas ujian. 💪</p>
          )}
          {items.map((it) => {
            const t = EV_TYPE[it.type] || EV_TYPE.certification;
            const st = EV_STATUS[it.status] || EV_STATUS.pending;
            const TIcon = t.icon;
            return (
              <div key={it.id} className="rounded-lg p-3" style={{ background: "var(--bg-raised)", border: "1px solid var(--border)" }}>
                <div className="flex items-start gap-2">
                  <TIcon className="w-4 h-4 mt-0.5 text-brand-500 shrink-0" />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-sm font-medium truncate" style={{ color: "var(--text-base)" }}>{it.title}</p>
                      <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${st.cls}`}>{st.label}</span>
                      {it.status === "verified" && it.rankImplied > 0 && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded-full" style={{ background: `${rankOf(it.rankImplied)?.color}22`, color: rankOf(it.rankImplied)?.color }}>
                          ≈ {rankName(it.rankImplied)}
                        </span>
                      )}
                    </div>
                    <p className="text-[11px]" style={{ color: "var(--text-4)" }}>{t.label}{it.issuer ? ` · ${it.issuer}` : ""}{it.status !== "pending" ? ` · kredibilitas ${it.credibility}%` : ""}</p>
                    {it.verdict && <p className="text-[11px] mt-0.5" style={{ color: "var(--text-3)" }}>{it.verdict}</p>}
                  </div>
                  <button onClick={() => remove(it.id)} className="p-1 rounded hover:bg-red-500/10 shrink-0" style={{ color: "var(--text-4)" }} title="Hapus"><X className="w-3.5 h-3.5" /></button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
