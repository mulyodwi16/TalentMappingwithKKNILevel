import { useEffect, useRef, useState } from "react";
import { useLocation } from "react-router-dom";
import { Bot, Send, X, Loader2, Sparkles, Trash2 } from "lucide-react";
import { useMentorChat } from "../hooks/useMentorChat.js";
import useAuthStore from "../store/authStore.js";

// Label fitur dari path — agar chat "context-aware" (tahu pengguna sedang di mana).
const PAGE_LABELS = [
  { match: "/app/dashboard",     label: "Dashboard" },
  { match: "/app/cv-upload",     label: "Upload CV" },
  { match: "/app/exam",          label: "Ujian Kompetensi" },
  { match: "/app/skill-gap",     label: "Skill Gap Analyzer" },
  { match: "/app/learning-path", label: "Learning Path" },
];
function pageLabel(loc) {
  return PAGE_LABELS.find((p) => loc.startsWith(p.match))?.label ?? "KKNI Talent Mapping";
}

function fmt(text) {
  const html = text
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/\*\*(.*?)\*\*/g, "<b>$1</b>")
    .replace(/\n/g, "<br>");
  return { __html: html };
}

// Chat AI mengambang (context-aware) — tampil di halaman User. Riwayat DIBAGI & PERSISTEN
// dengan halaman /app/mentor (useMentorChat) + mengirim konteks halaman aktif.
export default function FloatingMentor() {
  const { pathname } = useLocation();
  const role = useAuthStore((s) => s.user?.role);
  const { messages, busy, send, clear } = useMentorChat();
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");
  const boxRef = useRef(null);

  const ctx = pageLabel(pathname);

  useEffect(() => { boxRef.current?.scrollTo({ top: boxRef.current.scrollHeight, behavior: "smooth" }); }, [messages, busy, open]);

  // Khusus role User. Sembunyikan juga di halaman AI Mentor penuh (redundan).
  if (role !== "user") return null;
  if (pathname.startsWith("/app/mentor")) return null;

  function submit(text) {
    const t = (text || "").trim();
    if (!t || busy) return;
    setInput("");
    send(t, ctx);
  }

  return (
    <>
      {/* Tombol mengambang */}
      {!open && (
        <button
          onClick={() => setOpen(true)}
          className="fixed bottom-5 right-5 z-40 flex items-center gap-2 rounded-full bg-brand-600 text-white shadow-lg hover:shadow-xl hover:bg-brand-700 hover:scale-105 transition-all px-4 py-3"
          aria-label="Buka AI Mentor"
        >
          <Bot className="w-5 h-5" />
          <span className="text-sm font-medium hidden sm:inline">Tanya AI Mentor</span>
        </button>
      )}

      {/* Panel chat */}
      {open && (
        <div
          className="fixed bottom-5 right-5 z-40 w-[min(94vw,380px)] rounded-2xl flex flex-col overflow-hidden"
          style={{ maxHeight: "min(78vh, 560px)", backgroundColor: "var(--bg-surface)", border: "1px solid var(--border)", boxShadow: "var(--shadow)" }}
        >
          <div className="flex items-center justify-between gap-2 bg-gradient-to-r from-brand-600 to-tosca-500 text-white px-4 py-3">
            <div className="flex items-center gap-2 min-w-0">
              <div className="rounded-full bg-white/15 p-1.5"><Bot className="w-4 h-4" /></div>
              <div className="min-w-0">
                <p className="text-sm font-semibold leading-none">AI Mentor KKNI</p>
                <p className="text-[10px] text-white/70 truncate">Konteks: {ctx}</p>
              </div>
            </div>
            <div className="flex items-center gap-1 shrink-0">
              {messages.length > 0 && (
                <button onClick={clear} className="text-white/70 hover:text-white" aria-label="Bersihkan riwayat" title="Bersihkan riwayat"><Trash2 className="w-3.5 h-3.5" /></button>
              )}
              <button onClick={() => setOpen(false)} className="text-white/80 hover:text-white" aria-label="Tutup"><X className="w-4 h-4" /></button>
            </div>
          </div>

          <div ref={boxRef} className="flex-1 overflow-y-auto p-3 space-y-3 min-h-[200px]">
            {messages.length === 0 && (
              <div className="text-sm" style={{ color: "var(--text-3)" }}>
                <p className="mb-2">Halo! Tanya apa saja soal jenjang & kompetensi KKNI-mu. Saya tahu kamu sedang di <b style={{ color: "var(--text-base)" }}>{ctx}</b>.</p>
                <div className="flex flex-col gap-1.5">
                  {["Apa langkah prioritas untuk naik jenjang KKNI saya?", `Jelaskan fitur ${ctx} ini untuk saya.`].map((c) => (
                    <button key={c} onClick={() => submit(c)} className="text-left text-xs rounded-lg px-2.5 py-1.5 transition-colors hover:text-brand-600" style={{ border: "1px solid var(--border-2)" }}>{c}</button>
                  ))}
                </div>
              </div>
            )}
            {messages.map((m, i) => (
              <div key={i} className={`flex gap-2 items-start ${m.role === "user" ? "flex-row-reverse" : ""}`}>
                <div className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 ${m.role === "user" ? "bg-brand-600 text-white text-[10px]" : "bg-brand-600/10"}`}>{m.role === "user" ? "Aku" : <Bot className="w-3.5 h-3.5 text-brand-600" />}</div>
                <div
                  className={`rounded-2xl px-3 py-2 text-sm leading-relaxed max-w-[82%] ${m.role === "user" ? "bg-brand-600 text-white rounded-tr-sm" : "rounded-tl-sm"}`}
                  style={m.role === "user" ? {} : { backgroundColor: "var(--bg-muted)", color: "var(--text-base)" }}
                  dangerouslySetInnerHTML={fmt(m.content)}
                />
              </div>
            ))}
            {busy && (
              <div className="flex gap-2 items-start">
                <div className="w-6 h-6 rounded-full bg-brand-600/10 flex items-center justify-center"><Bot className="w-3.5 h-3.5 text-brand-600" /></div>
                <div className="rounded-2xl rounded-tl-sm px-3 py-2" style={{ backgroundColor: "var(--bg-muted)" }}><Loader2 className="w-4 h-4 animate-spin text-brand-600" /></div>
              </div>
            )}
          </div>

          <div className="p-2.5 flex gap-2" style={{ borderTop: "1px solid var(--border)" }}>
            <input
              value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={(e) => e.key === "Enter" && submit(input)}
              placeholder="Ketik pertanyaan…" disabled={busy}
              className="flex-1 px-3 py-2 rounded-lg text-sm outline-none focus:border-brand-500 disabled:opacity-50"
              style={{ backgroundColor: "var(--bg-raised)", border: "1px solid var(--border-2)", color: "var(--text-base)" }}
            />
            <button onClick={() => submit(input)} disabled={busy || !input.trim()} className="rounded-lg bg-brand-600 hover:bg-brand-700 text-white px-3 disabled:opacity-50" aria-label="Kirim"><Send className="w-4 h-4" /></button>
          </div>
          <p className="text-[9px] px-3 pb-2 flex items-center gap-1" style={{ color: "var(--text-4)" }}><Sparkles className="w-2.5 h-2.5" /> Riwayat tersimpan & dibagi dgn halaman AI Mentor. Verifikasi info penting ke sumber resmi.</p>
        </div>
      )}
    </>
  );
}
