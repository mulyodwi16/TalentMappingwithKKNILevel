import test from "node:test";
import assert from "node:assert/strict";
import { bridgeMissingSkills, matchJobDeep, matchJob } from "../jobmatch.js";

// Jembatan AI menutup celah yang NYATA dilaporkan pengguna: nama unit SKKNI panjang &
// formal, syarat posisi singkat & pasar, jadi pencocokan kata melewatkannya dan kompetensi
// yang SUDAH lulus terbaca "belum ada bukti". Diuji dengan LLM yang disuntik - menembak LLM
// sungguhan berarti biaya nyata & hasil tak deterministik.
//
// Yang dijaga di sini justru penjaganya: AI TIDAK boleh menaikkan skor dengan mengarang.

const UNITS = [
  "Menerapkan prinsip kerja sama dalam tim di lingkungan kerja",
  "Menyunting audio dan atau video sesuai tuntutan naskah",
];

// AI yang "benar": memetakan syarat pasar ke unit resmi yang setara.
const askBenar = async (_units, reqs) =>
  reqs.map((s) => {
    if (/kerja ?sama|tim/i.test(s)) return { syarat: s, unit: UNITS[0], alasan: "unit kerja sama tim mencakup ini" };
    return { syarat: s, unit: null, alasan: "tak ada unit setara" };
  });

test("syarat pasar dipetakan ke unit SKKNI yang setara", async () => {
  const out = await bridgeMissingSkills(["Bisa bekerjasama dalam tim"], UNITS, "id", askBenar);
  assert.equal(out.size, 1, "syarat kerja sama harusnya terjembatani");
  assert.equal(out.get("Bisa bekerjasama dalam tim").unit, UNITS[0]);
});

test("HALUSINASI ditolak: unit yang tak ada di daftar tervalidasi tidak diakui", async () => {
  // Inti pertahanannya. Kalau AI menyebut unit yang tak dimiliki pengguna, jawabannya harus
  // dibuang - tanpa ini satu karangan langsung menaikkan skor kecocokan.
  // Skill unik per tes: cache jembatan berlaku modul-level (benar di produksi, tapi antar-tes
  // memakai kunci sama akan saling mengembalikan hasil tes lain).
  const askNgarang = async (_u, reqs) => reqs.map((s) => ({ syarat: s, unit: "Unit Yang Tidak Pernah Dilulusi", alasan: "ngawur" }));
  const out = await bridgeMissingSkills(["Skill karangan HRD"], UNITS, "id", askNgarang);
  assert.equal(out.size, 0, "unit karangan tak boleh diterima");
});

test("AI yang menjawab 'tidak tercakup' tidak memberi pengakuan", async () => {
  const askTolak = async (_u, reqs) => reqs.map((s) => ({ syarat: s, unit: null, alasan: "beda konteks" }));
  const out = await bridgeMissingSkills(["Menguasai Adobe Premiere"], UNITS, "id", askTolak);
  assert.equal(out.size, 0);
});

test("AI gagal → perilaku lama (deterministik), bukan galat", async () => {
  const askError = async () => { throw new Error("LLM tumbang"); };
  const out = await bridgeMissingSkills(["apa saja"], UNITS, "id", askError);
  assert.equal(out.size, 0, "kegagalan AI harus jatuh ke kosong, bukan melempar");
});

test("balasan bukan array tidak merusak apa pun", async () => {
  const out = await bridgeMissingSkills(["apa saja"], UNITS, "id", async () => ({ bukan: "array" }));
  assert.equal(out.size, 0);
});

test("matchJobDeep menaikkan skor lewat unit setara, tetap butuh bukti ujian", async () => {
  // Syarat unik + unit unik → kunci cache tak bertabrakan dengan tes lain.
  const UNIT_TIM = "Menerapkan koordinasi lintas fungsi dalam proyek produksi";
  const job = { skills: ["Kolaborasi antar divisi"], certifications: [], kkniLevel: 3, minExperience: 0 };
  const profile = { validatedSkills: [UNIT_TIM], certifications: [], level: 6, experience: 2 };
  const ask = async (_u, reqs) => reqs.map((s) => ({ syarat: s, unit: UNIT_TIM, alasan: "koordinasi lintas fungsi" }));

  // Baseline via matchJob langsung - JANGAN pakai matchJobDeep dengan ask kosong, itu
  // menuliskan hasil negatif ke cache jembatan dan membuat panggilan kedua tak pernah bertanya.
  const dangkal = matchJob(job, profile);
  assert.equal(dangkal.matchedSkills.length, 0, "tanpa jembatan: syarat tak terdeteksi (bug lama)");

  const dalam = await matchJobDeep(job, profile, "id", ask);
  assert.ok(dalam.score > dangkal.score, "jembatan harus menaikkan skor");
  assert.ok((dalam.bridged || []).some((b) => b.unit === UNIT_TIM), "harus menyebut unit sumbernya");
  // Bukti tetap dari ujian: yang dijembatani pun berasal dari unit yang LULUS, bukan klaim CV.
  assert.equal(dalam.missingSkills.length, 0, "syarat yang terjembatani keluar dari daftar 'belum ada bukti'");
});

test("tanpa unit tervalidasi, tak ada yang bisa dijembatani", async () => {
  const out = await bridgeMissingSkills(["apa saja"], [], "id", askBenar);
  assert.equal(out.size, 0, "AI tak boleh dipanggil kalau pengguna belum lulus unit apa pun");
});
