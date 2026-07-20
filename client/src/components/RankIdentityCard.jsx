import { rankOf, RANKS } from "../lib/rank.js";
import RankIcon from "./RankIcon.jsx";
import { useLang } from "../lib/i18n.jsx";
import useIsDark from "../lib/useIsDark.js";

// Kartu identitas ala profil game - DI LUAR frame rank, kolom kanan.
// Foto BESAR di atas, informasi data diri tepat di bawahnya.
// props:
//  level    : rank efektif (untuk warna tier + emblem mini)
//  identity : { name, email, subtitle, targetLabel, photoUrl, onPhotoClick, onPhotoRemove, uploading }
export default function RankIdentityCard({ level, identity }) {
  const { t } = useLang();
  const dark = useIsDark();
  const r = rankOf(level) || RANKS[0];
  const color = r.color;
  const { name, email, subtitle, targetLabel, photoUrl, onPhotoClick, onPhotoRemove, uploading } = identity || {};
  const initial = (name || "?").charAt(0).toUpperCase();
  const clickable = !!onPhotoClick;

  // Selaras RankHero: gelap = near-black dramatis; terang = gradien biru brand.
  const bg = dark
    ? `radial-gradient(120% 100% at 50% 0%, ${color}26 0%, #0b1120 55%, #070b16 100%)`
    : `radial-gradient(130% 110% at 50% 0%, ${color}44 0%, #16408f 52%, #0c1f49 100%)`;

  const photo = photoUrl ? (
    <img src={photoUrl} alt={name || "Foto profil"} className="h-full w-full object-cover" />
  ) : (
    <span className="flex h-full w-full items-center justify-center text-6xl font-black text-white"
      style={{ background: `linear-gradient(135deg, ${color}, #0b1120)` }}>{initial}</span>
  );

  return (
    <div className="rank-dark relative overflow-hidden rounded-3xl p-5 flex flex-col items-center text-center"
      style={{
        background: bg,
        border: `1px solid ${color}44`,
        boxShadow: `0 0 0 1px ${color}18 inset, 0 18px 44px -24px ${color}55`,
      }}>
      {/* Foto besar */}
      <div className="relative">
        {clickable ? (
          <button onClick={() => !uploading && onPhotoClick()} className="group relative block overflow-hidden"
            style={{ width: 168, height: 168, borderRadius: 24, border: `3px solid ${color}`, boxShadow: `0 0 30px ${color}55` }}
            title={t("Atur foto profil")}>
            {photo}
            <span className="absolute inset-x-0 bottom-0 hidden justify-center bg-black/60 py-1.5 text-[11px] font-semibold text-white group-hover:flex">
              {uploading ? t("Mengunggah…") : photoUrl ? t("Ganti / atur foto") : t("Upload foto")}
            </span>
          </button>
        ) : (
          <div className="overflow-hidden" style={{ width: 168, height: 168, borderRadius: 24, border: `3px solid ${color}`, boxShadow: `0 0 30px ${color}55` }}>
            {photo}
          </div>
        )}
        {/* Emblem tier mini di sudut foto */}
        {level ? (
          <span className="absolute -bottom-2.5 -right-2.5 drop-shadow-lg" aria-hidden>
            <RankIcon level={level} size={46} />
          </span>
        ) : null}
      </div>

      {/* Informasi data diri di bawah foto */}
      <div className="mt-4 w-full min-w-0">
        <p className="truncate text-lg font-bold text-white">{name || "-"}</p>
        {subtitle && <p className="truncate text-xs text-slate-400 mt-0.5">{subtitle}</p>}
        {email && <p className="truncate text-[11px] text-slate-500 mt-0.5">{email}</p>}
        {targetLabel && (
          <p className="mt-2 inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[10px] font-semibold"
            style={{ background: `${color}1c`, color, border: `1px solid ${color}44` }}>
            🎯 {targetLabel}
          </p>
        )}
        {clickable && (
          <div className="mt-2.5 flex items-center justify-center gap-3">
            <button onClick={() => !uploading && onPhotoClick()} disabled={uploading}
              className="text-[11px] font-semibold text-brand-400 hover:underline disabled:opacity-60">
              {uploading ? t("Mengunggah…") : photoUrl ? t("Ganti foto") : t("Upload foto")}
            </button>
            {photoUrl && !uploading && onPhotoRemove && (
              <button onClick={onPhotoRemove} className="text-[11px] text-slate-500 hover:text-red-400">{t("Hapus")}</button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
