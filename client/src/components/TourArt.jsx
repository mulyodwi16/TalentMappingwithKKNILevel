// Ilustrasi SVG per fitur untuk tur bantuan — line-art putih di atas header bergradien.
// Skalabel, ringan, tanpa aset eksternal. Satu <TourArt kind="..." /> per langkah.
const W = "#ffffff";

function Frame({ children }) {
  return (
    <svg viewBox="0 0 220 120" className="w-full h-full" role="img" aria-hidden="true"
      fill="none" stroke={W} strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
      {children}
    </svg>
  );
}

const ART = {
  welcome: (
    <Frame>
      {/* Perisai + kilau (seperti logo) */}
      <path d="M110 26 L140 38 L140 62 C140 82 126 92 110 98 C94 92 80 82 80 62 L80 38 Z" fill={W} fillOpacity="0.14" />
      <path d="M100 60 l8 8 l16 -18" strokeWidth="3" />
      {/* Confetti */}
      <g stroke="none" fill={W}>
        <circle cx="58" cy="34" r="3" fillOpacity="0.9" /><circle cx="168" cy="42" r="3" fillOpacity="0.8" />
        <circle cx="48" cy="70" r="2.5" fillOpacity="0.7" /><circle cx="176" cy="78" r="2.5" fillOpacity="0.7" />
        <rect x="150" y="24" width="6" height="6" rx="1" fillOpacity="0.8" transform="rotate(20 153 27)" />
        <rect x="62" y="90" width="6" height="6" rx="1" fillOpacity="0.7" transform="rotate(-15 65 93)" />
      </g>
      <path d="M150 66 l3 6 l6 3 l-6 3 l-3 6 l-3 -6 l-6 -3 l6 -3 z" fill={W} stroke="none" fillOpacity="0.95" />
    </Frame>
  ),
  dashboard: (
    <Frame>
      {/* Bingkai panel */}
      <rect x="40" y="24" width="140" height="74" rx="8" fillOpacity="0.08" fill={W} />
      <line x1="40" y1="40" x2="180" y2="40" strokeOpacity="0.5" />
      {/* Donat readiness */}
      <circle cx="72" cy="70" r="16" strokeOpacity="0.35" />
      <path d="M72 54 a16 16 0 0 1 13 25" strokeWidth="3.2" />
      {/* Bar */}
      <g strokeWidth="5" strokeOpacity="0.85">
        <line x1="110" y1="82" x2="110" y2="66" /><line x1="126" y1="82" x2="126" y2="58" />
        <line x1="142" y1="82" x2="142" y2="72" /><line x1="158" y1="82" x2="158" y2="50" />
      </g>
      <rect x="150" y="30" width="24" height="7" rx="3.5" fill={W} stroke="none" fillOpacity="0.9" />
    </Frame>
  ),
  cv: (
    <Frame>
      <rect x="66" y="26" width="72" height="88" rx="6" fill={W} fillOpacity="0.1" />
      <g strokeOpacity="0.75"><line x1="78" y1="46" x2="126" y2="46" /><line x1="78" y1="58" x2="126" y2="58" /><line x1="78" y1="70" x2="112" y2="70" /><line x1="78" y1="82" x2="120" y2="82" /></g>
      {/* Panah upload */}
      <g transform="translate(150 40)"><circle cx="0" cy="20" r="18" fillOpacity="0.14" fill={W} /><path d="M0 30 V10 M-7 17 L0 10 L7 17" strokeWidth="3" /></g>
    </Frame>
  ),
  exam: (
    <Frame>
      <rect x="44" y="24" width="104" height="80" rx="8" fill={W} fillOpacity="0.09" />
      {/* opsi */}
      <g><circle cx="60" cy="46" r="5" /><line x1="74" y1="46" x2="132" y2="46" strokeOpacity="0.7" /></g>
      <g><circle cx="60" cy="64" r="5" fill={W} fillOpacity="0.95" /><path d="M57 64 l2.5 2.5 l4 -5" stroke="#2563eb" strokeWidth="2" /><line x1="74" y1="64" x2="132" y2="64" strokeOpacity="0.7" /></g>
      <g><circle cx="60" cy="82" r="5" /><line x1="74" y1="82" x2="120" y2="82" strokeOpacity="0.7" /></g>
      {/* Timer */}
      <g transform="translate(168 40)"><circle cx="0" cy="16" r="16" strokeOpacity="0.35" /><path d="M0 16 V6 M0 16 L8 20" strokeWidth="2.6" /></g>
    </Frame>
  ),
  gap: (
    <Frame>
      {/* Radar pentagon */}
      <g strokeOpacity="0.35"><polygon points="110,26 154,58 137,104 83,104 66,58" /><polygon points="110,44 132,60 124,88 96,88 88,60" /></g>
      <line x1="110" y1="60" x2="110" y2="26" strokeOpacity="0.25" /><line x1="110" y1="60" x2="154" y2="58" strokeOpacity="0.25" />
      <line x1="110" y1="60" x2="137" y2="104" strokeOpacity="0.25" /><line x1="110" y1="60" x2="83" y2="104" strokeOpacity="0.25" /><line x1="110" y1="60" x2="66" y2="58" strokeOpacity="0.25" />
      {/* Nilai aktual */}
      <polygon points="110,36 140,58 122,96 92,90 82,60" fill={W} fillOpacity="0.22" strokeWidth="2.6" />
      <g stroke="none" fill={W}><circle cx="110" cy="36" r="2.6" /><circle cx="140" cy="58" r="2.6" /><circle cx="122" cy="96" r="2.6" /><circle cx="92" cy="90" r="2.6" /><circle cx="82" cy="60" r="2.6" /></g>
    </Frame>
  ),
  path: (
    <Frame>
      {/* Jalur berkelok */}
      <path d="M46 96 C 70 96, 70 60, 96 60 S 150 60, 150 34 S 180 34, 190 30" strokeDasharray="2 8" strokeOpacity="0.7" strokeWidth="3" />
      {/* Node */}
      <g><circle cx="46" cy="96" r="9" fill={W} fillOpacity="0.14" /><path d="M42 96 l3 3 l6 -6" strokeWidth="2.4" /></g>
      <circle cx="96" cy="60" r="9" fill={W} fillOpacity="0.14" />
      <circle cx="150" cy="34" r="9" fill={W} fillOpacity="0.14" />
      {/* Bendera tujuan */}
      <g transform="translate(184 14)"><line x1="0" y1="0" x2="0" y2="22" strokeWidth="2.6" /><path d="M0 2 L16 7 L0 12 Z" fill={W} fillOpacity="0.9" stroke="none" /></g>
    </Frame>
  ),
  mentor: (
    <Frame>
      {/* Kepala bot */}
      <g transform="translate(58 44)"><rect x="0" y="0" width="46" height="38" rx="10" fill={W} fillOpacity="0.12" /><line x1="23" y1="-8" x2="23" y2="0" /><circle cx="23" cy="-10" r="2.6" fill={W} stroke="none" /><circle cx="15" cy="18" r="3.5" fill={W} stroke="none" /><circle cx="31" cy="18" r="3.5" fill={W} stroke="none" /><line x1="15" y1="28" x2="31" y2="28" strokeOpacity="0.7" /></g>
      {/* Bubble chat */}
      <g transform="translate(120 34)"><path d="M0 8 a8 8 0 0 1 8 -8 h44 a8 8 0 0 1 8 8 v22 a8 8 0 0 1 -8 8 h-30 l-10 9 v-9 h-4 a8 8 0 0 1 -8 -8 z" fill={W} fillOpacity="0.14" /><line x1="12" y1="14" x2="52" y2="14" strokeOpacity="0.7" /><line x1="12" y1="24" x2="40" y2="24" strokeOpacity="0.7" /></g>
      <path d="M150 78 l2.5 5 l5 2.5 l-5 2.5 l-2.5 5 l-2.5 -5 l-5 -2.5 l5 -2.5 z" fill={W} stroke="none" fillOpacity="0.9" />
    </Frame>
  ),
  coins: (
    <Frame>
      {/* Tumpukan koin */}
      <g transform="translate(60 40)">
        <ellipse cx="0" cy="46" rx="26" ry="9" fill={W} fillOpacity="0.16" /><ellipse cx="0" cy="46" rx="26" ry="9" />
        <ellipse cx="0" cy="34" rx="26" ry="9" fill={W} fillOpacity="0.16" /><ellipse cx="0" cy="34" rx="26" ry="9" />
        <ellipse cx="0" cy="22" rx="26" ry="9" fill={W} fillOpacity="0.22" /><ellipse cx="0" cy="22" rx="26" ry="9" />
        <text x="0" y="26" textAnchor="middle" fontSize="12" fontWeight="bold" fill={W} stroke="none">$</text>
      </g>
      {/* Tas belanja */}
      <g transform="translate(134 42)"><path d="M4 16 h40 l-4 46 h-32 z" fill={W} fillOpacity="0.12" /><path d="M14 20 v-6 a10 10 0 0 1 20 0 v6" strokeWidth="2.6" /></g>
    </Frame>
  ),
  start: (
    <Frame>
      {/* Roket */}
      <g transform="translate(96 24)">
        <path d="M14 0 C26 10, 30 30, 26 52 H2 C-2 30, 2 10, 14 0 Z" fill={W} fillOpacity="0.14" />
        <circle cx="14" cy="24" r="6" />
        <path d="M2 44 L-8 58 L6 52 Z" fill={W} fillOpacity="0.9" stroke="none" /><path d="M26 44 L36 58 L22 52 Z" fill={W} fillOpacity="0.9" stroke="none" />
        <path d="M9 58 q5 12 5 12 q0 0 5 -12" strokeWidth="2.4" strokeOpacity="0.85" />
      </g>
      <g stroke="none" fill={W}><circle cx="60" cy="40" r="2.5" fillOpacity="0.7" /><circle cx="160" cy="34" r="2.5" fillOpacity="0.7" /><circle cx="150" cy="70" r="2" fillOpacity="0.6" /><circle cx="66" cy="76" r="2" fillOpacity="0.6" /></g>
    </Frame>
  ),
};

export default function TourArt({ kind }) {
  return ART[kind] || ART.welcome;
}
