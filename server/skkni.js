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
import { chatComplete, isLlmConfigured } from "./llm.js";
import { buildRankLadder } from "./unitrank.js";

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
// Catatan: JANGAN gate pada flag `running` yang tersimpan - flag itu bisa "stale=true"
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

// ── Status penyiapan kompetensi ──────────────────────────────────────────────
// Kemnaker membatasi ~1 permintaan/70 dtk, jadi penarikan unit bisa lama. Status
// disimpan di memori supaya klien bisa menampilkan layar tunggu yang jujur
// (sedang disiapkan / selesai / gagal), bukan menebak dari `unitsCached` saja -
// sebab kalau ingest gagal, `unitsCached` tak pernah true dan klien akan polling
// selamanya tanpa tahu penyebabnya.
const prepareState = new Map(); // docId -> { state, error, startedAt, finishedAt, promise }

export function getPrepareState(docId) {
  return prepareState.get(String(docId)) || null;
}

// Tarik unit + klasifikasi bobot di latar belakang. Aman dipanggil berulang:
// bila proses untuk docId yang sama masih jalan, panggilan menyusul memakai promise yang sama.
export function prepareDoc(docId) {
  const id = String(docId);
  const cur = prepareState.get(id);
  if (cur?.state === "running" && cur.promise) return cur.promise;

  const entry = { state: "running", error: null, startedAt: Date.now(), finishedAt: null };
  entry.promise = ingestUnits(id)
    .then(async () => {
      // Bobot kompetensi (cap rank) non-fatal: kegagalannya tak boleh menggagalkan penyiapan.
      await ensureCompetencyWeight(id).catch((e) => console.warn("[skkni] weight bg:", e.message));
      entry.state = "done";
    })
    .catch((e) => {
      entry.state = "error";
      entry.error = e?.message || "Gagal menyiapkan kompetensi.";
      console.warn("[skkni] prepare gagal:", id, entry.error);
    })
    .finally(() => { entry.finishedAt = Date.now(); });

  prepareState.set(id, entry);
  return entry.promise;
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

// Cocokkan per KATA UTUH (\b) agar tak salah tangkap substring - mis. "bidang" ≠ "bidan",
// "perawatan bangunan" ≠ "perawat". Precompile sekali (dipakai berulang atas 1234 dok).
const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const CAT_RE = CATEGORIES.map((c) => ({ key: c.key, label: c.label, res: c.kw.map((k) => new RegExp(`\\b${esc(k)}\\b`, "i")) }));

function categorize(title, sector) {
  const hay = `${title || ""} ${sector || ""}`;
  for (const c of CAT_RE) if (c.res.some((re) => re.test(hay))) return { key: c.key, label: c.label };
  return FALLBACK_CAT;
}
// Nama tampilan yang bersih (buang prefiks "SKKNI").
export function cleanTitle(title) {
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
// Keduanya library global per (docId, unitCode) - di-generate sekali, dipakai ulang.

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

// ── Materi MENDALAM bertahap (course player ala ujian) ───────────────────────
// 4-6 "pelajaran" per unit, tiap pelajaran = materi spesifik (bukan ringkasan) +
// contoh + rujukan sumber tepercaya + kueri video YouTube. Digenerate SEKALI per
// unit lalu di-cache selamanya di UnitCourse.content.lessons → biaya one-time.
async function generateDeepLessons(compTitle, unit, base) {
  const prompt =
    `Anda instruktur vokasi senior berbasis SKKNI Indonesia. Kompetensi/profesi: "${compTitle}". ` +
    `Susun COURSE BERTAHAP yang MENGAJARKAN unit kompetensi: "${unit.title}" (kode ${unit.code}).\n` +
    (base?.keyPoints?.length ? `Cakup poin-poin kunci ini: ${base.keyPoints.join("; ")}.\n` : "") +
    `Buat 4-6 PELAJARAN berurutan (fondasi → praktik). Tiap pelajaran MENGAJAR dengan SPESIFIK: ` +
    `jelaskan konsep, istilah, angka/standar, cara melakukan - BUKAN ringkasan 2 kalimat. ` +
    `Balas HANYA JSON valid:\n` +
    `{"lessons":[{"title":"judul pelajaran singkat",` +
    `"body":"3-5 paragraf materi mendalam & spesifik (pisahkan paragraf dengan \\n\\n); gaya mengajar, konkret, praktis",` +
    `"points":["3-5 takeaway penting pelajaran ini"],` +
    `"example":"1 contoh penerapan nyata di pekerjaan (konkret, bercerita)",` +
    `"sources":[{"label":"nama sumber","url":"https://..."}],` +
    `"ytQuery":"kueri pencarian YouTube 3-6 kata (Indonesia/Inggris) untuk video pembelajaran topik ini"}]}\n` +
    `ATURAN SUMBER (penting): maksimal 2 per pelajaran; HANYA situs tepercaya & stabil - Wikipedia, ` +
    `dokumentasi/halaman dukungan resmi vendor (mis. support.google.com, helpx.adobe.com, developer.mozilla.org), ` +
    `situs lembaga (kemnaker.go.id, bnsp.go.id, ilo.org). Gunakan URL tingkat halaman utama/topik yang PASTI ada - ` +
    `JANGAN mengarang deep-link artikel spesifik. Bila ragu, cukup 1 sumber Wikipedia. Bahasa Indonesia. Untuk semua teks: gunakan tanda hubung biasa "-", JANGAN pakai em dash.`;
  const r = await chatComplete([{ role: "user", content: prompt }], { temperature: 0.5, maxTokens: 3600 });
  const m = (r.content || "").match(/\{[\s\S]*\}/);
  const o = JSON.parse(m ? m[0] : r.content);
  const lessons = (Array.isArray(o.lessons) ? o.lessons : []).slice(0, 6).map((l) => ({
    title: String(l.title || "Pelajaran").slice(0, 140),
    body: String(l.body || "").slice(0, 4000),
    points: Array.isArray(l.points) ? l.points.slice(0, 5).map((x) => String(x).slice(0, 220)) : [],
    example: String(l.example || "").slice(0, 900),
    sources: (Array.isArray(l.sources) ? l.sources : [])
      .filter((s) => /^https:\/\/[a-z0-9.-]+\.[a-z]{2,}/i.test(String(s?.url || "")))
      .slice(0, 2)
      .map((s) => ({ label: String(s.label || "Sumber").slice(0, 90), url: String(s.url).slice(0, 300) })),
    ytQuery: String(l.ytQuery || `${unit.title} tutorial`).slice(0, 90),
  })).filter((l) => l.body.length > 100);
  if (!lessons.length) throw new Error("AI tidak menghasilkan pelajaran yang valid.");
  // Validasi URL sumber (sekali, saat generate): buang link mati agar user tak
  // pernah melihat 404. AI kadang mengarang judul artikel yang tidak ada.
  await validateLessonSources(lessons);
  return lessons;
}

// ── Video YouTube per pelajaran (embed) ───────────────────────────────────────
// Resolve via YouTube Data API v3 SEKALI per pelajaran → videoId di-cache di lesson
// (hemat kuota: 100 unit/pencarian, gratis 10rb/hari; setelah cache = 0 panggilan).
async function resolveYtVideo(query) {
  const key = process.env.YOUTUBE_API_KEY;
  if (!key || !query) return null;
  const url = "https://www.googleapis.com/youtube/v3/search?part=snippet&type=video&maxResults=1" +
    "&videoEmbeddable=true&safeSearch=strict&relevanceLanguage=id" +
    `&q=${encodeURIComponent(query)}&key=${key}`;
  try {
    const r = await fetch(url, { signal: AbortSignal.timeout(8000) });
    if (!r.ok) { console.warn("[yt] search", r.status, (await r.text()).slice(0, 120)); return null; }
    const j = await r.json();
    const it = j.items?.[0];
    if (!it?.id?.videoId) return null;
    return { id: it.id.videoId, title: String(it.snippet?.title || "").slice(0, 160), channel: String(it.snippet?.channelTitle || "").slice(0, 80) };
  } catch (e) {
    console.warn("[yt] resolve:", e.message);
    return null;
  }
}

// Lampirkan videoId ke tiap pelajaran yang belum punya (serial - hormati kuota).
async function attachYtVideos(lessons) {
  let changed = false;
  for (const l of lessons) {
    if (!l.ytQuery || l.ytVideoId) continue;
    const v = await resolveYtVideo(l.ytQuery);
    if (v) { l.ytVideoId = v.id; l.ytTitle = v.title; l.ytChannel = v.channel; changed = true; }
  }
  return changed;
}

// Cek semua URL sumber secara paralel; pertahankan hanya yang hidup (2xx/3xx).
async function validateLessonSources(lessons) {
  const checks = [];
  for (const l of lessons) {
    for (const s of l.sources) {
      checks.push(
        fetch(s.url, { method: "HEAD", redirect: "follow", signal: AbortSignal.timeout(6000) })
          .then((r) => { s._ok = r.ok; })
          .catch(() => { s._ok = false; })
      );
    }
  }
  await Promise.allSettled(checks);
  for (const l of lessons) {
    l.sources = l.sources.filter((s) => s._ok).map(({ _ok, ...rest }) => rest);
  }
}

// Ambil/generate pelajaran mendalam (lazy, merge ke UnitCourse.content.lessons).
export async function ensureUnitLessons(docId, unit) {
  const row = await ensureUnitCourse(docId, unit);
  let content = {};
  try { content = JSON.parse(row.content); } catch { /* rusak → regenerasi lessons saja */ }

  const save = () => prisma.unitCourse.update({
    where: { docId_unitCode: { docId, unitCode: unit.code } },
    data: { content: JSON.stringify(content) },
  });

  if (Array.isArray(content.lessons) && content.lessons.length) {
    // Backfill video embed untuk pelajaran lama yang belum punya videoId (sekali).
    if (await attachYtVideos(content.lessons)) await save();
    return content.lessons;
  }

  const doc = await prisma.skkniDocument.findUnique({ where: { id: docId }, select: { title: true } });
  const lessons = await generateDeepLessons(doc?.title || "Kompetensi", unit, content);
  await attachYtVideos(lessons);
  content.lessons = lessons;
  await save();
  return lessons;
}

// Paket soal 1 unit - 3 TIPE (validasi mendalam, bukan sekadar keberuntungan #6):
//  • "mc"          pilihan ganda (pengetahuan)
//  • "situational" studi kasus situasional (AI menilai penalaran vs keyPoints)
//  • "steporder"   urutan/tahapan mengerjakan (AI menilai efisiensi vs idealSteps)
// Total 10-15 soal, semua berbasis kasus kerja nyata.
async function generateSingleUnitExam(compTitle, unit) {
  const prompt =
    `Anda penyusun UJI KOMPETENSI berbasis SKKNI. Kompetensi/profesi: "${compTitle}". ` +
    `Buat PAKET soal untuk menguji penguasaan SATU unit: "${unit.title}" (kode ${unit.code}). ` +
    `TOTAL 10-15 soal, campuran 3 tipe, SEMUA berbasis kasus kerja nyata (bukan definisi umum):\n` +
    `1) type "mc" (6-9 soal): pilihan ganda, 4 opsi, satu benar (answerKey 0-3).\n` +
    `2) type "situational" (2-4 soal): studi kasus situasional ala pertanyaan HRD saat wawancara ` +
    `(mis. konflik rekan kerja, deadline mepet, sumber daya terbatas, revisi klien). Sertakan "keyPoints": 3-5 poin jawaban ideal.\n` +
    `3) type "steporder" (1-2 soal): minta user menjelaskan TAHAPAN mengerjakan sesuatu secara paling efisien. Sertakan "idealSteps": urutan langkah ideal (array).\n` +
    `Balas HANYA JSON array valid; tiap elemen SALAH SATU bentuk:\n` +
    `{"type":"mc","q":"...","options":["..","..","..",".."],"answerKey":0}\n` +
    `{"type":"situational","q":"...","keyPoints":["..",".."]}\n` +
    `{"type":"steporder","q":"...","idealSteps":["..",".."]}`;
  const r = await chatComplete([{ role: "user", content: prompt }], { temperature: 0.6, maxTokens: 4000 });
  const text = r.content || "";
  const m = text.match(/\[[\s\S]*\]/);
  const arr = JSON.parse(m ? m[0] : text);
  const cleaned = [];
  for (const q of arr) {
    if (!q || typeof q.q !== "string") continue;
    if (q.type === "situational") {
      cleaned.push({ type: "situational", q: q.q, keyPoints: Array.isArray(q.keyPoints) ? q.keyPoints.slice(0, 6).map((x) => String(x).slice(0, 200)) : [] });
    } else if (q.type === "steporder") {
      cleaned.push({ type: "steporder", q: q.q, idealSteps: Array.isArray(q.idealSteps) ? q.idealSteps.slice(0, 12).map((x) => String(x).slice(0, 160)) : [] });
    } else if (Array.isArray(q.options) && q.options.length >= 2) {
      cleaned.push({ type: "mc", q: q.q, options: q.options.slice(0, 4), answerKey: Math.max(0, Math.min(3, Number(q.answerKey) || 0)) });
    }
  }
  return cleaned.slice(0, 16);
}

// ── Tes Penempatan ───────────────────────────────────────────────────────────
export const PLACEMENT_MAX_UNITS = 12;   // batas unit yang diuji (2 soal/unit → maks 24 soal)
// Jatah waktu per unit: ~1 menit untuk pilihan ganda berbasis kasus + ~2 menit menulis uraian.
// Sengaja longgar - tes ini mencari kemampuan sebenarnya, dan orang yang terburu-buru akan
// tampak lebih rendah dari kenyataan lalu disuruh mengulang materi yang sudah dia kuasai.
export const PLACEMENT_MINUTES_PER_UNIT = 3;
export const PLACEMENT_BATCH = 4;        // unit per panggilan AI (8 soal/panggilan)

// Pilih unit yang diuji. Bila unit terlalu banyak untuk satu tes yang manusiawi, ambil
// MENYEBAR ke seluruh tier tangga rank (bukan 12 unit pertama) supaya baseline tetap
// mewakili dari dasar sampai lanjutan.
export function pickPlacementUnits(units, cap, max = PLACEMENT_MAX_UNITS) {
  const list = (units || []).filter((u) => u?.code);
  if (list.length <= max) return list;
  const ladder = buildRankLadder(list, cap);
  const picked = [];
  const cursors = ladder.map(() => 0);
  // Ambil bergiliran per tier sampai kuota penuh.
  while (picked.length < max) {
    let moved = false;
    for (let i = 0; i < ladder.length && picked.length < max; i++) {
      const bucket = ladder[i].units;
      if (cursors[i] < bucket.length) { picked.push(bucket[cursors[i]++]); moved = true; }
    }
    if (!moved) break;
  }
  return picked;
}

// Satu panggilan AI untuk beberapa unit sekaligus: tiap unit dapat 1 pilihan ganda + 1 isian.
// Kesulitan sengaja dinaikkan - tes ini menggantikan latihan tiap unit, jadi soal mudah
// akan melebih-lebihkan kemampuan dan merusak baseline.
async function generatePlacementBatch(compTitle, units) {
  const daftar = units.map((u, i) => `${i + 1}. [${u.code}] ${u.title}`).join("\n");
  const prompt =
    `Anda penyusun TES PENEMPATAN berbasis SKKNI untuk kompetensi "${compTitle}". ` +
    `Tes ini mengukur kemampuan AWAL seorang praktisi agar tidak perlu mengulang materi yang sudah dikuasai. ` +
    `Untuk SETIAP unit di bawah, buat TEPAT 2 soal:\n` +
    `a) type "mc": pilihan ganda 4 opsi, satu benar (answerKey 0-3).\n` +
    `b) type "situational": kasus kerja nyata yang dijawab dengan uraian singkat. Sertakan "keyPoints": 3-5 poin jawaban ideal.\n` +
    `TINGKAT KESULITAN TINGGI: soal harus menguji penerapan & pengambilan keputusan di lapangan, ` +
    `bukan definisi atau hafalan. Pengecoh pada pilihan ganda harus masuk akal bagi orang awam. ` +
    `Gunakan tanda hubung biasa "-", JANGAN em dash.\n\n` +
    `UNIT:\n${daftar}\n\n` +
    `Balas HANYA JSON array valid, tiap elemen menyertakan "unitCode" yang sesuai:\n` +
    `{"unitCode":"...","type":"mc","q":"...","options":["..","..","..",".."],"answerKey":0}\n` +
    `{"unitCode":"...","type":"situational","q":"...","keyPoints":["..",".."]}`;
  const r = await chatComplete([{ role: "user", content: prompt }], { temperature: 0.5, maxTokens: 900 * units.length + 600 });
  const text = r.content || "";
  const m = text.match(/\[[\s\S]*\]/);
  const arr = JSON.parse(m ? m[0] : text);
  const byCode = new Map(units.map((u) => [u.code, u]));
  const out = [];
  for (const q of arr) {
    const unit = byCode.get(q?.unitCode);
    if (!unit || typeof q.q !== "string") continue;
    const base = { unitCode: unit.code, unitTitle: unit.title, q: q.q };
    if (q.type === "situational") {
      out.push({ ...base, type: "situational", keyPoints: Array.isArray(q.keyPoints) ? q.keyPoints.slice(0, 6).map((x) => String(x).slice(0, 200)) : [] });
    } else if (Array.isArray(q.options) && q.options.length >= 2) {
      out.push({ ...base, type: "mc", options: q.options.slice(0, 4), answerKey: Math.max(0, Math.min(3, Number(q.answerKey) || 0)) });
    }
  }
  return out;
}

// Paket tes penempatan per kompetensi: digenerate SEKALI lalu dipakai semua user (cache permanen).
export async function ensurePlacementPackage(docId) {
  const existing = await prisma.placementPackage.findUnique({ where: { docId } });
  if (existing) return existing;
  if (!isLlmConfigured()) return null;

  const doc = await prisma.skkniDocument.findUnique({ where: { id: docId }, select: { title: true, weightMaxRank: true } });
  const allUnits = await prisma.skkniUnit.findMany({ where: { documentId: docId }, orderBy: { code: "asc" }, select: { code: true, title: true } });
  const units = pickPlacementUnits(allUnits, doc?.weightMaxRank || 9);
  if (!units.length) return null;

  // Dibatch supaya satu panggilan tak kepanjangan; berurutan agar kegagalan mudah ditelusuri.
  const questions = await buildExamQuestions(doc?.title || "Kompetensi", units, generatePlacementBatch, "placement");
  if (!questions.length) return null;

  const covered = new Set(questions.map((q) => q.unitCode));
  return prisma.placementPackage.create({
    data: { docId, questions: JSON.stringify(questions), unitCount: covered.size },
  });
}

// ── Ujian Kompetensi Utama ───────────────────────────────────────────────────
// Satu-satunya penerbit sertifikat. Bedanya dengan tes penempatan bukan cuma "lebih susah":
// soalnya menuntut SINTESIS lintas unit (keputusan yang menimbang beberapa aspek sekaligus),
// sedangkan tes penempatan menilai tiap unit terpisah.
export const FINAL_PASS_SCORE = 70;          // ambang lulus (lebih tinggi dari 60 per unit)
export const FINAL_MINUTES_PER_UNIT = 4;     // soal sintesis butuh waktu berpikir lebih

async function generateFinalBatch(compTitle, units) {
  const daftar = units.map((u, i) => `${i + 1}. [${u.code}] ${u.title}`).join("\n");
  const prompt =
    `Anda penyusun UJIAN SERTIFIKASI KOMPETENSI berbasis SKKNI untuk "${compTitle}". ` +
    `Ujian ini menentukan apakah kandidat layak menerima SERTIFIKAT kompetensi, jadi standarnya tinggi. ` +
    `Untuk SETIAP unit di bawah, buat TEPAT 2 soal:\n` +
    `a) type "mc": pilihan ganda 4 opsi, satu benar (answerKey 0-3).\n` +
    `b) type "situational": kasus kerja kompleks yang dijawab dengan uraian. Sertakan "keyPoints": 3-5 poin jawaban ideal.\n` +
    `PENTING - beda dari tes biasa: soal harus menuntut SINTESIS, yaitu keputusan yang menimbang ` +
    `beberapa aspek sekaligus (mutu, tenggat, keselamatan, komunikasi dengan pihak lain), bukan hafalan ` +
    `atau satu langkah tunggal. Pengecoh pilihan ganda harus tampak benar bagi orang yang setengah paham. ` +
    `Gunakan tanda hubung biasa "-", JANGAN em dash.\n\n` +
    `UNIT:\n${daftar}\n\n` +
    `Balas HANYA JSON array valid, tiap elemen menyertakan "unitCode" yang sesuai:\n` +
    `{"unitCode":"...","type":"mc","q":"...","options":["..","..","..",".."],"answerKey":0}\n` +
    `{"unitCode":"...","type":"situational","q":"...","keyPoints":["..",".."]}`;
  const r = await chatComplete([{ role: "user", content: prompt }], { temperature: 0.5, maxTokens: 900 * units.length + 600 });
  const text = r.content || "";
  const m = text.match(/\[[\s\S]*\]/);
  const arr = JSON.parse(m ? m[0] : text);
  const byCode = new Map(units.map((u) => [u.code, u]));
  const out = [];
  for (const q of arr) {
    const unit = byCode.get(q?.unitCode);
    if (!unit || typeof q.q !== "string") continue;
    const base = { unitCode: unit.code, unitTitle: unit.title, q: q.q };
    if (q.type === "situational") {
      out.push({ ...base, type: "situational", keyPoints: Array.isArray(q.keyPoints) ? q.keyPoints.slice(0, 6).map((x) => String(x).slice(0, 200)) : [] });
    } else if (Array.isArray(q.options) && q.options.length >= 2) {
      out.push({ ...base, type: "mc", options: q.options.slice(0, 4), answerKey: Math.max(0, Math.min(3, Number(q.answerKey) || 0)) });
    }
  }
  return out;
}

// Susun soal per batch, lalu ULANGI untuk unit yang belum kebagian.
// Perlu karena AI kadang mengembalikan JSON rusak atau memakai unitCode yang tak cocok,
// sehingga batch itu terbuang dan unitnya tak pernah diuji. Tanpa percobaan ulang,
// kegagalan itu diam - paket tetap tersimpan permanen dengan cakupan bolong.
async function buildExamQuestions(compTitle, units, batchFn, label) {
  const questions = [];
  const runBatches = async (list) => {
    for (let i = 0; i < list.length; i += PLACEMENT_BATCH) {
      const chunk = list.slice(i, i + PLACEMENT_BATCH);
      try {
        questions.push(...(await batchFn(compTitle, chunk)));
      } catch (e) {
        console.warn(`[${label}] batch gagal:`, chunk.map((u) => u.code).join(","), e.message);
      }
    }
  };

  await runBatches(units);
  const covered = new Set(questions.map((q) => q.unitCode));
  const missing = units.filter((u) => !covered.has(u.code));
  if (missing.length) {
    console.warn(`[${label}] ${missing.length} unit belum kebagian soal, mencoba ulang…`);
    await runBatches(missing);
  }
  const still = units.filter((u) => !new Set(questions.map((q) => q.unitCode)).has(u.code));
  if (still.length) console.warn(`[${label}] tetap tanpa soal setelah ulang:`, still.map((u) => u.code).join(","));
  return questions;
}

export async function ensureFinalExamPackage(docId) {
  const existing = await prisma.competencyExamPackage.findUnique({ where: { docId } });
  if (existing) return existing;
  if (!isLlmConfigured()) return null;

  const doc = await prisma.skkniDocument.findUnique({ where: { id: docId }, select: { title: true, weightMaxRank: true } });
  const allUnits = await prisma.skkniUnit.findMany({ where: { documentId: docId }, orderBy: { code: "asc" }, select: { code: true, title: true } });
  const units = pickPlacementUnits(allUnits, doc?.weightMaxRank || 9);  // sebaran lintas tier yang sama
  if (!units.length) return null;

  const questions = await buildExamQuestions(doc?.title || "Kompetensi", units, generateFinalBatch, "final");
  if (!questions.length) return null;

  const covered = new Set(questions.map((q) => q.unitCode));
  return prisma.competencyExamPackage.create({
    data: { docId, questions: JSON.stringify(questions), unitCount: covered.size },
  });
}

// Ulasan menyeluruh atas hasil tes penempatan: kekuatan, titik lemah, langkah berikutnya.
// Dua versi bahasa (aturan dwibahasa proyek). Non-fatal: kegagalan cukup mengembalikan null.
export async function reviewPlacement(compTitle, breakdown, lang = "id") {
  if (!isLlmConfigured() || !breakdown?.length) return null;
  const daftar = breakdown
    .slice()
    .sort((a, b) => a.score - b.score)
    .map((b) => `- ${b.unitTitle}: ${b.score}%`)
    .join("\n");
  const prompt = lang === "en"
    ? `You are a competency assessor for "${compTitle}". A candidate just finished a placement test. ` +
      `Unit scores (lowest first):\n${daftar}\n\n` +
      `Write a short review (3-4 sentences) for the candidate: name their real strengths, the units that need the most work, ` +
      `and one concrete next step. Speak directly to them, warm and honest, no bullet lists, no markdown. ` +
      `Use ordinary hyphens "-", never em dashes.`
    : `Anda penilai kompetensi "${compTitle}". Seorang kandidat baru menyelesaikan tes penempatan. ` +
      `Skor per unit (terendah dulu):\n${daftar}\n\n` +
      `Tulis ulasan singkat (3-4 kalimat) untuk kandidat: sebutkan kekuatan nyatanya, unit yang paling perlu diperbaiki, ` +
      `dan satu langkah konkret berikutnya. Bicara langsung kepadanya, hangat tapi jujur, tanpa daftar berpoin, tanpa markdown. ` +
      `Gunakan tanda hubung biasa "-", JANGAN em dash.`;
  try {
    const r = await chatComplete([{ role: "user", content: prompt }], { temperature: 0.5, maxTokens: 400 });
    return String(r.content || "").trim().slice(0, 900) || null;
  } catch (e) {
    console.warn("[placement] ulasan gagal:", e.message);
    return null;
  }
}

// Instance milik user: urutan unit tetap (dikelompokkan) tapi opsi pilihan ganda diacak.
export function buildPlacementInstance(pkg) {
  const base = JSON.parse(pkg.questions);
  return base.map((q) => {
    if (q.type !== "mc") return q;
    const opts = q.options.map((text, idx) => ({ text, correct: idx === q.answerKey }));
    const s = shuffle(opts);
    return { ...q, options: s.map((o) => o.text), answerKey: s.findIndex((o) => o.correct) };
  });
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

// Instance ujian 1 unit: acak urutan soal; untuk MC acak opsi & sesuaikan answerKey.
// Soal isian/urutan diteruskan apa adanya (menyertakan referensi penilaian, server-side).
export function buildUnitExamInstance(pkg) {
  const base = JSON.parse(pkg.questions);
  return shuffle(base).map((q) => {
    if ((q.type || "mc") !== "mc") return q;
    const opts = q.options.map((text, idx) => ({ text, correct: idx === q.answerKey }));
    const s = shuffle(opts);
    return { type: "mc", q: q.q, options: s.map((o) => o.text), answerKey: s.findIndex((o) => o.correct) };
  });
}

// Penilaian AI untuk jawaban bebas (situational/steporder) → skor 0-100 + feedback per soal.
// items: [{ index, type, q, answer, keyPoints?, idealSteps? }]
export async function gradeFreeText(unitTitle, items, lang = "id") {
  if (!items.length) return {};
  if (!isLlmConfigured()) {
    const out = {};
    for (const it of items) out[it.index] = { score: (it.answer || "").trim().length >= 25 ? 60 : 0, feedback: "Dinilai otomatis (AI nonaktif)." };
    return out;
  }
  const list = items.map((it) => {
    const ref = it.type === "steporder"
      ? `Urutan langkah ideal (acuan): ${(it.idealSteps || []).join(" → ")}`
      : `Poin kunci jawaban ideal (acuan): ${(it.keyPoints || []).join("; ")}`;
    return `SOAL #${it.index} [${it.type}]: ${it.q}\n${ref}\nJAWABAN USER: ${(it.answer || "(kosong)").slice(0, 1200)}`;
  }).join("\n\n");
  // Penilaian sengaja LONGGAR: yang diukur pemahaman konteks, bukan kelengkapan atau
  // kecocokan kata dengan acuan. Acuan hanya rambu - praktisi sering menjawab benar
  // dengan istilah & urutan sendiri, dan menghukum itu membuat baseline meleset.
  const rubrik = lang === "en"
    ? `Grade on UNDERSTANDING OF CONTEXT, not completeness or wording. The reference points are a guide, ` +
      `not a checklist: an answer that shows the right idea in the candidate's own words is correct, even if brief ` +
      `or missing some points. Only mark down answers that are empty, irrelevant, or factually wrong. ` +
      `Empty or off-topic = 0-20; right direction but very thin = 55-70; context clearly correct = 75-90; ` +
      `correct and thorough = 90-100. When in doubt, lean higher. Feedback must be one short encouraging sentence in English.`
    : `Nilai berdasar PEMAHAMAN KONTEKS, bukan kelengkapan atau kesamaan kata dengan acuan. Poin acuan hanya rambu, ` +
      `bukan daftar periksa: jawaban yang menunjukkan pemahaman benar dengan bahasa sendiri sudah dianggap benar, ` +
      `walau singkat atau tidak menyebut semua poin. Kurangi nilai HANYA bila jawaban kosong, melenceng, atau keliru. ` +
      `Kosong/tidak relevan = 0-20; arah sudah benar tapi sangat dangkal = 55-70; konteks jelas benar = 75-90; ` +
      `benar dan menyeluruh = 90-100. Kalau ragu, condong ke nilai lebih tinggi. Feedback satu kalimat singkat & menyemangati (Bahasa Indonesia).`;
  const prompt =
    `Kamu penilai uji kompetensi unit "${unitTitle}". Nilai TIAP jawaban user (skor 0-100). ` +
    `${rubrik}\n\n${list}\n\n` +
    `Balas HANYA JSON array: [{"index":<n>,"score":0-100,"feedback":"<=1 kalimat"}]`;
  const r = await chatComplete([{ role: "user", content: prompt }], { temperature: 0.2, maxTokens: 250 * items.length + 500 });
  const m = (r.content || "").match(/\[[\s\S]*\]/);
  const arr = JSON.parse(m ? m[0] : r.content);
  const out = {};
  for (const o of arr) out[Number(o.index)] = { score: Math.max(0, Math.min(100, Number(o.score) || 0)), feedback: String(o.feedback || "").slice(0, 240) };
  return out;
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

// ══ BOBOT KOMPETENSI → CAP RANK ══════════════════════════════════════════════
// Tiap kompetensi punya "berat" berbeda: petani ≠ ahli pertanian. Bobot menentukan
// rank MAKSIMAL yang bisa diraih dari lulus ujian kita (cegah overcapacity). Untuk
// melampaui butuh bukti eksternal terverifikasi. Di-klasifikasi AI (cache), fallback heuristik.
const RANK_NAMES = ["", "Bronze", "Silver", "Gold", "Platinum", "Emerald", "Diamond", "Master", "Grandmaster", "Legend"];

function heuristicWeight(title, unitTitles) {
  const text = `${title} ${unitTitles.join(" ")}`.toLowerCase();
  const advanced = /(ahli|spesialis|lanjut|advanced|arsitek|analis|manajer|manajerial|konsultan|desain sistem|machine learning|kecerdasan buatan|forensik|auditor|perancang|master)/.test(text);
  const basic = /(dasar|operator|pengoperasian|pemula|entry|membersihkan|merapikan|dokumentasi dasar|asisten|pembantu)/.test(text);
  const n = unitTitles.length;
  const maxRank = advanced ? 8 : basic ? 5 : (n > 20 ? 7 : 6);
  return { maxRank, tier: advanced ? "Ahli" : basic ? "Operasional" : "Teknis", reason: "Perkiraan otomatis dari cakupan & kata kunci unit." };
}

async function classifyWeightLlm(title, unitTitles) {
  const list = unitTitles.slice(0, 24).map((t) => `• ${t}`).join("\n");
  const prompt =
    `Nilai TINGKAT KESULITAN/BOBOT kompetensi SKKNI berikut untuk menentukan RANK MAKSIMAL yang pantas ` +
    `bila seseorang menguasai SELURUH unitnya lewat ujian standar.\n` +
    `Skala rank (9 tier): 3 Gold, 4 Platinum, 5 Emerald, 6 Diamond, 7 Master, 8 Grandmaster, 9 Legend.\n` +
    `Pedoman: kompetensi OPERASIONAL/dasar (mis. editing video dasar, entri data) → maks 5-6. ` +
    `TEKNIS/menengah → 6-7. SPESIALIS/AHLI (mis. CG/VFX lanjutan, machine learning, bedah, arsitektur sistem) → 8-9.\n` +
    `Kompetensi: "${title}"\nUnit:\n${list}\n\n` +
    `Balas HANYA JSON: {"maxRank":<5-9>,"tier":"Operasional|Teknis|Spesialis|Ahli","reason":"<=1 kalimat singkat kenapa"}`;
  const r = await chatComplete([{ role: "user", content: prompt }], { temperature: 0.2, maxTokens: 200 });
  const m = (r.content || "").match(/\{[\s\S]*\}/);
  const o = JSON.parse(m ? m[0] : r.content);
  return {
    maxRank: Math.max(5, Math.min(9, Number(o.maxRank) || 6)),
    tier: String(o.tier || "Teknis").slice(0, 24),
    reason: String(o.reason || "").slice(0, 240),
  };
}

// Ambil/hitung bobot kompetensi (cache di SkkniDocument). Aman dipanggil berkali-kali.
export async function ensureCompetencyWeight(docId) {
  const doc = await prisma.skkniDocument.findUnique({
    where: { id: docId }, include: { units: { orderBy: { code: "asc" }, take: 24, select: { title: true } } },
  });
  if (!doc) return null;
  if (doc.weightMaxRank) return doc;
  const unitTitles = doc.units.map((u) => u.title);
  if (!unitTitles.length) return doc; // unit belum ter-cache - tunda
  let w;
  try { w = isLlmConfigured() ? await classifyWeightLlm(doc.title, unitTitles) : heuristicWeight(doc.title, unitTitles); }
  catch (e) { console.warn("[skkni] weight LLM gagal, heuristik:", e.message); w = heuristicWeight(doc.title, unitTitles); }
  return prisma.skkniDocument.update({
    where: { id: docId },
    data: { weightMaxRank: w.maxRank, weightTier: w.tier, weightReason: w.reason },
  });
}

export function rankNameOf(level) { return RANK_NAMES[level] || "Unranked"; }
