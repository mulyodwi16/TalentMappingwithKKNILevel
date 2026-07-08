import { useEffect, useRef, useState } from "react";
import { useLocation } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Send, X, Loader2, Sparkles, Trash2, Bot } from "lucide-react";
import api from "../api/client.js";
import { useMentorChat } from "../hooks/useMentorChat.js";
import useAuthStore from "../store/authStore.js";
import { useLang } from "../lib/i18n.jsx";
import { IMG, parseDialog, preloadCompanion, useBlink, useVnReveal } from "../lib/companion.js";

// ── AI Companion "Onyen" (#14/#15) ────────────────────────────────────────────
// Avatar pendamping di kiri-bawah (menggantikan tombol AI Mentor kanan-bawah yang menggantung).
// Perilaku ala karakter Renpy: idle berkedip, emosi berganti sesuai konteks, dan TERUS memberi
// saran selagi idle (ticker berputar, sadar-data). Hover → menyapa (setiap kali). Klik → avatar
// MEMBESAR (tetap menemani) + panel chat AI Mentor terbuka di KANAN-bawah (menu kiri tak tertutup);
// ekspresinya ikut bereaksi terhadap isi percakapan.

// Label fitur dari path — dikirim sebagai konteks chat (sama dgn halaman mentor).
const PAGE_LABELS = [
  { match: "/app/dashboard",     label: "Dashboard" },
  { match: "/app/cv-upload",     label: "Upload CV" },
  { match: "/app/exam",          label: "Ujian Kompetensi" },
  { match: "/app/skill-gap",     label: "Skill Gap Analyzer" },
  { match: "/app/learning-path", label: "Learning Path" },
  { match: "/app/kelas",         label: "Kelas" },
  { match: "/app/jobs",          label: "Peta Posisi" },
  { match: "/app/profile",       label: "Profil" },
  { match: "/app/toko",          label: "Toko Koin" },
];
const pageLabel = (loc) => PAGE_LABELS.find((p) => loc.startsWith(p.match))?.label ?? "TalentaAI";

// Komentar pembuka saat pindah fitur (#15) — dipilih sesuai kondisi data user.
function routeComment(pathname, ov, t, name) {
  const hasCv = !!(ov?.cv?.parsedAt || ov?.cv?.education);
  const hasComp = !!ov?.chosenSkkni;
  if (pathname.startsWith("/app/dashboard")) {
    if (ov && !hasCv)   return { emotion: "sadness",   text: t("Hmm, CV-mu belum diunggah. Unggah dulu yuk, biar aku bisa membaca keahlianmu!") };
    if (ov && !hasComp) return { emotion: "surprised", text: t("Kamu belum punya kompetensi target. Pilih dulu di Profil, ya!") };
    return { emotion: "happy", text: t("Selamat datang kembali, {name}! Semua terlihat rapi — lanjutkan progresmu.", { name }) };
  }
  if (pathname.startsWith("/app/cv-upload"))
    return hasCv
      ? { emotion: "happy",   text: t("CV-mu sudah ada. Perbarui kapan saja kalau ada pencapaian baru!") }
      : { emotion: "neutral", text: t("Unggah CV PDF-mu di sini — nanti kubantu petakan keahlianmu ke standar SKKNI.") };
  if (pathname.startsWith("/app/kelas"))
    return { emotion: "neutral", text: t("Selesaikan materi kelasnya dulu — ujian unitnya terbuka otomatis setelah itu.") };
  if (pathname.startsWith("/app/exam"))
    return { emotion: "neutral", text: t("Tenang, skor 60% per unit sudah lulus dan langsung dapat sertifikat!") };
  if (pathname.startsWith("/app/skill-gap"))
    return { emotion: "neutral", text: t("Tutup gap terbesar duluan — itu cara tercepat menaikkan Skill Rank-mu.") };
  if (pathname.startsWith("/app/learning-path"))
    return { emotion: "happy", text: t("Rencana ini kususun dari seluruh datamu — progresnya terlacak otomatis!") };
  if (pathname.startsWith("/app/jobs"))
    return { emotion: "neutral", text: t("Skill dari CV baru klaim — buktikan lewat ujian supaya sah di Peta Posisi.") };
  if (pathname.startsWith("/app/toko"))
    return { emotion: "neutral", text: t("Ingat: koin membeli akses, bukan bukti. Sertifikat tetap dari lulus ujian!") };
  if (pathname.startsWith("/app/profile"))
    return hasComp
      ? { emotion: "neutral",   text: t("Ini pusat datamu: kompetensi, sertifikat, dan bukti eksternal.") }
      : { emotion: "surprised", text: t("Pilih kompetensi SKKNI targetmu di sini — semua fitur akan mengikutinya.") };
  return null;
}

// Kolam saran idle (#feedback 2: companion TERUS memberi saran selagi idle) — disusun dari
// kondisi data user, lalu dirotasi bergiliran oleh ticker. Makin lengkap data, makin personal.
function buildIdleTips(ov, t, name) {
  const tips = [];
  const hasCv = !!(ov?.cv?.parsedAt || ov?.cv?.education);
  const hasComp = !!ov?.chosenSkkni;
  const readiness = ov?.readiness?.total ?? null;
  const next = ov?.rank?.next;

  if (ov && !hasCv)   tips.push({ emotion: "sadness",   text: t("Hmm, CV-mu belum diunggah. Unggah dulu yuk, biar aku bisa membaca keahlianmu!") });
  if (ov && !hasComp) tips.push({ emotion: "surprised", text: t("Kamu belum punya kompetensi target. Pilih dulu di Profil, ya!") });
  if (readiness != null && hasComp) {
    if (readiness < 50) tips.push({ emotion: "fear",  text: t("Skor kesiapanmu baru {n}%. Tutup gap terbesar dulu, biar cepat naik!", { n: readiness }) });
    else if (readiness >= 80) tips.push({ emotion: "happy", text: t("Kesiapanmu {n}% — kamu hampir siap penuh. Pertahankan, {name}!", { n: readiness, name }) });
  }
  if (next?.need) tips.push({ emotion: "happy", text: t("Sedikit lagi! Butuh {need} poin kompetensi untuk naik ke tier berikutnya — semangat!", { need: next.need }) });
  // Saran umum (selalu ada agar rotasi tak pernah kosong).
  tips.push(
    { emotion: "neutral", text: t("Jangan lupa Course Harian di Dashboard — soalnya baru setiap hari!") },
    { emotion: "neutral", text: t("Tutup gap terbesar duluan — itu cara tercepat menaikkan Skill Rank-mu.") },
    { emotion: "neutral", text: t("Bukti eksternal (sertifikasi BNSP, portofolio) bisa menembus batas rank — tambahkan di Profil!") },
    { emotion: "neutral", text: t("Sudah cek Peta Posisi? Lihat seberapa siap kamu untuk posisi targetmu.") },
    { emotion: "neutral", text: t("Ingat: koin membeli akses, bukan bukti. Sertifikat tetap dari lulus ujian!") },
  );
  return tips;
}

// Sapaan saat kursor menyentuh avatar (dirotasi berurutan — muncul SETIAP kali hover).
const GREETINGS = [
  (t, name) => t("Hai {name}! Ada yang bisa kubantu?", { name }),
  (t) => t("Aku Onyen, pendamping belajarmu. Klik untuk ngobrol!"),
  (t) => t("Halo! Klik aku kalau mau tanya-tanya soal kariermu."),
];

const IDLE_FIRST_DELAY = 12_000; // saran idle pertama setelah komentar pembuka
const IDLE_INTERVAL = 26_000;    // jeda antar saran idle
const IDLE_SHOW = 9_000;         // lama bubble tampil

function fmt(text) {
  const html = text
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/\*\*(.*?)\*\*/g, "<b>$1</b>")
    .replace(/\n/g, "<br>");
  return { __html: html };
}

export default function CompanionAvatar() {
  const { t } = useLang();
  const { pathname } = useLocation();
  const user = useAuthStore((s) => s.user);
  const role = user?.role;
  const firstName = (user?.name || "").split(/\s+/)[0] || "";

  const { messages, busy, send, clear } = useMentorChat();
  const [open, setOpen] = useState(false);        // panel chat (kanan-bawah)
  const [input, setInput] = useState("");
  const [emotion, setEmotion] = useState("neutral");
  const [bubble, setBubble] = useState(null);     // { text }
  const [hover, setHover] = useState(false);
  const boxRef = useRef(null);
  const hideTimer = useRef(null);
  const emoTimer = useRef(null);
  const greetIdx = useRef(0);
  const tipIdx = useRef(0);
  const hoverRef = useRef(false);

  const enabled = role === "user" && !pathname.startsWith("/app/mentor");
  const blink = useBlink(enabled);

  // Data user untuk saran sadar-data — berbagi cache dgn Sidebar/Dashboard (["overview"]).
  const { data: ov } = useQuery({
    queryKey: ["overview"],
    queryFn: () => api.get("/user/overview"),
    enabled,
    staleTime: 60_000,
  });

  useEffect(() => { if (enabled) preloadCompanion(false); }, [enabled]);

  // Satu pintu untuk menampilkan bubble + emosi (mencegah timer saling tumpang).
  function showBubble(c, duration = IDLE_SHOW) {
    if (!c) return;
    clearTimeout(hideTimer.current);
    setEmotion(c.emotion || "neutral");
    setBubble({ text: c.text });
    hideTimer.current = setTimeout(() => {
      if (hoverRef.current) return; // sedang di-hover → biarkan
      setBubble(null);
      setEmotion("neutral");
    }, duration);
  }

  // Komentar pembuka saat pindah halaman (setiap navigasi — bukan sekali per sesi).
  useEffect(() => {
    if (!enabled || open) return;
    const c = routeComment(pathname, ov, t, firstName);
    if (!c) return;
    const show = setTimeout(() => showBubble(c), 800);
    return () => clearTimeout(show);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, open, pathname]);

  // Ticker saran idle (#feedback 2): selagi tidak chat & tidak hover, terus beri saran
  // bergiliran sesuai data user — tak pernah berhenti.
  useEffect(() => {
    if (!enabled || open) return;
    let alive = true;
    let timer;
    const tick = (delay) => {
      timer = setTimeout(() => {
        if (!alive) return;
        if (!hoverRef.current) {
          const tips = buildIdleTips(ov, t, firstName);
          showBubble(tips[tipIdx.current % tips.length]);
          tipIdx.current += 1;
        }
        tick(IDLE_INTERVAL);
      }, delay);
    };
    tick(IDLE_FIRST_DELAY);
    return () => { alive = false; clearTimeout(timer); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, open, pathname, ov, t, firstName]);

  // Saat chat: jawaban Onyen dipecah per segmen ber-tag [EMOSI] (ala VN) & muncul bergiliran;
  // ekspresi avatar berganti PER SEGMEN (#feedback: emosi dinamis per kalimat).
  const reveal = useVnReveal(messages, (emo) => {
    setEmotion(emo);
    clearTimeout(emoTimer.current);
    emoTimer.current = setTimeout(() => setEmotion("neutral"), 12_000);
  });
  useEffect(() => {
    if (open && busy) { clearTimeout(emoTimer.current); setEmotion("surprised"); } // menyimak
  }, [open, busy]);

  useEffect(() => () => { clearTimeout(hideTimer.current); clearTimeout(emoTimer.current); }, []);
  useEffect(() => { boxRef.current?.scrollTo({ top: boxRef.current.scrollHeight, behavior: "smooth" }); }, [messages, busy, open, reveal]);

  if (!enabled) return null;

  const ctx = pageLabel(pathname);

  // Deteksi hover (#15): menyapa SETIAP kali kursor menyentuh (sapaan dirotasi).
  function onEnter() {
    setHover(true);
    hoverRef.current = true;
    if (open) return; // saat chat terbuka, ekspresi dikendalikan percakapan
    const g = GREETINGS[greetIdx.current % GREETINGS.length];
    greetIdx.current += 1;
    clearTimeout(hideTimer.current);
    setEmotion("happy");
    setBubble({ text: g(t, firstName) });
  }
  function onLeave() {
    setHover(false);
    hoverRef.current = false;
    if (open) return;
    clearTimeout(hideTimer.current);
    hideTimer.current = setTimeout(() => { setBubble(null); setEmotion("neutral"); }, 1200);
  }

  function toggleChat() {
    if (open) { setOpen(false); setEmotion("neutral"); return; }
    setBubble(null);
    // Sambutan happy → turun ke neutral (pose idle yang berkedip) agar karakter tetap hidup
    // walau belum ada percakapan — happy tak punya aset blink.
    setEmotion("happy");
    clearTimeout(emoTimer.current);
    emoTimer.current = setTimeout(() => setEmotion("neutral"), 6000);
    setOpen(true);
  }

  function submit(text) {
    // JANGAN beri nama `t` — men-shadow fungsi terjemahan useLang.
    const q = (text || "").trim();
    if (!q || busy) return;
    setInput("");
    send(q, ctx);
  }

  return (
    <>
      {/* Avatar Onyen (kiri-bawah) saat idle — sembunyi saat chat terbuka (pindah ke atas panel) */}
      {!open && (
        <div className="fixed bottom-0 left-2 z-40 flex items-end gap-2 select-none pointer-events-none">
          <button
            onClick={toggleChat}
            onMouseEnter={onEnter}
            onMouseLeave={onLeave}
            className="relative block focus:outline-none pointer-events-auto"
            style={{ transition: "transform .25s ease", transform: hover ? "scale(1.05)" : "none" }}
            aria-label={t("Buka AI Mentor")}
            title={t("Ngobrol dengan Onyen (AI Mentor)")}
          >
            {/* float di wrapper terpisah — animasi transform tak bentrok dgn hover scale di button */}
            <span className="companion-float block">
              <img
                src={IMG(emotion, blink)}
                alt="Onyen"
                draggable={false}
                className="h-44 w-auto drop-shadow-[0_6px_10px_rgba(2,6,23,0.45)]"
              />
            </span>
          </button>

          {bubble && (
            <div
              className="companion-pop relative mb-16 max-w-[280px] rounded-2xl rounded-bl-sm px-3.5 py-2.5 text-xs leading-relaxed shadow-lg pointer-events-auto"
              style={{ background: "var(--bg-surface)", border: "1px solid var(--border)", color: "var(--text-base)" }}
              role="status"
            >
              <span className="font-bold text-brand-500">Onyen · </span>{bubble.text}
              {/* ekor bubble */}
              <span
                className="absolute -left-1.5 bottom-3 w-3 h-3 rotate-45"
                style={{ background: "var(--bg-surface)", borderLeft: "1px solid var(--border)", borderBottom: "1px solid var(--border)" }}
              />
            </div>
          )}
        </div>
      )}

      {/* Panel chat — KANAN-bawah; Onyen "nongol" dari balik tepi atas panel (kaki ter-clip),
          ekspresinya bereaksi ke percakapan. Riwayat dibagi dgn /app/mentor */}
      {open && (
        <div className="fixed bottom-5 right-5 z-40 w-[min(94vw,380px)]">
          <span className="absolute right-6 z-0 select-none pointer-events-none" style={{ bottom: "calc(100% - 34px)" }}>
            {/* float di wrapper terpisah dari companion-pop (animasi transform tak boleh digabung) */}
            <span className="companion-float block">
              <img
                src={IMG(emotion, blink)}
                alt="Onyen"
                draggable={false}
                className="companion-pop h-[150px] w-auto drop-shadow-[0_4px_8px_rgba(2,6,23,0.4)]"
              />
            </span>
          </span>
          <div
            className="relative z-10 rounded-2xl flex flex-col overflow-hidden"
            style={{ maxHeight: "min(78vh, 560px)", backgroundColor: "var(--bg-surface)", border: "1px solid var(--border)", boxShadow: "var(--shadow)" }}
          >
          <div className="flex items-center justify-between gap-2 bg-gradient-to-r from-brand-600 to-tosca-500 text-white px-4 py-3">
            <div className="flex items-center gap-2 min-w-0">
              <img src={IMG("happy", false)} alt="" className="w-8 h-8 object-contain object-top rounded-full bg-white/15 p-0.5" />
              <div className="min-w-0">
                <p className="text-sm font-semibold leading-none">{t("Onyen · AI Mentor")}</p>
                <p className="text-[10px] text-white/70 truncate">{t("Konteks:")} {ctx}</p>
              </div>
            </div>
            <div className="flex items-center gap-1 shrink-0">
              {messages.length > 0 && (
                <button onClick={clear} className="text-white/70 hover:text-white" aria-label={t("Bersihkan riwayat")} title={t("Bersihkan riwayat")}><Trash2 className="w-3.5 h-3.5" /></button>
              )}
              <button onClick={() => { setOpen(false); setEmotion("neutral"); }} className="text-white/80 hover:text-white" aria-label={t("Tutup")}><X className="w-4 h-4" /></button>
            </div>
          </div>

          <div ref={boxRef} className="flex-1 overflow-y-auto p-3 space-y-3 min-h-[200px]">
            {messages.length === 0 && (
              <div className="text-sm" style={{ color: "var(--text-3)" }}>
                <p className="mb-2">{t("Halo! Tanya apa saja soal Skill Rank & kompetensimu. Saya tahu kamu sedang di")} <b style={{ color: "var(--text-base)" }}>{ctx}</b>.</p>
                <div className="flex flex-col gap-1.5">
                  {[t("Apa langkah prioritas untuk naik Skill Rank saya?"), t("Jelaskan fitur {ctx} ini untuk saya.", { ctx })].map((c) => (
                    <button key={c} onClick={() => submit(c)} className="text-left text-xs rounded-lg px-2.5 py-1.5 transition-colors hover:text-brand-600" style={{ border: "1px solid var(--border-2)" }}>{c}</button>
                  ))}
                </div>
              </div>
            )}
            {messages.map((m, i) => {
              if (m.role === "user") {
                return (
                  <div key={i} className="flex gap-2 items-start flex-row-reverse">
                    <div className="w-6 h-6 rounded-full flex items-center justify-center shrink-0 bg-brand-600 text-white text-[10px]">{t("Aku")}</div>
                    <div className="rounded-2xl px-3 py-2 text-sm leading-relaxed max-w-[82%] bg-brand-600 text-white rounded-tr-sm" dangerouslySetInnerHTML={fmt(m.content)} />
                  </div>
                );
              }
              // Bubble pendek per segmen ala VN; pesan terbaru muncul bergiliran.
              const segs = parseDialog(m.content);
              const visible = i === reveal.idx ? reveal.count : segs.length;
              const revealing = i === reveal.idx && reveal.count < segs.length;
              return (
                <div key={i} className="flex gap-2 items-start">
                  <div className="w-6 h-6 rounded-full flex items-center justify-center shrink-0 overflow-hidden bg-brand-600/10">
                    <img src={IMG("neutral", false)} alt="" className="w-5 h-5 object-contain object-top" />
                  </div>
                  <div className="flex flex-col gap-1.5 max-w-[82%] items-start">
                    {segs.slice(0, visible).map((s, j) => (
                      <div key={j} className="companion-pop rounded-2xl rounded-tl-sm px-3 py-2 text-sm leading-relaxed w-fit" style={{ backgroundColor: "var(--bg-muted)", color: "var(--text-base)" }} dangerouslySetInnerHTML={fmt(s.text)} />
                    ))}
                    {revealing && (
                      <div className="rounded-2xl rounded-tl-sm px-3.5 py-2 w-fit" style={{ backgroundColor: "var(--bg-muted)" }}>
                        <Loader2 className="w-3.5 h-3.5 animate-spin text-brand-600" />
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
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
              placeholder={t("Ketik pertanyaan…")} disabled={busy}
              className="flex-1 px-3 py-2 rounded-lg text-sm outline-none focus:border-brand-500 disabled:opacity-50"
              style={{ backgroundColor: "var(--bg-raised)", border: "1px solid var(--border-2)", color: "var(--text-base)" }}
            />
            <button onClick={() => submit(input)} disabled={busy || !input.trim()} className="rounded-lg bg-brand-600 hover:bg-brand-700 text-white px-3 disabled:opacity-50" aria-label={t("Kirim")}><Send className="w-4 h-4" /></button>
          </div>
          <p className="text-[9px] px-3 pb-2 flex items-center gap-1" style={{ color: "var(--text-4)" }}><Sparkles className="w-2.5 h-2.5" /> {t("Riwayat tersimpan & dibagi dgn halaman AI Mentor. Verifikasi info penting ke sumber resmi.")}</p>
          </div>
        </div>
      )}
    </>
  );
}
