import { rankOf } from "../lib/rank.js";

// Emblem rank ala game (Bronze→Legend) — SVG murni, skalabel, tema TalentaAI.
// Tiap tier memakai warnanya sendiri (dari lib/rank.js) dgn bahasa desain yang konsisten:
// perisai gem bergradien + rim metalik, sayap & mahkota yang bertambah seiring tier.

// Terangkan/gelapkan hex (amt: -1..1) untuk gradien 3D dari satu warna dasar.
function shade(hex, amt) {
  const n = parseInt(hex.slice(1), 16);
  let r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
  const t = amt < 0 ? 0 : 255, p = Math.abs(amt);
  r = Math.round((t - r) * p) + r;
  g = Math.round((t - g) * p) + g;
  b = Math.round((t - b) * p) + b;
  return "#" + (1 << 24 | r << 16 | g << 8 | b).toString(16).slice(1);
}

// Konfigurasi ornamen per tier (progresif).
const CFG = {
  1: { chevrons: 1, wings: 0, crown: false, motif: "chevrons" },
  2: { chevrons: 2, wings: 0, crown: false, motif: "chevrons" },
  3: { chevrons: 3, wings: 0, crown: false, motif: "chevrons", star: true },
  4: { wings: 1, crown: false, motif: "gem" },
  5: { wings: 2, crown: false, motif: "gem" },
  6: { wings: 2, crown: false, motif: "gem", rays: true },
  7: { wings: 2, crown: true, motif: "gem", rays: true },
  8: { wings: 3, crown: true, motif: "gem", rays: true, stars: true },
  9: { wings: 3, crown: true, motif: "star", rays: true, glow: true },
};

const SHIELD = "M60 30 L88 42 L88 70 C88 88 76 100 60 110 C44 100 32 88 32 70 L32 42 Z";
// Sayap kanan (dicerminkan untuk kiri). Anchor di bahu perisai.
const WING = "M84 58 q16 -4 28 -16 q-2 10 -8 15 q10 -3 16 -10 q-1 10 -8 15 q8 -2 13 -8 q-2 11 -12 16 q-12 6 -25 5 z";
const CROWN = "M44 34 L44 20 L52 27 L60 13 L68 27 L76 20 L76 34 Z";
const GEM = "M60 50 L78 66 L60 90 L42 66 Z";
const STAR = "M60 42 L65.3 56.7 L80.9 57.2 L68.6 66.8 L72.9 81.8 L60 73 L47.1 81.8 L51.4 66.8 L39.1 57.2 L54.7 56.7 Z";

function Chevrons({ n, color }) {
  const items = [];
  for (let i = 0; i < n; i++) {
    const y = 82 - i * 13;
    items.push(<path key={i} d={`M47 ${y - 9} L60 ${y} L73 ${y - 9}`} fill="none" stroke={color} strokeWidth="6" strokeLinecap="round" strokeLinejoin="round" />);
  }
  return <g opacity="0.95">{items}</g>;
}

export default function RankIcon({ level, size = 48, className = "", title }) {
  const r = rankOf(level);
  if (!r) {
    return (
      <svg width={size} height={size * 1.1} viewBox="0 0 120 132" className={className} role="img" aria-label="Belum ada rank">
        <path d={SHIELD} fill="#334155" stroke="#475569" strokeWidth="3" />
        <text x="60" y="78" textAnchor="middle" fontSize="34" fill="#64748b" fontWeight="bold">?</text>
      </svg>
    );
  }
  const c = r.color;
  const cfg = CFG[level] || {};
  const uid = `rk${level}`;
  const light = shade(c, 0.5), mid = shade(c, 0.08), dark = shade(c, -0.42);
  const rim = shade(c, 0.62), rimDark = shade(c, -0.15);
  const wingL = shade(c, 0.58), wingD = shade(c, -0.05);

  return (
    <svg width={size} height={size * 1.1} viewBox="0 0 120 132" className={className} role="img" aria-label={title || `Rank ${r.name}`}>
      <defs>
        <linearGradient id={`${uid}-body`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={light} />
          <stop offset="0.5" stopColor={mid} />
          <stop offset="1" stopColor={dark} />
        </linearGradient>
        <linearGradient id={`${uid}-rim`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={rim} />
          <stop offset="1" stopColor={rimDark} />
        </linearGradient>
        <linearGradient id={`${uid}-wing`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor={wingL} />
          <stop offset="1" stopColor={wingD} />
        </linearGradient>
        <linearGradient id={`${uid}-gloss`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#ffffff" stopOpacity="0.55" />
          <stop offset="0.45" stopColor="#ffffff" stopOpacity="0.05" />
          <stop offset="1" stopColor="#ffffff" stopOpacity="0" />
        </linearGradient>
        <linearGradient id={`${uid}-gold`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#ffe9a8" />
          <stop offset="1" stopColor="#d99a2b" />
        </linearGradient>
        <radialGradient id={`${uid}-glow`} cx="0.5" cy="0.5" r="0.5">
          <stop offset="0" stopColor={light} stopOpacity="0.9" />
          <stop offset="1" stopColor={light} stopOpacity="0" />
        </radialGradient>
        <filter id={`${uid}-blur`} x="-40%" y="-40%" width="180%" height="180%">
          <feGaussianBlur stdDeviation="4" />
        </filter>
      </defs>

      {/* Glow (Legend) */}
      {cfg.glow && <circle cx="60" cy="66" r="52" fill={`url(#${uid}-glow)`} filter={`url(#${uid}-blur)`} />}

      {/* Rays di belakang perisai */}
      {cfg.rays && (
        <g opacity="0.5">
          {[0, 45, 90, 135, 180, 225, 270, 315].map((a) => (
            <path key={a} d="M60 66 L56 6 L64 6 Z" fill={light} opacity="0.35" transform={`rotate(${a} 60 66)`} />
          ))}
        </g>
      )}

      {/* Sayap (kiri = cermin dari kanan) */}
      {cfg.wings > 0 && (
        <g>
          <path d={WING} fill={`url(#${uid}-wing)`} stroke={rimDark} strokeWidth="1.2" transform="scale(-1,1) translate(-120,0)" />
          <path d={WING} fill={`url(#${uid}-wing)`} stroke={rimDark} strokeWidth="1.2" />
        </g>
      )}

      {/* Mahkota (Master+) */}
      {cfg.crown && (
        <g>
          <path d={CROWN} fill={`url(#${uid}-gold)`} stroke="#b7791f" strokeWidth="1.5" strokeLinejoin="round" />
          {[[52, 25], [60, 13], [68, 25]].map(([x, y], i) => <circle key={i} cx={x} cy={y} r="3" fill={c} stroke="#b7791f" strokeWidth="1" />)}
        </g>
      )}

      {/* Perisai */}
      <path d={SHIELD} fill={`url(#${uid}-body)`} stroke={`url(#${uid}-rim)`} strokeWidth="4" strokeLinejoin="round" />
      <path d={SHIELD} fill={`url(#${uid}-gloss)`} />
      <path d="M60 30 L88 42 L88 70 C88 88 76 100 60 110" fill="none" stroke="#ffffff" strokeOpacity="0.15" strokeWidth="1.5" />

      {/* Motif tengah */}
      {cfg.motif === "chevrons" && <Chevrons n={cfg.chevrons} color={shade(c, 0.75)} />}

      {(cfg.motif === "gem") && (
        <g>
          <path d={GEM} fill={shade(c, 0.35)} stroke={shade(c, 0.7)} strokeWidth="1.5" strokeLinejoin="round" />
          <path d="M60 50 L42 66 L60 66 Z" fill="#ffffff" opacity="0.35" />
          <path d="M78 66 L60 90 L60 66 Z" fill={dark} opacity="0.45" />
          <path d="M42 66 L78 66" stroke={shade(c, 0.75)} strokeWidth="1" opacity="0.7" />
          <path d="M60 50 L60 90" stroke={shade(c, 0.6)} strokeWidth="0.8" opacity="0.5" />
        </g>
      )}

      {(cfg.motif === "star" || cfg.star) && (
        <path d={STAR} fill={shade(c, 0.55)} stroke="#ffffff" strokeOpacity="0.6" strokeWidth="1.5" strokeLinejoin="round"
          transform={cfg.motif === "star" ? "" : "translate(0 6) scale(0.42) translate(83 78)"} />
      )}

      {/* Bintang kecil (Grandmaster) */}
      {cfg.stars && (
        <g fill="#fff" opacity="0.85">
          <circle cx="40" cy="48" r="1.6" /><circle cx="80" cy="48" r="1.6" /><circle cx="60" cy="100" r="1.6" />
        </g>
      )}
    </svg>
  );
}
