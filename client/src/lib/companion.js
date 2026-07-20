import { useEffect, useRef, useState } from "react";
import { extractTools } from "./mentorTools.js";

// ── Helper bersama AI Companion "Onyen" (#14/#15) ─────────────────────────────
// Dipakai CompanionAvatar (avatar kecil kiri-bawah) & halaman Mentor (bust besar kanan).
// Aset di client/public/companion/: <emosi>.png (badan penuh 283×360) + bust_<emosi>.png
// (setengah badan 500×414) + varian *_blink (kecuali happy - tak punya blink).

export const EMOTIONS = ["neutral", "happy", "sadness", "surprised", "fear", "anger", "disgust"];
export const HAS_BLINK = new Set(["neutral", "sadness", "surprised", "fear", "anger", "disgust"]);

export const IMG = (emotion, blink) =>
  `/companion/${emotion}${blink && HAS_BLINK.has(emotion) ? "_blink" : ""}.png`;
export const BUST = (emotion, blink) =>
  `/companion/bust_${emotion}${blink && HAS_BLINK.has(emotion) ? "_blink" : ""}.png`;

// Preload seluruh pose (hindari kedip putih saat ganti ekspresi). bust=true ikut memuat bust_*.
export function preloadCompanion(bust = false) {
  EMOTIONS.forEach((e) => {
    new Image().src = IMG(e, false);
    if (HAS_BLINK.has(e)) new Image().src = IMG(e, true);
    if (bust) {
      new Image().src = BUST(e, false);
      if (HAS_BLINK.has(e)) new Image().src = BUST(e, true);
    }
  });
}

// Reaksi ekspresi dari isi percakapan (heuristik ringan ID+EN): hitung sinyal positif vs
// negatif, pilih yang dominan. Dipakai agar Onyen "ikut bereaksi" terhadap jawaban AI.
const RE_HAPPY = /(selamat|bagus|hebat|mantap|keren|luar biasa|berhasil|lulus|naik rank|di jalur yang tepat|siap naik|great|congrat|well done|passed|good job|on track)/gi;
const RE_SAD   = /(belum|kurang|gap|gagal|maaf|sayangnya|perlu ditingkatkan|belum siap|not ready|missing|failed|sorry|unfortunately)/gi;
const RE_FEAR  = /(hati-hati|risiko|jangan sampai|awas|careful|risk|warning)/gi;
export function emotionForText(s = "") {
  const happy = (s.match(RE_HAPPY) || []).length;
  const sad = (s.match(RE_SAD) || []).length;
  if ((s.match(RE_FEAR) || []).length > happy && (s.match(RE_FEAR) || []).length > sad) return "fear";
  if (happy === 0 && sad === 0) return "neutral";
  return happy >= sad ? "happy" : "sadness";
}

// ── Dialog VN: tag [EMOSI] + pemecah kalimat (pola breakdown_ai_text proyek MBTI Game) ──
// AI Mentor (persona Onyen) menyisipkan tag [EMOSI] di tiap perubahan nada. Di sini teks
// dipecah per kalimat (titik/seru/tanya; elipsis TIDAK memecah; pecah sebelum tag "[") lalu
// dikelompokkan jadi segmen ber-emosi → ditampilkan bergiliran + ekspresi avatar berganti.
const TAG_EMO = {
  happy: "happy", joy: "happy", glad: "happy",
  sad: "sadness", sadness: "sadness", cry: "sadness", gloom: "sadness",
  angry: "anger", anger: "anger", mad: "anger",
  fear: "fear", worried: "fear", anxious: "fear", scared: "fear", terror: "fear",
  surprise: "surprised", surprised: "surprised", shock: "surprised", wow: "surprised",
  disgust: "disgust", disgusted: "disgust", ewh: "disgust",
  neutral: "neutral",
};

export function stripEmotionTags(text = "") {
  return text.replace(/\[[^\]]*\]/g, " ").replace(/\s+/g, " ").trim();
}

// → [{ emotion, text }] : emosi menempel sampai tag berikutnya; segmen baru saat emosi
// berganti / sudah 2 kalimat / terlalu panjang. Tanpa tag sama sekali → 1 segmen dengan
// emosi hasil heuristik (riwayat lama tetap tampil normal).
export function parseDialog(text = "") {
  // Buang tag alat ([BUKA:…]/[DATA:…]) lebih dulu - itu urusan MentorTools, bukan dialog.
  // Dilakukan DI SINI supaya jumlah segmen selalu sama dgn yang dipakai useVnReveal.
  text = extractTools(text).text;
  const hasTag = /\[[a-z]+\]/i.test(text);
  if (!hasTag) {
    const clean = text.trim();
    return clean ? [{ emotion: emotionForText(clean), text: clean }] : [];
  }
  // Pecah per baris → sebelum tag "[" → akhir kalimat (pertahankan tanda baca; "..." tidak memecah).
  const parts = [];
  for (const line of text.split(/\r?\n/)) {
    const l = line.trim().replace(/^"|"$/g, "").trim();
    if (!l) continue;
    // `(?<!\d\.)` menjaga penanda daftar ("… berikut: 1. Periksa CV") tetap menyatu -
    // tanpa itu angkanya tertinggal sendirian di ujung gelembung sebelumnya.
    for (const p of l.split(/(?<=[.!?])(?<!\.\.\.)(?<!\d\.)"?\s+|(?=\[)/)) {
      const s = p.trim().replace(/^"|"$/g, "").trim();
      if (s) parts.push(s);
    }
  }
  const segs = [];
  let emo = "neutral";
  for (let part of parts) {
    const m = part.match(/^\[([^\]]*)\]\s*/);
    if (m) {
      const key = m[1].toLowerCase().replace(/[^a-z]/g, "");
      emo = TAG_EMO[key] || emo;
      part = part.slice(m[0].length).trim();
      if (!part) continue;
    }
    const last = segs[segs.length - 1];
    if (last && last.emotion === emo && last.sentences < 2 && last.text.length + part.length < 160) {
      last.text += " " + part;
      last.sentences += 1;
    } else {
      segs.push({ emotion: emo, text: part, sentences: 1 });
    }
  }
  return segs.map(({ emotion, text: s }) => ({ emotion, text: s }));
}

// Reveal bergiliran ala textbox VN: pesan assistant TERBARU (yang datang setelah mount)
// dipecah jadi segmen & dimunculkan satu-satu; tiap segmen memicu onEmotion(emosi).
// Riwayat lama tampil langsung penuh (tanpa animasi). Return { idx, count }.
export function useVnReveal(messages, onEmotion) {
  const [revealed, setRevealed] = useState({ idx: -1, count: Infinity });
  const baseline = useRef(null);
  const emoRef = useRef(onEmotion);
  emoRef.current = onEmotion;

  useEffect(() => {
    if (baseline.current === null) baseline.current = messages.length;
    const idx = messages.length - 1;
    const last = messages[idx];
    if (!last || last.role !== "assistant" || idx < baseline.current) return;
    const segs = parseDialog(last.content);
    if (!segs.length) return;
    let i = 0;
    let alive = true;
    let timer;
    const step = () => {
      if (!alive || i >= segs.length) return;
      const seg = segs[i];
      i += 1;
      setRevealed({ idx, count: i });
      emoRef.current?.(seg.emotion);
      // Jeda ala pacing VN: proporsional panjang kalimat supaya sempat DIBACA, bukan
      // sekadar muncul. ~38 ms/karakter mendekati kecepatan baca santai; dibatasi 5,2 dtk
      // agar kalimat panjang tak terasa menggantung.
      timer = setTimeout(step, Math.min(5200, 900 + seg.text.length * 38));
    };
    step();
    return () => { alive = false; clearTimeout(timer); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [messages.length]);

  return revealed;
}

// Kedip idle ala Renpy: tiap 3–5.5 dtk mata tertutup ±150 ms (variasi tanpa Math.random).
export function useBlink(active = true) {
  const [blink, setBlink] = useState(false);
  useEffect(() => {
    if (!active) return;
    let alive = true;
    let timer;
    const loop = (delay) => {
      timer = setTimeout(() => {
        if (!alive) return;
        setBlink(true);
        setTimeout(() => alive && setBlink(false), 150);
        loop(3000 + ((Date.now() / 1000) % 1) * 2500);
      }, delay);
    };
    loop(2600);
    return () => { alive = false; clearTimeout(timer); };
  }, [active]);
  return blink;
}
