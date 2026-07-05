import { rankOf, rankName, tierProgress, RANKS } from "../lib/rank.js";
import RankIcon from "./RankIcon.jsx";

// Panggung rank ala main-menu game ranked — komponen rank terbesar & tersorot.
// Dipakai di Dashboard (hero) & Profile (pusat). Selalu panel gelap dramatis;
// warna aksen mengikuti tier rank (Bronze→Legend).
//
// props:
//  rank       : objek dari /user/overview.rank (effective, masteryScore, weightCap, next, dsb.)
//  rankInfo   : { title, jobGroup, educationMapping } (opsional)
//  readiness  : angka 0..100 (opsional)
//  competency : judul kompetensi SKKNI target (opsional)
//  size       : "lg" (default, dashboard/profile) | "md"
//  avatar     : { name, url } → tampilkan foto profil kecil di pojok (opsional)
//  onAvatarClick : jika diberikan, foto bisa diklik (ganti foto — dipakai di Profile)
//  footer     : node tambahan di bawah (opsional)
export default function RankHero({
  rank, rankInfo, readiness, competency, size = "lg",
  avatar, onAvatarClick, footer,
}) {
  const level = rank?.effective || rank?.earned || 1;
  const r = rankOf(level) || RANKS[0];
  const c = r.color;
  const cap = rank?.weightCap || 9;
  const prog = tierProgress(rank?.masteryScore || 0, cap);
  const nextName = prog.nextLevel ? rankName(prog.nextLevel) : null;
  const emblemSize = size === "lg" ? 168 : 128;

  return (
    <div
      className="rank-dark relative overflow-hidden rounded-3xl px-6 py-8 sm:px-10"
      style={{
        background: `radial-gradient(90% 80% at 50% 22%, ${c}33 0%, #0b1120 52%, #070b16 100%)`,
        border: `1px solid ${c}44`,
        boxShadow: `0 0 0 1px ${c}18 inset, 0 24px 60px -30px ${c}66`,
      }}
    >
      {/* Foto profil (pojok) */}
      {avatar && (
        <div className="absolute right-4 top-4 z-10">
          <AvatarChip avatar={avatar} color={c} onClick={onAvatarClick} />
        </div>
      )}

      <div className="relative flex flex-col items-center text-center">
        {/* Emblem — rays & glow terpusat TEPAT pada emblem */}
        <div className="relative flex items-center justify-center"
          style={{ width: emblemSize, height: emblemSize * 1.1 }}>
          {/* Rays berputar (pusat = pusat emblem) */}
          <div className="rank-rays pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2" aria-hidden
            style={{ width: emblemSize * 2.7, height: emblemSize * 2.7 }}>
            <svg viewBox="0 0 200 200" width="100%" height="100%" style={{ opacity: 0.18 }}>
              {Array.from({ length: 16 }).map((_, i) => (
                <path key={i} d="M100 100 L96 0 L104 0 Z" fill={c} transform={`rotate(${i * 22.5} 100 100)`} />
              ))}
            </svg>
          </div>
          {/* Glow radial (pusat = pusat emblem) */}
          <div className="rank-glow pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2" aria-hidden
            style={{ width: emblemSize * 1.9, height: emblemSize * 1.9, background: `radial-gradient(circle, ${c}55 0%, transparent 68%)`, filter: "blur(8px)" }} />
          {/* Emblem (di atas rays/glow) */}
          <div className="rank-emblem relative" style={{ filter: `drop-shadow(0 6px 22px ${c}aa)` }}>
            <RankIcon level={level} size={emblemSize} title={r.name} />
          </div>
        </div>

        {/* Nama rank */}
        <h2
          className="mt-3 font-black tracking-[0.14em] uppercase"
          style={{
            color: c, fontSize: size === "lg" ? "2.6rem" : "2rem", lineHeight: 1,
            textShadow: `0 0 24px ${c}66`,
          }}
        >
          {r.name}
        </h2>
        <p className="mt-1.5 text-sm text-slate-300">
          <span className="font-semibold text-slate-200">Rank {level}</span>
          {rankInfo?.title ? <> · {rankInfo.title}</> : null}
          {rankInfo?.jobGroup ? <span className="text-slate-500"> · {rankInfo.jobGroup}</span> : null}
        </p>

        {rank?.boostedByEvidence && (
          <span className="mt-2 inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-semibold"
            style={{ background: `${c}22`, color: c, border: `1px solid ${c}55` }}>
            ✦ Ditingkatkan bukti eksternal
          </span>
        )}

        {/* LP bar menuju rank berikutnya */}
        <div className="mt-5 w-full max-w-md">
          <div className="mb-1.5 flex items-center justify-between text-[11px]">
            <span className="font-semibold uppercase tracking-wider" style={{ color: c }}>{r.name}</span>
            {prog.atCap ? (
              <span className="text-amber-400">Batas bobot kompetensi 🔒</span>
            ) : nextName ? (
              <span className="text-slate-400">Menuju <b className="text-slate-200">{nextName}</b></span>
            ) : (
              <span className="text-slate-400">Rank tertinggi 👑</span>
            )}
          </div>
          <div className="relative h-3 overflow-hidden rounded-full" style={{ background: "#111a2e", border: `1px solid ${c}33` }}>
            <div className="relative h-full rounded-full transition-[width] duration-1000 ease-out"
              style={{ width: `${prog.pct}%`, background: `linear-gradient(90deg, ${c}bb, ${c})` }}>
              <div className="rank-lp-sheen absolute inset-y-0 left-0 w-1/3"
                style={{ background: "linear-gradient(90deg, transparent, rgba(255,255,255,0.55), transparent)" }} />
            </div>
          </div>
          <p className="mt-1.5 text-[11px] text-slate-400">
            {prog.atCap
              ? "Untuk melampaui, tambahkan bukti eksternal (sertifikasi resmi, portofolio, pengalaman)."
              : prog.nextLevel
                ? <>Kumpulkan <b className="text-slate-200">{prog.need} poin</b> kompetensi lagi (≈ {Math.ceil(prog.need / 8)} unit lulus / {Math.ceil(prog.need / 10)} sertifikat).</>
                : "Kamu berada di puncak jenjang kompetensi. 🎉"}
          </p>
        </div>

        {/* Ladder 9 tier */}
        <div className="mt-5 flex items-center justify-center gap-1.5">
          {RANKS.map((x) => {
            const active = x.level === level;
            const passed = x.level < level;
            const locked = x.level > cap;
            return (
              <span key={x.level} title={`${x.name}${locked ? " · terkunci bobot" : ""}`}
                className="rounded-full transition-all"
                style={{
                  width: active ? 26 : 8, height: 8,
                  background: active ? x.color : passed ? `${x.color}bb` : "#1e293b",
                  opacity: locked && !active ? 0.35 : 1,
                  boxShadow: active ? `0 0 10px ${x.color}` : "none",
                }} />
            );
          })}
        </div>

        {/* Stat chips */}
        <div className="mt-6 grid w-full max-w-lg grid-cols-2 gap-2.5 sm:grid-cols-4">
          <Stat label="Unit Lulus" value={rank?.passedUnits ?? 0} color={c} />
          <Stat label="Sertifikat" value={rank?.certs ?? 0} color={c} />
          <Stat label="Kelas" value={rank?.courses ?? 0} color={c} />
          <Stat label="Kesiapan" value={`${readiness ?? 0}%`} color={c} />
        </div>

        {competency && (
          <div className="mt-4 max-w-lg rounded-xl px-3.5 py-2 text-xs"
            style={{ background: "#0e1524", border: `1px solid ${c}22`, color: "#cbd5e1" }}>
            <span className="text-slate-500">Kompetensi target · </span>
            <span className="font-medium text-slate-200">{competency}</span>
            {rank?.weightTier && (
              <span className="text-slate-500"> · bobot <b style={{ color: rankOf(cap)?.color }}>{rank.weightTier}</b> (maks {rankName(cap)})</span>
            )}
          </div>
        )}

        {footer}
      </div>
    </div>
  );
}

function Stat({ label, value, color }) {
  return (
    <div className="rounded-xl px-2 py-2.5 text-center" style={{ background: "#0e1524", border: `1px solid ${color}1f` }}>
      <p className="text-lg font-black tabular-nums text-white leading-none">{value}</p>
      <p className="mt-1 text-[10px] uppercase tracking-wider text-slate-500">{label}</p>
    </div>
  );
}

function AvatarChip({ avatar, color, onClick }) {
  const initial = (avatar?.name || "?").charAt(0).toUpperCase();
  const inner = avatar?.url ? (
    <img src={avatar.url} alt={avatar?.name || "Foto profil"} className="h-full w-full object-cover" />
  ) : (
    <span className="flex h-full w-full items-center justify-center text-lg font-black text-white"
      style={{ background: `linear-gradient(135deg, ${color}, #0b1120)` }}>{initial}</span>
  );
  const ring = { width: 52, height: 52, borderRadius: 16, overflow: "hidden", border: `2px solid ${color}` , boxShadow: `0 0 16px ${color}66` };
  if (!onClick) return <div style={ring}>{inner}</div>;
  return (
    <button onClick={onClick} className="group relative block" style={ring} title="Ganti foto profil">
      {inner}
      <span className="absolute inset-0 hidden items-center justify-center bg-black/55 text-[10px] font-semibold text-white group-hover:flex">Ubah</span>
    </button>
  );
}
