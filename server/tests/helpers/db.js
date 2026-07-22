// Harness database untuk tes.
//
// Aturan yang dipegang: tes TIDAK BOLEH menyentuh server/dev.db. Itu data kerja sehari-hari
// dan sekali tertimpa tak ada cadangannya.
//
// Caranya: schema.prisma meng-hardcode `file:../dev.db`, jadi `prisma db push` biasa akan
// menembak database asli. Maka dibuat SALINAN schema di folder sementara yang alamatnya
// diarahkan ke database template, lalu `db push` dijalankan terhadap salinan itu. Template
// dibuat sekali, kemudian TIAP BERKAS TES memakai salinannya sendiri - `node --test`
// menjalankan tiap berkas di proses terpisah dan bisa paralel, jadi database bersama akan
// saling menimpa.
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const SERVER = path.resolve(HERE, "../..");
const TMP = path.join(SERVER, "tests", ".tmp");
const SCHEMA_ASLI = path.join(SERVER, "prisma", "schema.prisma");
const TEMPLATE = path.join(TMP, "template.db");

const urlFor = (p) => `file:${p.replace(/\\/g, "/")}`;

// Bangun database template (skema kosong) sekali saja.
function pastikanTemplate() {
  if (fs.existsSync(TEMPLATE)) return;
  fs.mkdirSync(TMP, { recursive: true });

  const schema = fs.readFileSync(SCHEMA_ASLI, "utf8")
    .replace(/url\s*=\s*"[^"]*"/, `url = "${urlFor(TEMPLATE)}"`);
  const schemaTmp = path.join(TMP, "schema.prisma");
  fs.writeFileSync(schemaTmp, schema);

  // Pemeriksaan terakhir: kalau alamatnya masih menunjuk dev.db, berhenti - lebih baik
  // tesnya gagal daripada database kerja ikut di-push.
  if (/dev\.db/.test(schema.match(/url\s*=\s*"[^"]*"/)?.[0] || "")) {
    throw new Error("schema tes masih menunjuk dev.db - dibatalkan");
  }

  // CLI Prisma dipanggil lewat node LANGSUNG, bukan npx. Dua alasan: path proyek mengandung
  // spasi ("Talent Mapping Company") sehingga `shell: true` memotong argumen, sedangkan
  // tanpa shell Windows menolak menjalankan npx.cmd (EINVAL sejak Node 20). Memanggil
  // berkas JS-nya melewati keduanya.
  const cli = path.join(SERVER, "node_modules", "prisma", "build", "index.js");
  const schemaRel = path.relative(SERVER, schemaTmp).replace(/\\/g, "/");
  execFileSync(process.execPath, [cli, "db", "push", "--schema", schemaRel, "--skip-generate", "--accept-data-loss"], {
    cwd: SERVER, stdio: "pipe",
  });
}

// Siapkan database khusus satu berkas tes, lalu kembalikan klien Prisma-nya.
// HARUS dipanggil sebelum modul apa pun yang mengimpor prisma.js ikut dimuat, karena
// klien membaca DATABASE_URL saat dibuat.
export async function siapkanDb(nama) {
  pastikanTemplate();
  const db = path.join(TMP, `${nama}.db`);
  for (const sisa of [db, `${db}-journal`]) if (fs.existsSync(sisa)) fs.rmSync(sisa);
  fs.copyFileSync(TEMPLATE, db);
  process.env.DATABASE_URL = urlFor(db);
  const { prisma } = await import("../../prisma.js");
  return { prisma, path: db };
}

// ── Pembuat data ────────────────────────────────────────────────────────────
// Sengaja sederhana: tiap tes menyusun keadaannya sendiri secara eksplisit, supaya
// membaca tesnya cukup untuk tahu kenapa hasilnya sekian - tanpa menelusuri fixture.

let n = 0;
export const uniq = (p = "x") => `${p}-${Date.now().toString(36)}-${++n}`;

export async function buatUser(prisma, data = {}) {
  return prisma.user.create({
    data: {
      name: data.name || "Talenta Uji",
      email: data.email || `${uniq("user")}@uji.local`,
      passwordHash: "x",
      role: data.role || "user",
      ...data,
    },
  });
}

// Dokumen SKKNI + unit-unitnya. `units` = array {code, title}.
// `availability` bisa diatur untuk menguji dokumen SKKNI yang sudah DICABUT: dokumen
// "cancelled" unit-unitnya ikut cancelled, dan seluruh fitur hilir hanya membaca "applied".
export async function buatKompetensi(prisma, {
  id, title = "Kompetensi Uji", units = [], weightMaxRank = 9, availability = "applied",
} = {}) {
  const docId = id || uniq("doc");
  await prisma.skkniDocument.create({
    data: { id: docId, title, unitsCached: true, unitCount: units.length, weightMaxRank, availability },
  });
  for (const u of units) {
    await prisma.skkniUnit.create({
      data: { documentId: docId, code: u.code, title: u.title, availability: u.availability || availability },
    });
  }
  return docId;
}

export async function beriNilai(prisma, userId, code, score, name = null) {
  return prisma.skillAssessment.create({
    data: {
      userId, competencyCode: code, competencyName: name || code,
      currentScore: score, requiredScore: 100, gap: 100 - score,
    },
  });
}

// 11 unit ala Video Editing - dipakai beberapa berkas tes.
export const UNIT_VIDEO = [
  { code: "V.01", title: "Menerapkan prosedur K3 di area kerja" },
  { code: "V.02", title: "Menjaga keamanan data produksi" },
  { code: "V.03", title: "Mempersiapkan bahan editing" },
  { code: "V.04", title: "Mencatat log produksi" },
  { code: "V.05", title: "Melakukan instalasi perangkat lunak editing" },
  { code: "V.06", title: "Menyunting audio dan atau video sesuai tuntutan naskah" },
  { code: "V.07", title: "Melakukan penambahan efek visual" },
  { code: "V.08", title: "Melakukan export hasil editing" },
  { code: "V.09", title: "Menerapkan prosedur kendali mutu hasil editing" },
  { code: "V.10", title: "Melakukan komunikasi di tempat kerja" },
  { code: "V.11", title: "Membangun kerjasama dengan klien" },
];
