import test from "node:test";
import assert from "node:assert/strict";
import { matchJob, safeArr } from "../jobmatch.js";

// Pencocokan posisi memutuskan siapa yang disebut "memenuhi syarat" ke perekrut. Dua
// kegagalan yang mahal: menyebut orang layak padahal belum terbukti (positif palsu), dan
// tak mengakui kompetensi yang SUDAH dibuktikan lewat ujian (negatif palsu).

const profil = ({ level = 6, experience = 3, validated = [], claimed = [], certs = [] } = {}) => ({
  level, experience, validatedSkills: validated, claimedSkills: claimed, certifications: certs,
});
const posisi = ({ kkniLevel = 6, minExperience = 0, skills = [], certifications = [] } = {}) => ({
  kkniLevel, minExperience, skills, certifications,
});

test("posisi tanpa daftar skill TIDAK menyatakan siapa pun memenuhi syarat", () => {
  // Bug nyata: skill & sertifikat yang tak dicantumkan dulu diberi poin PENUH, sehingga
  // seluruh kolam talenta terbaca 85-100% dan eligible - corong, ekspor, dan teks undangan
  // ikut salah semua.
  const m = matchJob(posisi({ skills: [] }), profil());
  assert.equal(m.eligible, false);
  assert.equal(m.readyToValidate, false);
  assert.equal(m.requirementsSet, false);
});

test("skill yang tervalidasi ujian membuat kandidat memenuhi syarat", () => {
  const m = matchJob(
    posisi({ skills: ["Menyunting Audio/Video", "Export Hasil Editing"] }),
    profil({ validated: ["Menyunting audio dan atau video sesuai tuntutan naskah", "Melakukan export hasil editing"] }),
  );
  assert.equal(m.missingSkills.length, 0);
  assert.equal(m.eligible, true);
  assert.equal(m.score, 100);
});

test("skill yang hanya DIKLAIM di CV tidak cukup untuk memenuhi syarat", () => {
  const m = matchJob(
    posisi({ skills: ["Menyunting Audio/Video"] }),
    profil({ claimed: ["Menyunting Audio/Video"] }),
  );
  assert.equal(m.eligible, false);
  assert.equal(m.readyToValidate, true, "harus ditandai tinggal diuji");
  assert.equal(m.claimedSkills.length, 1);
});

test("klaim CV bernilai TEPAT setengah dari skill tervalidasi", () => {
  // Diuji sebagai jarak, bukan angka mutlak: skor dinormalkan terhadap syarat yang
  // dicantumkan posisi, jadi nilai absolutnya berubah bila posisi menambah syarat sertifikat.
  // Yang harus tetap benar adalah klaim duduk PERSIS di tengah antara tanpa bukti dan bukti ujian.
  const p = posisi({ skills: ["A yang panjang", "B yang panjang"] });
  const kosong = matchJob(p, profil()).score;
  const klaim = matchJob(p, profil({ claimed: ["A yang panjang", "B yang panjang"] })).score;
  const penuh = matchJob(p, profil({ validated: ["A yang panjang", "B yang panjang"] })).score;
  assert.ok(kosong < klaim && klaim < penuh, `urutan skor salah: ${kosong} / ${klaim} / ${penuh}`);
  // Toleransi 1 poin karena skor dibulatkan ke bilangan bulat.
  assert.ok(Math.abs((klaim - kosong) - (penuh - klaim)) <= 1, `klaim harus di tengah: ${kosong} / ${klaim} / ${penuh}`);
});

test("nama unit SKKNI panjang tetap cocok dengan syarat posisi yang singkat", () => {
  // Bug nyata: pencocokan substring saja melewatkan pasangan ini, sehingga kompetensi yang
  // sudah dibuktikan terbaca "belum ada bukti".
  const m = matchJob(
    posisi({ skills: ["Menyunting Audio/Video"] }),
    profil({ validated: ["Menyunting audio dan atau video sesuai tuntutan naskah"] }),
  );
  assert.equal(m.matchedSkills.length, 1);
});

test("skill yang benar-benar berbeda TIDAK dianggap cocok", () => {
  // Penjaga positif palsu. Kalau ambangnya dilonggarkan, tes ini yang jatuh lebih dulu.
  const m = matchJob(
    posisi({ skills: ["Menguasai aplikasi Resolume Arena"] }),
    profil({ validated: ["Menyunting audio dan atau video sesuai tuntutan naskah"] }),
  );
  assert.equal(m.missingSkills.length, 1);
  assert.equal(m.eligible, false);
});

test("kata umum tidak boleh jadi jembatan kecocokan", () => {
  const m = matchJob(
    posisi({ skills: ["Melakukan pemeriksaan instalasi listrik"] }),
    profil({ validated: ["Melakukan penyuntingan naskah video"] }),
  );
  assert.equal(m.matchedSkills.length, 0, '"melakukan" tak boleh mencocokkan dua hal berbeda');
});

test("rank di bawah syarat menutup kelayakan dan menurunkan skor", () => {
  const p = posisi({ kkniLevel: 6, skills: ["Menyunting Audio/Video"] });
  const kurang = matchJob(p, profil({ level: 4, validated: ["Menyunting Audio/Video"] }));
  assert.equal(kurang.levelOk, false);
  assert.equal(kurang.eligible, false);
  assert.equal(kurang.levelGap, 2);
  assert.ok(kurang.score < 100);
});

test("pengalaman kurang menutup kelayakan", () => {
  const m = matchJob(
    posisi({ minExperience: 5, skills: ["Menyunting Audio/Video"] }),
    profil({ experience: 1, validated: ["Menyunting Audio/Video"] }),
  );
  assert.equal(m.expOk, false);
  assert.equal(m.eligible, false);
  assert.equal(m.expGap, 4);
});

test("skor selalu di rentang 0-100 walau masukannya ekstrem", () => {
  const jauh = matchJob(
    posisi({ kkniLevel: 9, minExperience: 20, skills: ["X yang panjang sekali"] }),
    profil({ level: 1, experience: 0 }),
  );
  assert.ok(jauh.score >= 0 && jauh.score <= 100, `skor ${jauh.score} di luar rentang`);
});

test("kolom JSON boleh berupa string maupun array", () => {
  // shapeJob sudah mengurai, tapi pemanggil lain kadang mengirim string mentah.
  const m = matchJob(
    { kkniLevel: 6, minExperience: 0, skills: '["Menyunting Audio/Video"]', certifications: "[]" },
    profil({ validated: ["Menyunting Audio/Video"] }),
  );
  assert.equal(m.eligible, true);
});

test("safeArr tak melempar untuk JSON rusak", () => {
  assert.deepEqual(safeArr("bukan json"), []);
  assert.deepEqual(safeArr(null), []);
  assert.deepEqual(safeArr('{"a":1}'), [], "objek bukan array");
});
