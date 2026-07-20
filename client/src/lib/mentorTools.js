// ── Library alat AI Mentor (Onyen) ────────────────────────────────────────────
// Onyen tidak lagi menulis rute mentah ("buka /app/skill-gap") sebagai teks. Ia
// menyisipkan tag alat, lalu klien mengubahnya jadi tombol pintasan & kartu data.
//   [BUKA:kunci]  → tombol yang langsung membuka fitur
//   [DATA:kunci]  → kartu data milik pengguna yang tampil di dalam percakapan
// Daftar di bawah ini adalah SATU-SATUNYA sumber kebenaran. Kalau menambah kunci
// baru, ikut perbarui daftar alat di server/routes/mentor.js (dua bahasa) supaya
// Onyen tahu alat itu ada - tag yang tak dikenal dibuang diam-diam, bukan error.

export const MENTOR_ACTIONS = {
  dashboard:    { route: "/app/dashboard",     label: "Dashboard" },
  cv:           { route: "/app/cv-upload",     label: "Upload CV" },
  penempatan:   { route: "/app/placement",     label: "Tes Penempatan" },
  latihan:      { route: "/app/exam",          label: "Latihan Unit" },
  ujian:        { route: "/app/final-exam",    label: "Ujian Kompetensi Utama" },
  skillgap:     { route: "/app/skill-gap",     label: "Skill Gap Analyzer" },
  learningpath: { route: "/app/learning-path", label: "Learning Path" },
  kelas:        { route: "/app/kelas",         label: "Kelas Saya" },
  toko:         { route: "/app/toko",          label: "Toko & Kelas" },
  peta:         { route: "/app/jobs",          label: "Peta Posisi & Kesiapan" },
  profil:       { route: "/app/profile",       label: "Profil & Tangga Rank" },
};

export const MENTOR_WIDGETS = ["rank", "skillgap", "kesiapan", "progres"];

// Batas aman: satu jawaban tidak boleh berubah jadi dinding tombol.
const MAX_ACTIONS = 3;
const MAX_WIDGETS = 2;

const TOOL_RE = /\[\s*(BUKA|DATA|OPEN|SHOW)\s*:\s*([a-zA-Z_-]+)\s*\]/gi;

// Model kerap tetap menulis alamat halaman sebagai teks ("di fitur Upload CV (/app/cv-upload)")
// walau sudah dilarang. Alamat itu jargon bagi pengguna, jadi dibuang dari kalimat dan
// diubah jadi tombol - niatnya memang mengarahkan ke fitur.
// Kata depan sebelum alamat ikut dibuang, kalau tidak kalimatnya tertinggal menggantung
// ("Buka Skill Gap-mu di.").
const ROUTE_RE = /\s*(?:\b(?:di|ke|pada|lewat|at|in|on|via)\b)?\s*[([]?\s*(?:https?:\/\/[^\s)\]]*)?\/app\/[a-z-]+\/?\s*[)\]]?/gi;
const ROUTE_TO_KEY = Object.fromEntries(
  Object.entries(MENTOR_ACTIONS).map(([key, a]) => [a.route, key]),
);

// Pisahkan tag alat dari teks yang dibacakan. Tag dibuang dari teks apa pun
// hasilnya, jadi kunci yang salah tulis tidak pernah bocor ke gelembung chat.
export function extractTools(raw = "") {
  const actions = [];
  const widgets = [];
  const clean = String(raw)
    .replace(TOOL_RE, (_, kind, name) => {
      const key = name.toLowerCase().replace(/[_-]/g, "");
      const isData = /^(data|show)$/i.test(kind);
      if (isData) {
        if (MENTOR_WIDGETS.includes(key) && !widgets.includes(key)) widgets.push(key);
      } else if (MENTOR_ACTIONS[key] && !actions.includes(key)) {
        actions.push(key);
      }
      return " ";
    })
    .replace(ROUTE_RE, (m) => {
      const path = "/app/" + m.replace(/.*\/app\//i, "").replace(/[^a-z-].*$/i, "");
      const key = ROUTE_TO_KEY[path];
      if (key && !actions.includes(key)) actions.push(key);
      return " "; // sisakan satu spasi - polanya ikut menelan spasi di kedua sisi
    });
  // Rapikan spasi sisa tag, tapi JANGAN sentuh baris baru - pemecah kalimat
  // parseDialog masih memakainya.
  const text = clean.replace(/[ \t]{2,}/g, " ").replace(/[ \t]+([.,!?])/g, "$1").trim();

  // Model bahasa kadang lupa menulis tag walau sudah diminta. Yang tidak disebut secara
  // eksplisit ditebak dari isi jawaban - lebih baik tombolnya tetap muncul daripada
  // pengguna disuruh mencari fitur sendiri. Tag & rute eksplisit selalu menang.
  const guess = actions.length && widgets.length ? { actions: [], widgets: [] } : inferTools(text);
  return {
    text,
    actions: (actions.length ? actions : guess.actions).slice(0, MAX_ACTIONS),
    widgets: (widgets.length ? widgets : guess.widgets).slice(0, MAX_WIDGETS),
  };
}

// ── Tebakan alat dari isi jawaban (cadangan) ─────────────────────────────────
// Pola ID + EN. Sengaja ketat: lebih baik tidak memunculkan tombol daripada
// memunculkan tombol yang salah.
const ACTION_HINTS = [
  ["penempatan",   /tes penempatan|placement test/i],
  ["ujian",        /ujian kompetensi|ujian utama|competency exam|main exam|sertifikasi/i],
  ["latihan",      /latihan unit|unit practice|latihan soal|ujian ulang|retake/i],
  ["skillgap",     /skill ?gap|gap analyzer|analisis gap/i],
  ["learningpath", /learning path|jalur belajar/i],
  ["kelas",        /\bkelas\b|\bkursus\b|\bclasses\b|\bcourse/i],
  ["cv",           /(unggah|upload|lengkapi)\w*\s+cv|cv-?mu|your cv/i],
  ["peta",         /peta posisi|role map|peta karier/i],
  ["profil",       /tangga rank|rank ladder|profil-?mu|your profile/i],
  ["toko",         /\btoko\b|\bshop\b/i],
  ["dashboard",    /\bdashboard\b/i],
];

const WIDGET_HINTS = [
  ["skillgap", /gap/i],
  ["rank",     /skill rank|bronze|silver|gold|platinum|emerald|diamond|grandmaster|legend|\btier\b/i],
  ["kesiapan", /kesiapan|readiness/i],
  ["progres",  /unit (yang )?(sudah )?(kamu )?(dikuasai|kuasai|lulus)|sertifikat|certificate/i],
];

// Jawaban pendek (sapaan, basa-basi) tidak diberi alat - itu justru mengganggu.
const MIN_CHARS = 90;

function inferTools(text = "") {
  if (text.length < MIN_CHARS) return { actions: [], widgets: [] };

  const actions = ACTION_HINTS
    .map(([key, re]) => [key, text.search(re)])
    .filter(([, at]) => at >= 0)
    .sort((a, b) => a[1] - b[1])
    .slice(0, MAX_ACTIONS)
    .map(([key]) => key);

  // Satu kartu data saja di mode tebakan - yang paling awal disinggung.
  const hasNumber = /\d+\s?%/.test(text);
  const widget = WIDGET_HINTS
    .map(([key, re]) => [key, text.search(re)])
    .filter(([key, at]) => at >= 0 && (key !== "skillgap" || hasNumber))
    .sort((a, b) => a[1] - b[1])[0];

  return { actions, widgets: widget ? [widget[0]] : [] };
}
