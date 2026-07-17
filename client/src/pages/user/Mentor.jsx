import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Bot, Send, Sparkles, Loader2, Target, ArrowRight, Trash2 } from "lucide-react";
import api from "../../api/client.js";
import useAuthStore from "../../store/authStore.js";
import { useMentorChat } from "../../hooks/useMentorChat.js";
import { useLang } from "../../lib/i18n.jsx";
import { BUST, parseDialog, preloadCompanion, useBlink, useVnReveal } from "../../lib/companion.js";

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

  // Onyen setengah badan di kanan (ala VN, #feedback 3) — jawaban AI dipecah per segmen
  // ber-tag [EMOSI] (pola VN MBTI Game) dan dimunculkan bergiliran; ekspresi berganti PER
  // SEGMEN sehingga emosinya dinamis mengikuti alur bicara.
  const [emotion, setEmotion] = useState("neutral");
  const blink = useBlink(true);
  const emoTimer = useRef(null);
  useEffect(() => { preloadCompanion(true); }, []);
  const reveal = useVnReveal(messages, (emo) => {
    setEmotion(emo);
    clearTimeout(emoTimer.current);
    emoTimer.current = setTimeout(() => setEmotion("neutral"), 12_000);
  });
  useEffect(() => {
    if (busy) { clearTimeout(emoTimer.current); setEmotion("surprised"); } // menyimak pertanyaan
    else if (!messages.length) {
      // Sapaan awal happy → turun ke neutral (pose idle yang BERKEDIP) agar karakter tetap
      // hidup — happy tak punya aset blink (di VN juga: matanya sudah tertutup tersenyum).
      setEmotion("happy");
      clearTimeout(emoTimer.current);
      emoTimer.current = setTimeout(() => setEmotion("neutral"), 6000);
    }
  }, [busy, messages.length]);
  useEffect(() => () => clearTimeout(emoTimer.current), []);

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
  }, [messages, busy, reveal]);

  function submit(text) {
    // JANGAN beri nama `t` — men-shadow fungsi terjemahan useLang.
    const q = (text || "").trim();
    if (!q || busy) return;
    setInput("");
    send(q, "AI Mentor");
  }

  return (
    <div className="lg:grid lg:gap-5 lg:items-start" style={{ gridTemplateColumns: "minmax(0,1fr) 340px" }}>
      {/* Kolom kiri: chat (feedback #3 — chat di kiri, karakter di kanan) */}
      <div className="space-y-4 min-w-0">
      {/* HP: panggung karakter DI ATAS chat (referensi UI) — sticky agar ekspresi Onyen selalu
          terlihat saat mengobrol. Di desktop karakter ada di kolom kanan (hidden lg:block),
          maka panggung ini lg:hidden. Ekspresi & kedip berbagi state dgn bust desktop. */}
      <div className="lg:hidden sticky top-0 z-20 -mx-4 -mt-4 mb-1 px-4 pt-3 pb-1" style={{ background: "var(--bg-page)" }}>
        <div className="rounded-2xl overflow-hidden" style={{ border: "1px solid var(--border)" }}>
          <div className="relative flex items-end justify-center h-32"
               style={{ background: "radial-gradient(130% 100% at 50% 8%, rgb(var(--brand-500) / 0.28) 0%, transparent 72%), var(--bg-surface)" }}>
            <span className="companion-float block">
              <img key={emotion} src={BUST(emotion, blink)} alt="Onyen" draggable={false}
                className="companion-pop h-28 w-auto drop-shadow-[0_8px_16px_rgba(2,6,23,0.45)]" />
            </span>
          </div>
          <div className="flex items-center justify-center gap-2 py-1.5" style={{ borderTop: "1px solid var(--border)", background: "var(--bg-surface)" }}>
            <span className="w-2 h-2 rounded-full shrink-0" style={{ background: busy ? "#f59e0b" : "#10b981" }} />
            <span className="text-sm font-bold" style={{ color: "var(--text-base)" }}>Onyen</span>
            <span className="text-[11px]" style={{ color: "var(--text-4)" }}>· {busy ? t("menyusun jawaban…") : t("AI Mentor · Online")}</span>
          </div>
        </div>
      </div>

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
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {suggestions.map((s) => (
              <button
                key={s.id || s.competencyCode}
                onClick={() => navigate("/app/learning-path")}
                className="flex items-center gap-2.5 rounded-lg p-2.5 text-left min-w-0 transition-colors hover:border-brand-500"
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
          {messages.map((m, i) => {
            if (m.role === "user") {
              return (
                <div key={i} className="flex gap-2 items-start flex-row-reverse">
                  <div className="w-8 h-8 rounded-full flex items-center justify-center shrink-0 text-[11px] font-medium bg-brand-600 text-white">{initials}</div>
                  <div className="rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed max-w-[82%] break-words bg-brand-600 text-white rounded-tr-sm" dangerouslySetInnerHTML={fmt(m.content)} />
                </div>
              );
            }
            // Jawaban Onyen dipecah jadi bubble pendek per segmen (ala textbox VN);
            // pesan terbaru muncul bergiliran, riwayat lama tampil langsung penuh.
            const segs = parseDialog(m.content);
            const visible = i === reveal.idx ? reveal.count : segs.length;
            const revealing = i === reveal.idx && reveal.count < segs.length;
            return (
              <div key={i} className="flex gap-2 items-start">
                <div className="w-8 h-8 rounded-full flex items-center justify-center shrink-0 bg-brand-600/10 overflow-hidden">
                  <img src={BUST("neutral", false)} alt="" className="w-7 h-7 object-contain object-top" />
                </div>
                <div className="flex flex-col gap-1.5 max-w-[82%] items-start">
                  {segs.slice(0, visible).map((s, j) => (
                    <div
                      key={j}
                      className="companion-pop rounded-2xl rounded-tl-sm px-3.5 py-2.5 text-sm leading-relaxed w-fit max-w-full break-words"
                      style={{ backgroundColor: "var(--bg-muted)", color: "var(--text-base)" }}
                      dangerouslySetInnerHTML={fmt(s.text)}
                    />
                  ))}
                  {revealing && (
                    <div className="rounded-2xl rounded-tl-sm px-4 py-2.5 w-fit" style={{ backgroundColor: "var(--bg-muted)" }}>
                      <Loader2 className="w-3.5 h-3.5 animate-spin text-brand-600" />
                    </div>
                  )}
                </div>
              </div>
            );
          })}
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

      {/* Kolom kanan: Onyen setengah badan ala VN (#3) — sticky DI TENGAH vertikal layar
          (bukan pojok atas) agar terasa duduk menemani percakapan; ekspresi ikut per segmen */}
      <div className="hidden lg:block sticky" style={{ top: "max(12px, calc(50vh - 260px))" }}>
        <div className="card p-0 overflow-hidden">
          <div
            className="relative flex items-center justify-center h-[300px] px-4 overflow-hidden"
            style={{ background: "radial-gradient(120% 100% at 50% 30%, rgb(var(--brand-500) / 0.20) 0%, transparent 70%)" }}
          >
            {/* float idle di wrapper TERPISAH dari companion-pop (dua animasi transform saling
                menimpa bila digabung di elemen yang sama) — pola sama dgn avatar kiri-bawah */}
            <span className="companion-float block">
              <img
                key={emotion}
                src={BUST(emotion, blink)}
                alt="Onyen"
                draggable={false}
                className="companion-pop w-[250px] max-w-full drop-shadow-[0_10px_18px_rgba(2,6,23,0.4)]"
              />
            </span>
          </div>
          <div className="px-4 py-3 flex items-center gap-2.5" style={{ borderTop: "1px solid var(--border)" }}>
            <span className="w-2 h-2 rounded-full shrink-0" style={{ background: busy ? "#f59e0b" : "#10b981" }} />
            <div className="min-w-0">
              <p className="text-sm font-bold" style={{ color: "var(--text-base)" }}>Onyen</p>
              <p className="text-[11px] truncate" style={{ color: "var(--text-3)" }}>
                {busy
                  ? t("Menyimak & menyusun jawaban…")
                  : emotion === "happy" ? t("Senang dengan progresmu!")
                  : emotion === "sadness" ? t("Masih ada yang perlu ditutup — pelan-pelan, ya.")
                  : emotion === "fear" ? t("Hmm, ada yang perlu diwaspadai…")
                  : t("Siap membantumu naik Skill Rank.")}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
