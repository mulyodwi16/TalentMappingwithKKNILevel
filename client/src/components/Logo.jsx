// Logo resmi TalentaAI - gem-perisai (senada emblem rank) dengan monogram "T" + kilau AI.
// Wordmark: "Talenta" (warna teks) + "AI" (aksen tosca). Pakai di sidebar, landing, auth.
export default function Logo({ size = 34, withWord = true, subtitle = "Skill Rank System", className = "" }) {
  return (
    <div className={`flex items-center gap-2.5 ${className}`}>
      <svg width={size} height={size} viewBox="0 0 48 48" role="img" aria-label="TalentaAI" className="shrink-0">
        <defs>
          <linearGradient id="ta-body" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#2f6bff" />
            <stop offset="0.55" stopColor="#2563eb" />
            <stop offset="1" stopColor="#2dd4bf" />
          </linearGradient>
          <linearGradient id="ta-gloss" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#ffffff" stopOpacity="0.5" />
            <stop offset="0.5" stopColor="#ffffff" stopOpacity="0.06" />
            <stop offset="1" stopColor="#ffffff" stopOpacity="0" />
          </linearGradient>
          <linearGradient id="ta-rim" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#8ff0e4" />
            <stop offset="1" stopColor="#1f8f7f" />
          </linearGradient>
        </defs>
        {/* Perisai gem */}
        <path d="M24 3 L42 12 L42 29 C42 39 34 44.5 24 46 C14 44.5 6 39 6 29 L6 12 Z"
          fill="url(#ta-body)" stroke="url(#ta-rim)" strokeWidth="2" strokeLinejoin="round" />
        <path d="M24 3 L42 12 L42 29 C42 39 34 44.5 24 46 C14 44.5 6 39 6 29 L6 12 Z" fill="url(#ta-gloss)" />
        {/* Monogram T */}
        <path d="M14 16 H34 V21.5 H27 V36 H21 V21.5 H14 Z" fill="#ffffff" fillOpacity="0.96" />
        {/* Kilau AI (sparkle) */}
        <path d="M35 8 L36.7 12.3 L41 14 L36.7 15.7 L35 20 L33.3 15.7 L29 14 L33.3 12.3 Z"
          fill="#7dffe9" stroke="#2dd4bf" strokeWidth="0.5" />
      </svg>
      {withWord && (
        <div className="leading-tight">
          <p className="text-sm font-extrabold tracking-tight" style={{ color: "var(--text-base)" }}>
            Talenta<span className="text-tosca-500">AI</span>
          </p>
          {subtitle && <p className="text-[11px]" style={{ color: "var(--text-4)" }}>{subtitle}</p>}
        </div>
      )}
    </div>
  );
}
