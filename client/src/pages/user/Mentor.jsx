import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Bot, Send, Sparkles, Loader2, Target, ArrowRight, Trash2 } from "lucide-react";
import api from "../../api/client.js";
import useAuthStore from "../../store/authStore.js";
import { useMentorChat } from "../../hooks/useMentorChat.js";
import { useLang } from "../../lib/i18n.jsx";

const CHIPS = [
  "Apa langkah prioritas untuk naik Skill Rank saya?",
  "Kompetensi apa saja yang masih jadi gap untuk saya?",
  "Bagaimana cara mempersiapkan ujian kompetensi?",
  "Susun rencana belajar 30 hari untuk menutup gap saya.",
  "Jelaskan arti Skill Rank saya saat ini.",
];

const GREETING =
  "Halo! Saya **AI Mentor Karier** Anda. Saya memahami data pemetaan Anda — Skill Rank saat ini, target, " +
  "hasil ujian, dan gap kompetensi. Saya bisa bantu menyusun langkah agar Anda **naik rank**. " +
  "Apa yang ingin Anda konsultasikan?";

// Render minimal markdown: **bold** dan newline.
function fmt(text) {
  const html = text
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/\*\*(.*?)\*\*/g, "<b>$1</b>")
    .replace(/\n/g, "<br>");
  return { __html: html };
}

export default function Mentor() {
  const { t } = useLang();
  const user = useAuthStore((s) => s.user);
  const navigate = useNavigate();
  const { messages, busy, send, clear } = useMentorChat();
  const [input, setInput] = useState("");
  const boxRef = useRef(null);
  const initials = user?.name?.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase() ?? "?";

  // Saran menutup gap berbasis data ujian (clickable → fitur terkait).
  const { data: assessments = [] } = useQuery({
    queryKey: ["assessments"],
    queryFn: () => api.get("/user/skill-assessments"),
    enabled: !!user,
  });
  const suggestions = assessments
    .filter((a) => a.gap > 0)
    .sort((a, b) => b.gap - a.gap)
    .slice(0, 4);

  useEffect(() => {
    boxRef.current?.scrollTo({ top: boxRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, busy]);

  function submit(text) {
    // JANGAN beri nama `t` — men-shadow fungsi terjemahan useLang.
    const q = (text || "").trim();
    if (!q || busy) return;
    setInput("");
    send(q, "AI Mentor");
  }

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <Bot className="w-6 h-6 text-brand-600" /> {t("AI Mentor Karier")}
          </h1>
          <p className="text-sm mt-0.5" style={{ color: "var(--text-3)" }}>
            {t("Konsultasi yang memahami data pemetaan skill-mu — fokus menutup gap kompetensi & naik Skill Rank.")}
          </p>
        </div>
        {messages.length > 0 && (
          <button onClick={clear} className="btn-outline text-xs gap-1.5 flex items-center shrink-0 px-3 py-2">
            <Trash2 className="w-3.5 h-3.5" /> {t("Bersihkan")}
          </button>
        )}
      </div>

      {suggestions.length > 0 && (
        <div className="card p-3.5">
          <p className="text-xs font-semibold uppercase tracking-wider mb-2 flex items-center gap-1.5" style={{ color: "var(--text-3)" }}>
            <Sparkles className="w-3.5 h-3.5 text-brand-600" /> {t("Prioritas untuk Anda (gap terbesar)")}
          </p>
          <div className="grid sm:grid-cols-2 gap-2">
            {suggestions.map((s) => (
              <button
                key={s.id || s.competencyCode}
                onClick={() => navigate("/app/learning-path")}
                className="flex items-center gap-2.5 rounded-lg p-2.5 text-left transition-colors hover:border-brand-500"
                style={{ border: "1px solid var(--border-2)", backgroundColor: "var(--bg-raised)" }}
              >
                <div className="rounded-md bg-amber-500/10 p-1.5 text-amber-600 shrink-0"><Target className="w-4 h-4" /></div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium truncate">{s.competencyName}</p>
                  <p className="text-[11px]" style={{ color: "var(--text-4)" }}>{t("Skor")} {s.currentScore}% · gap -{s.gap}%</p>
                </div>
                <ArrowRight className="w-4 h-4 shrink-0" style={{ color: "var(--text-4)" }} />
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        {CHIPS.map((c) => {
          const label = t(c); // pertanyaan cepat ikut bahasa aktif — teks terkirim ke AI juga versi terjemahan
          return (
            <button
              key={c}
              onClick={() => submit(label)}
              disabled={busy}
              className="px-3 py-1.5 rounded-full text-xs transition-colors hover:text-brand-600 disabled:opacity-50"
              style={{ border: "1px solid var(--border-2)", color: "var(--text-3)" }}
            >
              {label.length > 42 ? label.slice(0, 40) + "…" : label}
            </button>
          );
        })}
      </div>

      <div className="card p-3">
        <div ref={boxRef} className="flex flex-col gap-3 min-h-[340px] max-h-[460px] overflow-y-auto p-1">
          {/* Sapaan awal hanya saat belum ada riwayat */}
          {messages.length === 0 && (
            <div className="flex gap-2 items-start">
              <div className="w-8 h-8 rounded-full bg-brand-600/10 flex items-center justify-center shrink-0"><Bot className="w-4 h-4 text-brand-600" /></div>
              <div className="rounded-2xl rounded-tl-sm px-3.5 py-2.5 text-sm leading-relaxed max-w-[82%]" style={{ backgroundColor: "var(--bg-muted)", color: "var(--text-base)" }} dangerouslySetInnerHTML={fmt(t(GREETING))} />
            </div>
          )}
          {messages.map((m, i) => (
            <div key={i} className={`flex gap-2 items-start ${m.role === "user" ? "flex-row-reverse" : ""}`}>
              <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 text-[11px] font-medium ${m.role === "user" ? "bg-brand-600 text-white" : "bg-brand-600/10"}`}>
                {m.role === "user" ? initials : <Bot className="w-4 h-4 text-brand-600" />}
              </div>
              <div
                className={`rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed max-w-[82%] ${m.role === "user" ? "bg-brand-600 text-white rounded-tr-sm" : "rounded-tl-sm"}`}
                style={m.role === "user" ? {} : { backgroundColor: "var(--bg-muted)", color: "var(--text-base)" }}
                dangerouslySetInnerHTML={fmt(m.content)}
              />
            </div>
          ))}
          {busy && (
            <div className="flex gap-2 items-start">
              <div className="w-8 h-8 rounded-full bg-brand-600/10 flex items-center justify-center shrink-0"><Bot className="w-4 h-4 text-brand-600" /></div>
              <div className="rounded-2xl rounded-tl-sm px-4 py-3" style={{ backgroundColor: "var(--bg-muted)" }}>
                <Loader2 className="w-4 h-4 animate-spin text-brand-600" />
              </div>
            </div>
          )}
        </div>

        <div className="flex gap-2 mt-3">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && submit(input)}
            placeholder={t("Ketik pertanyaan tentang Skill Rank & kompetensimu…")}
            disabled={busy}
            className="input flex-1"
          />
          <button onClick={() => submit(input)} disabled={busy || !input.trim()} className="btn-primary px-4 disabled:opacity-50">
            <Send className="w-4 h-4" />
          </button>
        </div>
      </div>

      <p className="text-[11px] flex items-center gap-1" style={{ color: "var(--text-4)" }}>
        <Sparkles className="w-3 h-3" /> {t("Riwayat tersimpan otomatis di perangkat ini. Jawaban AI memakai data pemetaan skill-mu — verifikasi info penting ke sumber resmi (Perpres 8/2012, SKKNI Kemnaker).")}
      </p>
    </div>
  );
}
