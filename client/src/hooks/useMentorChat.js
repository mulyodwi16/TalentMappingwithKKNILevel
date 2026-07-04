import { useCallback, useEffect, useRef, useState } from "react";
import useAuthStore from "../store/authStore.js";

// Riwayat AI Mentor yang PERSISTEN (localStorage) & DIBAGI antara halaman /app/mentor dan
// chat mengambang. Konteks panjang dijaga: setelah >100 pesan, pesan lama diringkas jadi poin
// (via /api/mentor/summarize) dan dikirim sebagai `summary` agar AI tetap ingat tanpa
// mengirim seluruh riwayat tiap kali.

const SUMMARIZE_AFTER = 100; // mulai meringkas saat riwayat melewati 100 pesan
const SUMMARIZE_EVERY = 16;  // lalu ringkas ulang tiap +16 pesan (~8 tanya-jawab)

function keyFor(email) { return `kkni-mentor-chat:${email || "anon"}`; }

function load(k) {
  try {
    const s = JSON.parse(localStorage.getItem(k) || "");
    if (s && Array.isArray(s.messages)) return { messages: s.messages, summary: typeof s.summary === "string" ? s.summary : "" };
  } catch { /* corrupt/empty */ }
  return { messages: [], summary: "" };
}

// fetch ber-auth (Bearer token dari store) — pakai fetch mentah agar status HTTP (mis. 503) terbaca.
async function postJson(url, body) {
  const token = useAuthStore.getState().token;
  const r = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: JSON.stringify(body),
  });
  let data = {};
  try { data = await r.json(); } catch { /* non-json */ }
  return { ok: r.ok, status: r.status, data };
}

export function useMentorChat() {
  const user = useAuthStore((s) => s.user);
  const k = keyFor(user?.email);
  const kRef = useRef(k);
  const [messages, setMessages] = useState(() => load(k).messages);
  const [busy, setBusy] = useState(false);
  const summaryRef = useRef(load(k).summary);
  const lastSummarizedLen = useRef(load(k).messages.length);

  // Akun berganti → muat store milik akun itu.
  useEffect(() => {
    if (kRef.current !== k) {
      kRef.current = k;
      const s = load(k);
      setMessages(s.messages); summaryRef.current = s.summary; lastSummarizedLen.current = s.messages.length;
    }
  }, [k]);

  const persist = useCallback((msgs, summary) => {
    try { localStorage.setItem(kRef.current, JSON.stringify({ messages: msgs, summary })); } catch { /* quota */ }
  }, []);

  const summarize = useCallback(async (all) => {
    lastSummarizedLen.current = all.length;
    try {
      const { ok, data } = await postJson("/api/mentor/summarize", { messages: all.slice(0, -10), prevSummary: summaryRef.current });
      if (ok && typeof data.summary === "string" && data.summary.trim()) {
        summaryRef.current = data.summary.trim();
        persist(all, summaryRef.current);
      }
    } catch { /* ringkas gagal → tetap pakai ringkasan lama */ }
  }, [persist]);

  const send = useCallback(async (text, context) => {
    const q = (text || "").trim();
    if (!q || busy) return;
    const next = [...messages, { role: "user", content: q }];
    setMessages(next); persist(next, summaryRef.current); setBusy(true);
    try {
      const { ok, status, data } = await postJson("/api/mentor/chat", {
        messages: next.slice(-10), summary: summaryRef.current, context,
      });
      const reply = ok ? (data.reply || "(tidak ada jawaban)")
        : status === 503 ? "Maaf, AI Mentor belum aktif (OPENROUTER_API_KEY belum diset di .env). Hubungi admin."
          : (data.error || "Maaf, terjadi gangguan. Coba lagi sebentar lagi.");
      const after = [...next, { role: "assistant", content: reply }];
      setMessages(after); persist(after, summaryRef.current);
      if (after.length > SUMMARIZE_AFTER && after.length - lastSummarizedLen.current >= SUMMARIZE_EVERY) {
        summarize(after);
      }
    } catch {
      const after = [...next, { role: "assistant", content: "Gagal menghubungi server. Periksa koneksi Anda." }];
      setMessages(after); persist(after, summaryRef.current);
    } finally { setBusy(false); }
  }, [busy, messages, persist, summarize]);

  const clear = useCallback(() => {
    setMessages([]); summaryRef.current = ""; lastSummarizedLen.current = 0; persist([], "");
  }, [persist]);

  return { messages, busy, send, clear };
}
