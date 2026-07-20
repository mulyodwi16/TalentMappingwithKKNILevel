import { forwardRef } from "react";
import { rankName, rankOf } from "../lib/rank.js";

// Template sertifikat kompetensi (SVG, aset utama) - diisi data pemegang.
// Dipakai untuk setiap sertifikat hasil ujian; bisa dilihat & diunduh sebagai PNG.
const fmtDate = (d) => (d ? new Date(d).toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" }) : "-");

// Nama kompetensi bisa panjang (judul unit SKKNI) - penggal jadi maks 2 baris + kecilkan font
// agar tak meluber keluar bingkai. <text> SVG tak auto-wrap.
function layoutTitle(t) {
  const title = (t || "Unit Kompetensi").trim();
  if (title.length <= 40) return { size: 28, lines: [title] };
  const size = title.length <= 82 ? 23 : 21;
  const maxChars = 44;
  const words = title.split(/\s+/);
  const lines = [""];
  for (const w of words) {
    const li = lines.length - 1;
    const next = lines[li] ? `${lines[li]} ${w}` : w;
    if (next.length <= maxChars || lines[li] === "") lines[li] = next;
    else if (lines.length < 2) lines.push(w);
    else { lines[1] += " …"; break; }
  }
  return { size, lines };
}

const CertificateArt = forwardRef(function CertificateArt({ holder, competency, score, date, level, code, unitCode }, ref) {
  const rc = rankOf(level)?.color || "#2563eb";
  const rname = level ? rankName(level) : null;
  const tl = layoutTitle(competency);
  const twoLines = tl.lines.length > 1;
  const line1Y = twoLines ? 384 : 398;
  const line2Y = line1Y + tl.size + 4;
  const codeY = twoLines ? line2Y + 22 : 424;
  return (
    <svg ref={ref} viewBox="0 0 1000 700" width="100%" xmlns="http://www.w3.org/2000/svg" role="img" aria-label={`Sertifikat ${holder}`}
      fontFamily="Georgia, 'Times New Roman', serif">
      <defs>
        <linearGradient id="cg-brand" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#2f6bff" /><stop offset="1" stopColor="#2dd4bf" /></linearGradient>
        <linearGradient id="cg-paper" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#ffffff" /><stop offset="1" stopColor="#f6f8fc" /></linearGradient>
        <radialGradient id="cg-seal" cx="0.5" cy="0.4" r="0.7"><stop offset="0" stopColor="#ffe9a8" /><stop offset="1" stopColor="#d99a2b" /></radialGradient>
      </defs>

      {/* Kertas + bingkai */}
      <rect x="0" y="0" width="1000" height="700" fill="url(#cg-paper)" />
      <rect x="18" y="18" width="964" height="664" rx="10" fill="none" stroke="url(#cg-brand)" strokeWidth="6" />
      <rect x="30" y="30" width="940" height="640" rx="6" fill="none" stroke={rc} strokeOpacity="0.35" strokeWidth="1.6" />
      {/* Pita sudut */}
      {[[30, 30], [970, 30], [30, 670], [970, 670]].map(([x, y], i) => (
        <circle key={i} cx={x} cy={y} r="5" fill="url(#cg-brand)" />
      ))}

      {/* Header: logo + wordmark - sejajar & rata tengah */}
      <g transform="translate(431 70)">
        <g>
          <path d="M17 2 L30 7.5 L30 19 C30 27.5 23.5 32 17 34 C10.5 32 4 27.5 4 19 L4 7.5 Z" fill="url(#cg-brand)" />
          <path d="M9.5 11 H24.5 V15 H19.5 V25.5 H14.5 V15 H9.5 Z" fill="#fff" />
        </g>
        <text x="44" y="26" fontFamily="Segoe UI, sans-serif" fontSize="20" fontWeight="700" fill="#1e293b">Talenta<tspan fill="#12a594">AI</tspan></text>
      </g>

      <text x="500" y="150" textAnchor="middle" fontSize="40" fontWeight="700" letterSpacing="6" fill="#1e293b">SERTIFIKAT KOMPETENSI</text>
      <text x="500" y="178" textAnchor="middle" fontFamily="Segoe UI, sans-serif" fontSize="13" letterSpacing="3" fill="#64748b">CERTIFICATE OF COMPETENCE</text>
      <line x1="430" y1="196" x2="570" y2="196" stroke={rc} strokeWidth="2" />

      {/* Penerima */}
      <text x="500" y="248" textAnchor="middle" fontFamily="Segoe UI, sans-serif" fontSize="15" fill="#64748b">Dengan bangga diberikan kepada</text>
      <text x="500" y="300" textAnchor="middle" fontSize="52" fontStyle="italic" fontWeight="700" fill="#0f2a5e">{holder || "Nama Peserta"}</text>
      <line x1="300" y1="318" x2="700" y2="318" stroke="#cbd5e1" strokeWidth="1.4" />

      {/* Kompetensi (auto-wrap maks 2 baris) */}
      <text x="500" y="360" textAnchor="middle" fontFamily="Segoe UI, sans-serif" fontSize="15" fill="#64748b">atas keberhasilan menguasai kompetensi</text>
      <text x="500" y={line1Y} textAnchor="middle" fontSize={tl.size} fontWeight="700" fill="#1e293b">{tl.lines[0]}</text>
      {twoLines && <text x="500" y={line2Y} textAnchor="middle" fontSize={tl.size} fontWeight="700" fill="#1e293b">{tl.lines[1]}</text>}
      {unitCode && <text x="500" y={codeY} textAnchor="middle" fontFamily="Segoe UI, sans-serif" fontSize="12" letterSpacing="1" fill="#94a3b8">Unit SKKNI · {unitCode}</text>}

      {/* Baris: SKOR · SEGEL · RANK (satu level, tak tumpang tindih) */}
      <g fontFamily="Segoe UI, sans-serif" textAnchor="middle">
        <g transform="translate(300 488)">
          <rect x="-72" y="-28" width="144" height="56" rx="10" fill="#f1f5f9" stroke="#e2e8f0" />
          <text x="0" y="-6" fontSize="12" fill="#64748b">SKOR</text>
          <text x="0" y="17" fontSize="22" fontWeight="800" fill="#12a594">{score ?? 0}%</text>
        </g>
        <g transform="translate(700 488)">
          <rect x="-72" y="-28" width="144" height="56" rx="10" fill="#f1f5f9" stroke="#e2e8f0" />
          <text x="0" y="-6" fontSize="12" fill="#64748b">SKILL RANK</text>
          <text x="0" y="17" fontSize="22" fontWeight="800" fill={rc}>{rname || "-"}</text>
        </g>
      </g>
      <g transform="translate(500 482)">
        <circle cx="0" cy="0" r="38" fill="url(#cg-seal)" stroke="#b7791f" strokeWidth="2" />
        <path d="M0 -20 l5.5 12 l13 1 l-10 8.5 l3.5 13 l-12 -7.5 l-12 7.5 l3.5 -13 l-10 -8.5 l13 -1 z" fill="#fff" fillOpacity="0.92" />
        <text x="0" y="52" textAnchor="middle" fontFamily="Segoe UI, sans-serif" fontSize="9.5" letterSpacing="1.5" fill="#7c5310" fontWeight="700">TERVERIFIKASI</text>
      </g>

      {/* Footer - diberi jarak jelas di bawah baris segel */}
      <g fontFamily="Segoe UI, sans-serif" fill="#475569">
        <text x="120" y="606" fontSize="13">Tanggal terbit</text>
        <text x="120" y="626" fontSize="15" fontWeight="700" fill="#1e293b">{fmtDate(date)}</text>
        <line x1="120" y1="638" x2="300" y2="638" stroke="#cbd5e1" />

        <text x="880" y="606" textAnchor="end" fontSize="13">Kode verifikasi</text>
        <text x="880" y="626" textAnchor="end" fontSize="15" fontWeight="700" fill="#1e293b" fontFamily="'Courier New', monospace">{code || "-"}</text>
        <line x1="700" y1="638" x2="880" y2="638" stroke="#cbd5e1" />
      </g>
      <text x="500" y="662" textAnchor="middle" fontFamily="Segoe UI, sans-serif" fontSize="11" fill="#94a3b8">
        Diterbitkan oleh Sistem Sertifikasi TalentaAI · Selaras Standar Kompetensi Kerja Nasional Indonesia (SKKNI), Perpres No. 8 Tahun 2012
      </text>
    </svg>
  );
});

export default CertificateArt;
