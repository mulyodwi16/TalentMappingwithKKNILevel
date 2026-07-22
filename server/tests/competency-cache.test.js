import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { COMPETENCY_SCOPED_KEYS } from "../../client/src/lib/competencyCache.js";

// Kompetensi target adalah akar semua angka di aplikasi ini. Kalau cache query yang
// bergantung padanya tidak dibuang saat kompetensi diganti, halaman yang belum dikunjungi
// ulang menampilkan angka kompetensi LAMA - dan itu terlihat meyakinkan, bukan seperti galat.
// Terjadi sungguhan: layar Tes Penempatan menyebut kompetensi lama berikut jumlah unit &
// durasinya, padahal server sudah menyusun soal untuk kompetensi yang baru.

const here = dirname(fileURLToPath(import.meta.url));
const src = join(here, "../../client/src");
const baca = (p) => readFileSync(join(src, p), "utf8");

test("daftar kunci tak kosong & tanpa kembar", () => {
  assert.ok(COMPETENCY_SCOPED_KEYS.length >= 8);
  assert.equal(new Set(COMPETENCY_SCOPED_KEYS).size, COMPETENCY_SCOPED_KEYS.length);
});

test("kunci yang paling sering salah tampil HARUS ada di daftar", () => {
  // Ini yang benar-benar menggigit pengguna: intro tes penempatan, daftar unit Kelas,
  // radar Skill Gap, dan rencana belajar semuanya menyebut kompetensi secara eksplisit.
  for (const k of ["placement", "kelas-units", "skill-assessments", "learning-path", "skkni-chosen", "overview"]) {
    assert.ok(COMPETENCY_SCOPED_KEYS.includes(k), `kunci "${k}" wajib ikut dibuang saat kompetensi berganti`);
  }
});

test("SkkniPicker membuang cache di SEMUA jalur penggantian kompetensi", () => {
  const s = baca("components/SkkniPicker.jsx");
  assert.match(s, /invalidateCompetencyScoped/, "picker harus memanggil pembuang cache");

  // `selectOnly` sengaja TIDAK ikut membuang cache: wizard Register menunda penyimpanan
  // sampai fase akhir, jadi belum ada apa pun yang berubah di server.
  assert.match(s, /if \(selectOnly\) \{ onChosen\(item\); return; \}/,
    "jalur wizard tetap memanggil onChosen langsung");
  // Selain jalur wizard dan pembungkus `selesai` itu sendiri, tak boleh ada pemanggilan
  // onChosen lain - itu berarti ada jalur yang melewati pembuangan cache.
  const jalur = s.match(/onChosen\(/g) || [];
  assert.equal(jalur.length, 2, "hanya wizard + pembungkus `selesai` yang boleh memanggil onChosen");
  assert.match(s, /const selesai = \(chosen\) => \{ invalidateCompetencyScoped\(qc\); onChosen\(chosen\); \};/);

  // Jalur "unit masih ditarik Kemnaker" gampang terlewat - dan justru itu yang dipakai
  // kompetensi yang baru pertama kali dipilih.
  assert.match(s, /onReady=\{\(\) => selesai\(/, "jalur layar tunggu harus ikut membuang cache");
  assert.match(s, /onSkip=\{\(\) => selesai\(/, "jalur 'lanjut saja' juga");
});

test("tiap kunci di daftar benar-benar dipakai sebagai queryKey di klien", () => {
  // Daftar yang berisi kunci karangan memberi rasa aman palsu: pemanggilan invalidate-nya
  // tak pernah mengenai apa pun.
  const berkas = [
    "pages/user/UserDashboard.jsx", "pages/user/Placement.jsx", "pages/user/FinalExam.jsx",
    "pages/user/Kelas.jsx", "pages/user/Exam.jsx", "pages/user/SkillGap.jsx",
    "pages/user/LearningPath.jsx", "pages/user/Profile.jsx", "components/JourneySummary.jsx",
    "pages/user/Jobs.jsx",
  ].map(baca).join("\n");

  for (const k of COMPETENCY_SCOPED_KEYS) {
    assert.ok(berkas.includes(`"${k}"`), `kunci "${k}" tak ditemukan sebagai queryKey mana pun`);
  }
});
