import { useRef } from "react";
import { X, Download } from "lucide-react";
import CertificateArt from "./CertificateArt.jsx";

const codeOf = (id) => "TAI-" + String(id || "").replace(/[^a-z0-9]/gi, "").slice(-8).toUpperCase();

// Render SVG → PNG (2×) di canvas lalu unduh. Tanpa dependensi eksternal.
function downloadPng(svg, filename) {
  const xml = new XMLSerializer().serializeToString(svg);
  const url = "data:image/svg+xml;base64," + btoa(unescape(encodeURIComponent(xml)));
  const img = new Image();
  img.onload = () => {
    const c = document.createElement("canvas");
    c.width = 2000; c.height = 1400;
    const ctx = c.getContext("2d");
    ctx.fillStyle = "#ffffff"; ctx.fillRect(0, 0, c.width, c.height);
    ctx.drawImage(img, 0, 0, c.width, c.height);
    c.toBlob((b) => {
      const a = document.createElement("a");
      a.href = URL.createObjectURL(b); a.download = filename; a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 1000);
    }, "image/png");
  };
  img.src = url;
}

export default function CertificateModal({ cert, holder, onClose }) {
  const svgRef = useRef(null);
  if (!cert) return null;
  const code = codeOf(cert.id);

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div className="w-full max-w-3xl rounded-2xl overflow-hidden" style={{ background: "var(--bg-surface)", border: "1px solid var(--border)" }} onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-4 py-3" style={{ borderBottom: "1px solid var(--border)" }}>
          <p className="text-sm font-semibold" style={{ color: "var(--text-base)" }}>Sertifikat Kompetensi</p>
          <div className="flex items-center gap-2">
            <button onClick={() => downloadPng(svgRef.current, `Sertifikat-${(holder || "peserta").replace(/\s+/g, "_")}-${code}.png`)}
              className="btn-primary text-xs py-1.5 px-3 flex items-center gap-1.5"><Download className="w-3.5 h-3.5" /> Unduh PNG</button>
            <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-red-50 hover:text-red-500" style={{ color: "var(--text-4)" }}><X className="w-4 h-4" /></button>
          </div>
        </div>
        <div className="p-4 max-h-[80vh] overflow-auto" style={{ background: "var(--bg-muted)" }}>
          <div className="rounded-lg overflow-hidden shadow-lg mx-auto" style={{ maxWidth: 760 }}>
            <CertificateArt
              ref={svgRef}
              holder={holder}
              competency={cert.name}
              score={cert.score}
              date={cert.issuedAt}
              level={cert.kkniLevel}
              unitCode={cert.competencyCode}
              code={code}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
