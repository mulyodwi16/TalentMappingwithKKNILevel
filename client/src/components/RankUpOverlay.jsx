import { useEffect, useMemo } from "react";
import { rankOf, rankName } from "../lib/rank.js";
import RankIcon from "./RankIcon.jsx";

// Overlay perayaan saat user NAIK RANK — "feel of accomplishment".
// Ditrigger Dashboard saat rank efektif > rank terakhir yang dilihat (localStorage).
export default function RankUpOverlay({ from, to, onClose }) {
  const r = rankOf(to);
  const c = r?.color || "#38bdf8";

  useEffect(() => {
    const t = setTimeout(onClose, 6500); // tutup otomatis
    const onKey = (e) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => { clearTimeout(t); window.removeEventListener("keydown", onKey); };
  }, [onClose]);

  // Konfeti deterministik (tanpa Math.random — dilarang di beberapa lingkungan; pakai index).
  const confetti = useMemo(() => Array.from({ length: 34 }).map((_, i) => {
    const left = (i * 37) % 100;
    const delay = ((i * 13) % 100) / 100 * 0.8;
    const dur = 2.4 + ((i * 7) % 20) / 10;
    const size = 6 + (i % 4) * 2;
    const colors = [c, "#ffffff", "#facc15", "#38bdf8"];
    return { left, delay, dur, size, color: colors[i % colors.length], rot: (i * 41) % 360 };
  }), [c]);

  return (
    <div className="rank-dark rankup-backdrop fixed inset-0 z-[100] flex items-center justify-center px-4"
      style={{ background: "radial-gradient(circle at 50% 40%, rgba(10,16,30,0.86), rgba(3,6,12,0.96))", backdropFilter: "blur(4px)" }}
      onClick={onClose} role="dialog" aria-label="Naik rank">
      {/* Konfeti */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
        {confetti.map((f, i) => (
          <span key={i} className="rankup-conf absolute top-0"
            style={{ left: `${f.left}%`, width: f.size, height: f.size * 1.6, background: f.color,
              transform: `rotate(${f.rot}deg)`, animationDelay: `${f.delay}s`, animationDuration: `${f.dur}s`, borderRadius: 2 }} />
        ))}
      </div>

      <div className="relative flex flex-col items-center text-center" onClick={(e) => e.stopPropagation()}>
        <p className="rankup-text text-xs font-bold uppercase tracking-[0.4em] text-slate-400" style={{ animationDelay: "0.15s" }}>
          Naik Rank!
        </p>

        {/* Emblem baru dengan burst */}
        <div className="relative my-4 flex items-center justify-center" style={{ width: 240, height: 240 }}>
          <span className="rankup-burst absolute rounded-full" aria-hidden
            style={{ width: 180, height: 180, background: `radial-gradient(circle, ${c}88, transparent 70%)` }} />
          <div className="rankup-emblem relative" style={{ filter: `drop-shadow(0 8px 30px ${c})` }}>
            <RankIcon level={to} size={190} title={r?.name} />
          </div>
        </div>

        <h2 className="rankup-text font-black uppercase tracking-[0.14em]" style={{ color: c, fontSize: "2.8rem", lineHeight: 1, textShadow: `0 0 30px ${c}`, animationDelay: "0.3s" }}>
          {rankName(to)}
        </h2>
        {from ? (
          <p className="rankup-text mt-2 text-sm text-slate-300" style={{ animationDelay: "0.45s" }}>
            <span className="text-slate-500 line-through">{rankName(from)}</span>
            <span className="mx-2" style={{ color: c }}>→</span>
            <b style={{ color: c }}>{rankName(to)}</b>
          </p>
        ) : null}
        <p className="rankup-text mt-1 text-xs text-slate-500" style={{ animationDelay: "0.55s" }}>
          Kompetensimu terbukti naik. Terus buktikan untuk mencapai tier berikutnya.
        </p>

        <button onClick={onClose}
          className="rankup-text mt-6 rounded-xl px-6 py-2.5 text-sm font-semibold text-white transition-transform hover:scale-105"
          style={{ background: `linear-gradient(135deg, ${c}, ${c}cc)`, boxShadow: `0 10px 30px -10px ${c}`, animationDelay: "0.7s" }}>
          Lanjutkan
        </button>
      </div>
    </div>
  );
}
