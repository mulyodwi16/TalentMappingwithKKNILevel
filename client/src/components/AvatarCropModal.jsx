import { useEffect, useRef, useState, useCallback } from "react";
import { X, ZoomIn, ZoomOut, Check, Loader2, Move } from "lucide-react";
import { useLang } from "../lib/i18n.jsx";

// Editor foto profil (#2): user bisa MENGATUR posisi (drag) & ukuran (zoom)
// sebelum foto tersimpan - tidak langsung terunggah begitu saja.
// Output: data URI JPEG persegi `size`px lewat onSave(dataUrl).
const VIEW = 280;   // sisi area pratinjau (px)
const OUT = 320;    // sisi output (px) - cukup tajam untuk panel identitas besar

export default function AvatarCropModal({ file, onSave, onClose, saving = false }) {
  const { t } = useLang();
  const [img, setImg] = useState(null);       // HTMLImageElement
  const [scale, setScale] = useState(1);      // 1 = cover penuh
  const [pos, setPos] = useState({ x: 0, y: 0 }); // offset px pada viewport
  const dragRef = useRef(null);               // { startX, startY, origX, origY }
  const canvasRef = useRef(null);

  // Muat gambar dari file.
  useEffect(() => {
    if (!file) return;
    const url = URL.createObjectURL(file);
    const im = new Image();
    im.onload = () => { setImg(im); setScale(1); setPos({ x: 0, y: 0 }); };
    im.src = url;
    return () => URL.revokeObjectURL(url);
  }, [file]);

  useEffect(() => {
    const onKey = (e) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  // Ukuran dasar "cover": sisi terpendek gambar memenuhi viewport.
  const base = img ? Math.max(VIEW / img.width, VIEW / img.height) : 1;
  const drawW = img ? img.width * base * scale : 0;
  const drawH = img ? img.height * base * scale : 0;

  // Jepit offset agar tak ada area kosong di tepi.
  const clamp = useCallback((p, s = scale) => {
    if (!img) return p;
    const w = img.width * base * s, h = img.height * base * s;
    const maxX = Math.max(0, (w - VIEW) / 2), maxY = Math.max(0, (h - VIEW) / 2);
    return { x: Math.min(maxX, Math.max(-maxX, p.x)), y: Math.min(maxY, Math.max(-maxY, p.y)) };
  }, [img, base, scale]);

  // Gambar pratinjau ke canvas tiap perubahan.
  useEffect(() => {
    const c = canvasRef.current;
    if (!c || !img) return;
    const ctx = c.getContext("2d");
    ctx.clearRect(0, 0, VIEW, VIEW);
    ctx.drawImage(img, (VIEW - drawW) / 2 + pos.x, (VIEW - drawH) / 2 + pos.y, drawW, drawH);
  }, [img, drawW, drawH, pos]);

  function onPointerDown(e) {
    e.preventDefault();
    dragRef.current = { startX: e.clientX, startY: e.clientY, origX: pos.x, origY: pos.y };
    e.currentTarget.setPointerCapture?.(e.pointerId);
  }
  function onPointerMove(e) {
    const d = dragRef.current;
    if (!d) return;
    setPos(clamp({ x: d.origX + (e.clientX - d.startX), y: d.origY + (e.clientY - d.startY) }));
  }
  function onPointerUp() { dragRef.current = null; }

  function setZoom(s) {
    const ns = Math.min(3, Math.max(1, s));
    setScale(ns);
    setPos((p) => clamp(p, ns));
  }

  function save() {
    if (!img) return;
    // Render ulang pada resolusi output (skala VIEW→OUT).
    const c = document.createElement("canvas");
    c.width = OUT; c.height = OUT;
    const ctx = c.getContext("2d");
    const k = OUT / VIEW;
    ctx.drawImage(img, ((VIEW - drawW) / 2 + pos.x) * k, ((VIEW - drawH) / 2 + pos.y) * k, drawW * k, drawH * k);
    onSave(c.toDataURL("image/jpeg", 0.85));
  }

  return (
    <div className="is-modal fixed inset-0 z-[110] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm" onClick={onClose}>
      <div className="rounded-2xl overflow-hidden w-full max-w-sm" style={{ background: "var(--bg-surface)", border: "1px solid var(--border)" }} onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-4 py-3" style={{ borderBottom: "1px solid var(--border)" }}>
          <p className="text-sm font-semibold" style={{ color: "var(--text-base)" }}>{t("Atur Foto Profil")}</p>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-red-500/10 hover:text-red-400" style={{ color: "var(--text-4)" }} aria-label={t("Tutup")}><X className="w-4 h-4" /></button>
        </div>

        <div className="p-5 flex flex-col items-center gap-4">
          {!img ? (
            <div className="grid place-items-center" style={{ width: VIEW, height: VIEW }}>
              <Loader2 className="w-6 h-6 animate-spin text-brand-500" />
            </div>
          ) : (
            <div className="relative rounded-2xl overflow-hidden shadow-lg cursor-move touch-none select-none"
              style={{ width: VIEW, height: VIEW, border: "2px solid var(--border-2)" }}
              onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={onPointerUp} onPointerLeave={onPointerUp}>
              <canvas ref={canvasRef} width={VIEW} height={VIEW} className="block" />
              {/* Panduan grid + hint geser */}
              <div className="pointer-events-none absolute inset-0" aria-hidden
                style={{ background: "linear-gradient(transparent calc(33% - 1px), rgba(255,255,255,0.18) 33%, transparent calc(33% + 1px), transparent calc(66% - 1px), rgba(255,255,255,0.18) 66%, transparent calc(66% + 1px)), linear-gradient(90deg, transparent calc(33% - 1px), rgba(255,255,255,0.18) 33%, transparent calc(33% + 1px), transparent calc(66% - 1px), rgba(255,255,255,0.18) 66%, transparent calc(66% + 1px))" }} />
              <span className="pointer-events-none absolute bottom-2 left-1/2 -translate-x-1/2 text-[10px] px-2 py-0.5 rounded-full bg-black/55 text-white flex items-center gap-1">
                <Move className="w-3 h-3" /> {t("geser untuk atur posisi")}
              </span>
            </div>
          )}

          {/* Zoom */}
          <div className="flex items-center gap-3 w-full px-1">
            <button onClick={() => setZoom(scale - 0.2)} className="p-1.5 rounded-lg hover:bg-[var(--bg-muted)]" style={{ color: "var(--text-3)" }} aria-label={t("Perkecil")}><ZoomOut className="w-4 h-4" /></button>
            <input type="range" min="1" max="3" step="0.05" value={scale} onChange={(e) => setZoom(Number(e.target.value))} className="flex-1 accent-[rgb(var(--brand-600))]" aria-label="Zoom" />
            <button onClick={() => setZoom(scale + 0.2)} className="p-1.5 rounded-lg hover:bg-[var(--bg-muted)]" style={{ color: "var(--text-3)" }} aria-label={t("Perbesar")}><ZoomIn className="w-4 h-4" /></button>
          </div>

          <button onClick={save} disabled={!img || saving} className="btn-primary w-full text-sm py-2.5 flex items-center justify-center gap-1.5 disabled:opacity-60">
            {saving ? <><Loader2 className="w-4 h-4 animate-spin" /> {t("Menyimpan…")}</> : <><Check className="w-4 h-4" /> {t("Simpan Foto")}</>}
          </button>
        </div>
      </div>
    </div>
  );
}
