// Integrasi API resmi SKKNI Kemnaker (data kompetensi pure, jadi acuan semua perhitungan).
//
// KENDALA UTAMA: endpoint publik `https://skkni-api.kemnaker.go.id/v1/public/*` dibatasi
// ~1 request / 60 detik PER-IP (nginx/Laravel throttle; balasan 429 + header Retry-After).
// Karena SERVER kita yang menembak API (bukan browser tiap user), semua user berbagi SATU IP.
// Maka strateginya: TARIK SEKALI → SIMPAN PERMANEN (cache di DB), lalu semua user dilayani
// dari cache lokal. Hanya cache-miss (kompetensi yang belum pernah ditarik) yang menembak API,
// itu pun lewat antrean throttle di bawah ini.
//
// Bentuk data yang dipakai:
//   GET /documents?page=N        → daftar dokumen SKKNI (50/hal, 25 hal ≈ 1.250 dok) → katalog
//   GET /documents/{id}          → detail dokumen + array `units` (unit kompetensi = "skill")
import { prisma } from "./prisma.js";
import { chatComplete } from "./llm.js";

const BASE = "https://skkni-api.kemnaker.go.id/v1/public";
const MIN_GAP_MS = 70_000;   // jarak minimal antar request keluar (window per-IP nyatanya > 60dtk)
const MAX_RETRIES = 4;
const CATALOG_KEY = "skkni_catalog"; // AppSetting penanda progres sinkron katalog

export class SkkniError extends Error {
  constructor(message, status = 502) { super(message); this.name = "SkkniError"; this.status = status; }
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ── Throttle: serialisasi + jaga jarak semua request keluar, patuhi Retry-After ──
let lastRequestAt = 0;
let chain = Promise.resolve();

async function kemnaker(path) {
  const run = chain.then(async () => {
    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
      const wait = MIN_GAP_MS - (Date.now() - lastRequestAt);
      if (wait > 0) await sleep(wait);
      lastRequestAt = Date.now();

      let res;
      try {
        res = await fetch(`${BASE}${path}`, {
          headers: { Accept: "application/json" },
          signal: AbortSignal.timeout(30_000),
        });
      } catch (e) {
        if (attempt === MAX_RETRIES) throw new SkkniError(`Gagal menghubungi server Kemnaker: ${e.message}`, 502);
        await sleep(5_000);
        continue;
      }

      if (res.status === 429) {
        const ra = parseInt(res.headers.get("retry-after") || "60", 10);
        if (attempt === MAX_RETRIES) throw new SkkniError("Server SKKNI Kemnaker sedang membatasi permintaan. Coba lagi sebentar.", 429);
        await sleep((ra + 3) * 1_000);
        continue;
      }
      if (!res.ok) throw new SkkniError(`Kemnaker HTTP ${res.status}`, 502);
      return res.json();
    }
  });
  // Jangan biarkan satu error memutus rantai untuk request berikutnya.
  chain = run.then(() => {}, () => {});
  return run;
}

// ── Pemetaan bentuk ──────────────────────────────────────────────────────────
function yearOf(d) {
  const m = String(d.number_kepmen || d.published_at || "").match(/\b(19|20)\d{2}\b/);
  return m ? m[0] : null;
}
function mapDoc(d) {
  return {
    id: d.id,
    title: d.title || d.sector || "(tanpa judul)",
    sector: d.sector || null,
    number: d.number != null ? String(d.number) : null,
    year: yearOf(d),
    numberKepmen: d.number_kepmen || null,
    availability: d.availability || "applied",
  };
}

// ── Katalog: sinkron daftar dokumen (satu kali, throttled, resumable) ─────────
async function upsertDocs(docs) {
  for (const raw of docs) {
    const d = mapDoc(raw);
    await prisma.skkniDocument.upsert({
      where: { id: d.id },
      create: d,
      update: { title: d.title, sector: d.sector, number: d.number, year: d.year, numberKepmen: d.numberKepmen, availability: d.availability },
    });
  }
}

export async function getCatalogStatus() {
  const [count, marker] = await Promise.all([
    prisma.skkniDocument.count(),
    prisma.appSetting.findUnique({ where: { key: CATALOG_KEY } }),
  ]);
  let meta = {};
  try { meta = marker ? JSON.parse(marker.value) : {}; } catch { /* ignore */ }
  return { count, ...meta };
}

async function setCatalogStatus(patch) {
  const cur = await getCatalogStatus();
  const value = JSON.stringify({ lastPage: cur.lastPage || 0, totalPages: cur.totalPages || null, running: false, ...patch });
  await prisma.appSetting.upsert({ where: { key: CATALOG_KEY }, create: { key: CATALOG_KEY, value }, update: { value } });
}

let catalogRunning = false;
// Tarik seluruh katalog halaman demi halaman. Idempoten & bisa dilanjutkan dari lastPage.
export async function syncCatalog({ fromPage } = {}) {
  if (catalogRunning) return { alreadyRunning: true };
  catalogRunning = true;
  try {
    const status = await getCatalogStatus();
    let page = fromPage || (status.lastPage ? status.lastPage + 1 : 1);
    let totalPages = status.totalPages || null;
    await setCatalogStatus({ running: true });
    for (;;) {
      const j = await kemnaker(`/documents?page=${page}`);
      const docs = j.data || [];
      await upsertDocs(docs);
      totalPages = j.meta?.pagination?.last_page || totalPages;
      await setCatalogStatus({ lastPage: page, totalPages, running: true });
      if (!j.links?.next || (totalPages && page >= totalPages) || docs.length === 0) break;
      page += 1;
    }
    await setCatalogStatus({ running: false, completedAt: new Date().toISOString() });
    return { done: true, lastPage: page, totalPages };
  } catch (e) {
    await setCatalogStatus({ running: false, lastError: e.message });
    throw e;
  } finally {
    catalogRunning = false;
  }
}

// Kick sinkron katalog di latar belakang bila belum selesai (dipanggil saat server start).
// Catatan: JANGAN gate pada flag `running` yang tersimpan — flag itu bisa "stale=true"
// bila proses sebelumnya dimatikan di tengah sinkron. Guard anti-dobel pakai `catalogRunning`
// (in-memory) di dalam syncCatalog().
export function kickCatalogSyncIfEmpty() {
  getCatalogStatus()
    .then((s) => {
      if (!s.completedAt) syncCatalog().catch((e) => console.warn("[skkni] catalog sync:", e.message));
    })
    .catch(() => {});
}

// ── Unit kompetensi: tarik detail 1 dokumen (embed `units`) & simpan ──────────
export async function ingestUnits(docId) {
  const j = await kemnaker(`/documents/${docId}`);
  const d = j.data || j;
  if (!d || !d.id) throw new SkkniError("Dokumen SKKNI tidak ditemukan di Kemnaker.", 404);

  // Pastikan header dokumen tersimpan (kalau katalog belum menyentuh halaman ini).
  await upsertDocs([d]);

  const units = Array.isArray(d.units) ? d.units : [];
  await prisma.skkniUnit.deleteMany({ where: { documentId: d.id } });
  if (units.length) {
    await prisma.skkniUnit.createMany({
      data: units.map((u) => ({
        documentId: d.id,
        code: u.code || "",
        title: (u.title || "").trim(),
        availability: u.availability || "applied",
      })),
    });
  }
  await prisma.skkniDocument.update({
    where: { id: d.id },
    data: { unitsCached: true, unitCount: units.length, unitsFetchedAt: new Date() },
  });
  return getDocWithUnits(d.id);
}

// Ambil dokumen + unit dari cache; tarik dari Kemnaker hanya bila belum pernah di-cache.
export async function ensureUnits(docId) {
  const doc = await prisma.skkniDocument.findUnique({ where: { id: docId } });
  if (doc?.unitsCached) return getDocWithUnits(docId);
  return ingestUnits(docId);
}

export async function getDocWithUnits(docId) {
  const doc = await prisma.skkniDocument.findUnique({
    where: { id: docId },
    include: { units: { orderBy: { code: "asc" } } },
  });
  if (!doc) return null;
  return {
    id: doc.id, title: doc.title, sector: doc.sector, number: doc.number, year: doc.year,
    numberKepmen: doc.numberKepmen, availability: doc.availability,
    unitsCached: doc.unitsCached, unitCount: doc.unitCount, unitsFetchedAt: doc.unitsFetchedAt,
    units: doc.units.map((u) => ({ code: u.code, title: u.title, availability: u.availability })),
  };
}

// ── Kategori umum & pembersihan nama (agar mudah dipilih user) ────────────────
// Dokumen "Perubahan …"/"Pencabutan …" = surat amandemen/pencabutan (bukan kompetensi
// yang bisa dipilih) → disembunyikan. Sisanya dikelompokkan ke kategori umum via kata kunci
// (urutan penting: yang lebih spesifik didahulukan).
const CATEGORIES = [
  { key: "ti", label: "Teknologi Informasi", kw: ["informatika", "komputer", "jaringan", "perangkat lunak", "software", "pemrograman", "aplikasi", "teknologi informasi", "siber", "cyber", "basis data", "database", "cloud", "kecerdasan buatan", "data science", "devops", "audit teknologi"] },
  { key: "kreatif", label: "Seni, Kreatif & Media", kw: ["video", "film", "desain", "grafis", "fotografi", "foto", "musik", "seni", "kriya", "penyiaran", "siaran", "broadcast", "jurnalis", "pers", "periklanan", "iklan", "editing", "animasi", "multimedia", "konten", "kerajinan", "batik", "tari", "teater", "budaya", "warisan", "museum", "perfilman"] },
  { key: "keselamatan", label: "K3 & Lingkungan", kw: ["keselamatan dan kesehatan kerja", "keselamatan kerja", "k3", "hiperkes", "damkar", "pemadam kebakaran", "lingkungan", "limbah", "sanitasi", "persampahan", "amdal"] },
  { key: "kesehatan", label: "Kesehatan & Farmasi", kw: ["kesehatan", "medis", "keperawatan", "perawat gigi", "bidan", "kebidanan", "farmasi", "apoteker", "gizi", "nutrisi", "careworker", "caregiver", "lansia", "dokter", "rumah sakit", "klinik", "radiologi", "fisioterapi", "kefarmasian"] },
  { key: "konstruksi", label: "Konstruksi & Bangunan", kw: ["konstruksi", "bangunan", "sipil", "arsitek", "jalan", "jembatan", "beton", "plumbing", "gedung", "struktur", "quantity surveyor", "interior", "pengaspalan", "irigasi", "bendungan", "perumahan"] },
  { key: "pariwisata", label: "Pariwisata, Boga & Kecantikan", kw: ["pariwisata", "hotel", "perhotelan", "kuliner", "boga", "restoran", "wisata", "spa", "kecantikan", "tata rias", "salon", "housekeeping", "pastry", "barista", "mice", "tour", "perjalanan", "hospitality"] },
  { key: "manufaktur", label: "Manufaktur & Otomotif", kw: ["otomotif", "mesin", "logam", "manufaktur", "pengelasan", "las", "welding", "mekanik", "kendaraan", "alat berat", "industri", "fabrikasi", "cnc", "permesinan", "sepeda motor", "perkakas", "pengecoran", "tekstil", "garmen", "furnitur", "mebel"] },
  { key: "listrik", label: "Kelistrikan & Elektronika", kw: ["listrik", "elektro", "elektronika", "ketenagalistrikan", "tenaga listrik", "pembangkit", "gardu", "otomasi", "mekatronika", "telekomunikasi", "instrumentasi", "kelistrikan"] },
  { key: "energi", label: "Energi & Pertambangan", kw: ["migas", "minyak dan gas", "minyak bumi", "tambang", "pertambangan", "energi", "geologi", "panas bumi", "batubara", "pengeboran", "eksplorasi", "sumur", "coiled tubing", "geofisika", "geospasial", "surveyor"] },
  { key: "agri", label: "Pertanian, Perikanan & Kehutanan", kw: ["pertanian", "perkebunan", "tanaman", "ternak", "peternakan", "perikanan", "ikan", "budidaya", "kehutanan", "hutan", "agribisnis", "hortikultura", "pangan", "nelayan", "akuakultur", "pembenihan", "karang", "pembibitan", "sawit"] },
  { key: "logistik", label: "Logistik & Transportasi", kw: ["logistik", "transportasi", "pelayaran", "penerbangan", "maritim", "gudang", "rantai pasok", "supply chain", "kurir", "pengiriman", "kepelabuhanan", "pelabuhan", "bandara", "kereta", "angkutan", "warehouse", "forwarding", "nautika"] },
  { key: "keuangan", label: "Keuangan & Bisnis", kw: ["keuangan", "akuntansi", "akuntan", "perbankan", "pajak", "perpajakan", "asuransi", "bisnis", "manajemen", "pemasaran", "penjualan", "marketing", "sales", "investasi", "koperasi", "ritel", "kewirausahaan", "ekspor", "impor", "e-commerce"] },
  { key: "administrasi", label: "Administrasi & SDM", kw: ["administrasi", "sekretaris", "perkantoran", "kearsipan", "arsip", "sumber daya manusia", "personalia", "human capital", "sekretariat", "standardisasi", "sertifikasi", "pelatihan", "manajemen mutu"] },
  { key: "layanan", label: "Jasa, Sosial & Pemerintahan", kw: ["sosial", "hukum", "paralegal", "notaris", "pemerintahan", "pelayanan publik", "kependudukan", "keamanan", "satpam", "pengamanan", "diplomasi", "imigrasi", "pekerja sosial", "layanan", "customer"] },
];
const FALLBACK_CAT = { key: "lainnya", label: "Lainnya" };

// Cocokkan per KATA UTUH (\b) agar tak salah tangkap substring — mis. "bidang" ≠ "bidan",
// "perawatan bangunan" ≠ "perawat". Precompile sekali (dipakai berulang atas 1234 dok).
const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const CAT_RE = CATEGORIES.map((c) => ({ key: c.key, label: c.label, res: c.kw.map((k) => new RegExp(`\\b${esc(k)}\\b`, "i")) }));

function categorize(title, sector) {
  const hay = `${title || ""} ${sector || ""}`;
  for (const c of CAT_RE) if (c.res.some((re) => re.test(hay))) return { key: c.key, label: c.label };
  return FALLBACK_CAT;
}
// Nama tampilan yang bersih (buang prefiks "SKKNI").
function cleanTitle(title) {
  return (title || "").replace(/^SKKNI\s+/i, "").trim() || "(tanpa judul)";
}
// Filter dokumen yang layak dipilih user (bukan perubahan/pencabutan/tanpa-judul).
function selectableWhere(query) {
  const nots = [
    { NOT: { title: { startsWith: "Perubahan" } } },
    { NOT: { title: { startsWith: "Pencabutan" } } },
    { NOT: { title: "(tanpa judul)" } },
  ];
  if (query) nots.push({ OR: [{ title: { contains: query } }, { sector: { contains: query } }, { numberKepmen: { contains: query } }] });
  return { AND: nots };
}

// Daftar kategori + jumlah kompetensi (untuk chip filter di UI).
export async function listCategories() {
  const rows = await prisma.skkniDocument.findMany({ where: selectableWhere(""), select: { title: true, sector: true } });
  const counts = {};
  for (const d of rows) {
    const c = categorize(d.title, d.sector);
    (counts[c.key] ??= { key: c.key, label: c.label, count: 0 }).count++;
  }
  // Urut jumlah terbanyak, tapi "Lainnya" (catch-all) selalu di akhir.
  return Object.values(counts).sort((a, b) => {
    if (a.key === "lainnya") return 1;
    if (b.key === "lainnya") return -1;
    return b.count - a.count;
  });
}

// ── Pencarian lokal (dari katalog yang sudah tersinkron) ─────────────────────
// Paginasi (offset/limit) untuk infinite scroll. Kembalikan { items, total }.
export async function searchLocal(q, category, limit = 100, offset = 0) {
  const query = (q || "").trim();
  const rows = await prisma.skkniDocument.findMany({
    where: selectableWhere(query), orderBy: [{ unitsCached: "desc" }, { title: "asc" }],
  });
  let items = rows.map((d) => {
    const cat = categorize(d.title, d.sector);
    return {
      id: d.id, title: cleanTitle(d.title), category: cat.label, categoryKey: cat.key,
      numberKepmen: d.numberKepmen, year: d.year, unitsCached: d.unitsCached, unitCount: d.unitCount,
    };
  });
  if (category && category !== "all") items = items.filter((i) => i.categoryKey === category);
  const start = Math.max(0, offset | 0);
  return { items: items.slice(start, start + limit), total: items.length };
}

// ── Ujian kompetensi berbasis unit SKKNI (soal di-generate AI) ────────────────
export const EXAM_BATCH_UNITS = 6;   // (lama) jumlah unit per batch
export const COURSE_UNITS = 15;      // jumlah unit yang dicakup 1 "course"/paket ujian
const Q_PER_UNIT = 2;                // 2 soal/unit → skor per unit 0/50/100

// Pilih batch unit berikutnya untuk diuji: prioritas unit yang BELUM dinilai,
// lalu unit dengan skor terendah (untuk perbaikan). Hanya unit "applied".
export async function pickExamUnits(userId, docId, limit = EXAM_BATCH_UNITS) {
  const units = await prisma.skkniUnit.findMany({
    where: { documentId: docId, availability: "applied" }, orderBy: { code: "asc" },
  });
  if (!units.length) return [];
  const codes = units.map((u) => u.code);
  const assessments = await prisma.skillAssessment.findMany({ where: { userId, competencyCode: { in: codes } } });
  const scoreByCode = Object.fromEntries(assessments.map((a) => [a.competencyCode, a.currentScore]));
  const unassessed = units.filter((u) => scoreByCode[u.code] === undefined);
  const pool = unassessed.length
    ? unassessed
    : [...units].sort((a, b) => (scoreByCode[a.code] ?? 0) - (scoreByCode[b.code] ?? 0));
  return pool.slice(0, limit);
}

// Statistik cakupan penilaian unit untuk 1 dokumen.
export async function examCoverage(userId, docId) {
  const units = await prisma.skkniUnit.findMany({ where: { documentId: docId, availability: "applied" }, select: { code: true } });
  const codeSet = new Set(units.map((u) => u.code));
  const assessments = await prisma.skillAssessment.findMany({ where: { userId } });
  const relevant = assessments.filter((a) => codeSet.has(a.competencyCode));
  const passed = relevant.filter((a) => a.currentScore >= 60).length;
  return { total: codeSet.size, assessed: relevant.length, passed };
}

// ── Paket ujian ("course") per kompetensi: di-generate SEKALI, disimpan sebagai library ──
function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
}

export async function ensureExamPackage(docId, title) {
  const existing = await prisma.examPackage.findUnique({ where: { docId } });
  if (existing) return existing;
  const units = await prisma.skkniUnit.findMany({
    where: { documentId: docId, availability: "applied" }, orderBy: { code: "asc" }, take: COURSE_UNITS,
  });
  if (!units.length) return null;
  const questions = await generateUnitExam(title || "Kompetensi", units);
  if (!questions.length) return null;
  return prisma.examPackage.create({
    data: { docId, title: title || "Kompetensi", questions: JSON.stringify(questions), unitCount: units.length, questionCount: questions.length },
  });
}

// Buat instance ujian TERACAK dari paket: urutan soal diacak, opsi tiap soal diacak,
// answerKey menyesuaikan posisi baru. Tiap tes ulang → pengacakan berbeda.
export function buildShuffledInstance(pkg) {
  const base = JSON.parse(pkg.questions);
  return shuffle(base).map((q) => {
    const opts = q.options.map((text, idx) => ({ text, correct: idx === q.answerKey }));
    const s = shuffle(opts);
    return { unitCode: q.unitCode, unitTitle: q.unitTitle, q: q.q, options: s.map((o) => o.text), answerKey: s.findIndex((o) => o.correct) };
  });
}

// Cakupan penilaian relatif terhadap unit di dalam paket course.
export async function courseCoverage(userId, pkg) {
  const codes = new Set(JSON.parse(pkg.questions).map((q) => q.unitCode));
  const assess = await prisma.skillAssessment.findMany({ where: { userId } });
  const relevant = assess.filter((a) => codes.has(a.competencyCode));
  return { total: codes.size, assessed: relevant.length, passed: relevant.filter((a) => a.currentScore >= 60).length };
}

// Generate soal PG dari daftar unit (1 panggilan AI untuk seluruh batch).
export async function generateUnitExam(compTitle, units) {
  const titleByCode = Object.fromEntries(units.map((u) => [u.code, u.title]));
  const list = units.map((u, i) => `${i + 1}. [${u.code}] ${u.title}`).join("\n");
  const prompt =
    `Anda penyusun soal uji kompetensi berbasis SKKNI. Kompetensi/profesi: "${compTitle}".\n` +
    `Untuk SETIAP unit kompetensi di bawah, buat ${Q_PER_UNIT} soal pilihan ganda (Bahasa Indonesia) yang menguji ` +
    `pemahaman PRAKTIS unit tersebut (bukan pertanyaan umum). Unit:\n${list}\n` +
    `Aturan: tiap soal punya 4 opsi & satu jawaban benar (answerKey = indeks 0-3). ` +
    `Balas HANYA JSON array valid, total ${units.length * Q_PER_UNIT} soal: ` +
    `[{"unitCode":"<kode unit persis>","q":"...","options":["..","..","..",".."],"answerKey":0}]`;
  const r = await chatComplete([{ role: "user", content: prompt }], { temperature: 0.6, maxTokens: 320 * units.length + 400 });
  const text = r.content || "";
  const m = text.match(/\[[\s\S]*\]/);
  const arr = JSON.parse(m ? m[0] : text);
  const valid = new Set(units.map((u) => u.code));
  return arr
    .filter((q) => q && typeof q.q === "string" && Array.isArray(q.options) && q.options.length >= 2 && valid.has(q.unitCode))
    .map((q) => ({
      unitCode: q.unitCode,
      unitTitle: titleByCode[q.unitCode],
      q: q.q,
      options: q.options.slice(0, 4),
      answerKey: Math.max(0, Math.min(3, Number(q.answerKey) || 0)),
    }));
}

// ══ KELAS & UJIAN PER-UNIT ═══════════════════════════════════════════════════
// Tiap unit kompetensi punya: (1) materi kelas AI, (2) paket soal AI (jumlah variatif).
// Keduanya library global per (docId, unitCode) — di-generate sekali, dipakai ulang.

export const UNIT_Q_MIN = 4;    // jumlah soal minimum per unit
export const UNIT_Q_MAX = 8;    // maksimum (AI menyesuaikan kompleksitas unit di antara ini)

// Materi kelas 1 unit (AI): penjelasan ilmu + contoh kasus kerja + langkah praktik → JSON.
async function generateUnitCourseContent(compTitle, unit) {
  const prompt =
    `Anda instruktur vokasi berbasis SKKNI. Kompetensi/profesi: "${compTitle}". ` +
    `Susun MATERI KELAS singkat namun padat untuk SATU unit kompetensi: "${unit.title}" (kode ${unit.code}). ` +
    `Fokus pada ilmu praktis yang relevan dengan pekerjaan nyata. ` +
    `Balas HANYA JSON valid dengan bentuk PERSIS:\n` +
    `{"overview":"2-3 kalimat menjelaskan unit ini & mengapa penting di dunia kerja",` +
    `"keyPoints":["4-6 poin ilmu/konsep kunci yang harus dipahami"],` +
    `"caseExample":"1 contoh kasus/situasi nyata di tempat kerja yang menuntut unit ini",` +
    `"practiceSteps":["3-5 langkah praktik/latihan agar terampil"],` +
    `"estMinutes":<perkiraan menit belajar 15-60>}. Bahasa Indonesia.`;
  const r = await chatComplete([{ role: "user", content: prompt }], { temperature: 0.5, maxTokens: 900 });
  const text = r.content || "";
  const m = text.match(/\{[\s\S]*\}/);
  const o = JSON.parse(m ? m[0] : text);
  return {
    overview: String(o.overview || "").slice(0, 800),
    keyPoints: Array.isArray(o.keyPoints) ? o.keyPoints.slice(0, 6).map((x) => String(x).slice(0, 200)) : [],
    caseExample: String(o.caseExample || "").slice(0, 800),
    practiceSteps: Array.isArray(o.practiceSteps) ? o.practiceSteps.slice(0, 5).map((x) => String(x).slice(0, 200)) : [],
    estMinutes: Math.max(10, Math.min(90, Number(o.estMinutes) || 30)),
  };
}

// Ambil/generate materi kelas 1 unit (cache di UnitCourse). Butuh LLM aktif untuk generate.
export async function ensureUnitCourse(docId, unit) {
  const existing = await prisma.unitCourse.findUnique({ where: { docId_unitCode: { docId, unitCode: unit.code } } });
  if (existing) return existing;
  const doc = await prisma.skkniDocument.findUnique({ where: { id: docId }, select: { title: true } });
  const content = await generateUnitCourseContent(doc?.title || "Kompetensi", unit);
  return prisma.unitCourse.create({
    data: { docId, unitCode: unit.code, unitTitle: unit.title, content: JSON.stringify(content) },
  });
}

// Soal PG untuk SATU unit — jumlah VARIATIF (UNIT_Q_MIN..UNIT_Q_MAX) sesuai keluasan unit,
// berbasis kasus kerja nyata (bukan pertanyaan umum).
async function generateSingleUnitExam(compTitle, unit) {
  const prompt =
    `Anda penyusun uji kompetensi berbasis SKKNI. Kompetensi/profesi: "${compTitle}". ` +
    `Buat soal pilihan ganda untuk MENGUJI penguasaan SATU unit: "${unit.title}" (kode ${unit.code}). ` +
    `Jumlah soal MENYESUAIKAN keluasan unit: antara ${UNIT_Q_MIN} sampai ${UNIT_Q_MAX} soal ` +
    `(unit sederhana lebih sedikit, unit kompleks lebih banyak). ` +
    `Soal harus SPESIFIK & berbasis KASUS/PRAKTIK di tempat kerja nyata, bukan definisi umum. ` +
    `Tiap soal: 4 opsi, satu benar (answerKey indeks 0-3). ` +
    `Balas HANYA JSON array valid: [{"q":"...","options":["..","..","..",".."],"answerKey":0}]`;
  const r = await chatComplete([{ role: "user", content: prompt }], { temperature: 0.6, maxTokens: 320 * UNIT_Q_MAX + 400 });
  const text = r.content || "";
  const m = text.match(/\[[\s\S]*\]/);
  const arr = JSON.parse(m ? m[0] : text);
  const cleaned = arr
    .filter((q) => q && typeof q.q === "string" && Array.isArray(q.options) && q.options.length >= 2)
    .map((q) => ({ q: q.q, options: q.options.slice(0, 4), answerKey: Math.max(0, Math.min(3, Number(q.answerKey) || 0)) }));
  // Klamp jumlah ke rentang wajar (jaga bila AI berlebihan/kurang).
  return cleaned.slice(0, Math.max(UNIT_Q_MIN, Math.min(UNIT_Q_MAX + 2, cleaned.length)));
}

// Ambil/generate paket soal 1 unit (cache di UnitExamPackage). Butuh LLM untuk generate.
export async function ensureUnitExamPackage(docId, unit) {
  const existing = await prisma.unitExamPackage.findUnique({ where: { docId_unitCode: { docId, unitCode: unit.code } } });
  if (existing) return existing;
  const doc = await prisma.skkniDocument.findUnique({ where: { id: docId }, select: { title: true } });
  const questions = await generateSingleUnitExam(doc?.title || "Kompetensi", unit);
  if (!questions.length) return null;
  return prisma.unitExamPackage.create({
    data: { docId, unitCode: unit.code, unitTitle: unit.title, questions: JSON.stringify(questions), questionCount: questions.length },
  });
}

// Instance ujian 1 unit: acak urutan soal + opsi, answerKey menyesuaikan.
export function buildUnitExamInstance(pkg) {
  const base = JSON.parse(pkg.questions);
  return shuffle(base).map((q) => {
    const opts = q.options.map((text, idx) => ({ text, correct: idx === q.answerKey }));
    const s = shuffle(opts);
    return { q: q.q, options: s.map((o) => o.text), answerKey: s.findIndex((o) => o.correct) };
  });
}

// Status semua unit dari kompetensi terpilih: urut + gating berjenjang.
// state: locked | learning (kelas terbuka, ujian terkunci) | ready (ujian terbuka) | passed.
// Urutan maju bila unit sebelumnya "selesai" (kelas ditandai selesai ATAU lulus ujian).
// unlockedByCoin membypass urutan & kewajiban belajar → langsung "ready".
export async function unitStates(userId, docId) {
  const units = await prisma.skkniUnit.findMany({
    where: { documentId: docId, availability: "applied" }, orderBy: { code: "asc" },
  });
  if (!units.length) return [];
  const codes = units.map((u) => u.code);
  const [assess, progress, coursePkgs, examPkgs] = await Promise.all([
    prisma.skillAssessment.findMany({ where: { userId, competencyCode: { in: codes } } }),
    prisma.unitProgress.findMany({ where: { userId, unitCode: { in: codes } } }),
    prisma.unitCourse.findMany({ where: { docId, unitCode: { in: codes } }, select: { unitCode: true } }),
    prisma.unitExamPackage.findMany({ where: { docId, unitCode: { in: codes } }, select: { unitCode: true, questionCount: true } }),
  ]);
  const scoreBy = Object.fromEntries(assess.map((a) => [a.competencyCode, a.currentScore]));
  const progBy = Object.fromEntries(progress.map((p) => [p.unitCode, p]));
  const hasCourse = new Set(coursePkgs.map((c) => c.unitCode));
  const qCountBy = Object.fromEntries(examPkgs.map((e) => [e.unitCode, e.questionCount]));

  let prevDone = true; // unit pertama selalu terbuka urutannya
  return units.map((u, i) => {
    const score = scoreBy[u.code];
    const passed = (score ?? 0) >= 60 && score !== undefined;
    const p = progBy[u.code] || {};
    const learned = !!p.learned;
    const unlockedByCoin = !!p.unlockedByCoin;
    const sequenceOpen = i === 0 || prevDone;
    const accessible = sequenceOpen || unlockedByCoin;
    let state;
    if (passed) state = "passed";
    else if (!accessible) state = "locked";
    else if (learned || unlockedByCoin) state = "ready";
    else state = "learning";
    prevDone = learned || passed; // menentukan keterbukaan unit berikutnya
    return {
      order: i + 1, code: u.code, title: u.title, state,
      score: score ?? null, passed, learned, unlockedByCoin,
      hasCourse: hasCourse.has(u.code), questionCount: qCountBy[u.code] ?? null,
    };
  });
}
