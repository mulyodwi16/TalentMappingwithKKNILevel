import test from "node:test";
import assert from "node:assert/strict";
import { groupByCategory, radarSeries, RADAR_UNIT_CAP, CATEGORY_ORDER } from "../../client/src/lib/skillgroups.js";
import { UNIT_CATEGORIES } from "../unitrank.js";

// Pengelompokan Skill Gap. Yang dijaga: radar tetap terbaca saat unitnya banyak, dan
// urutan kelompok konsisten dengan tangga rank di server.

const a = (score, gap, category, name = "Unit") => ({
  currentScore: score, requiredScore: 100, gap, category, competencyName: name, competencyCode: name,
});

test("urutan kategori klien sama dengan server", () => {
  assert.deepEqual(CATEGORY_ORDER, UNIT_CATEGORIES);
});

test("sedikit unit: radar per-unit, tidak digabung", () => {
  const items = [a(80, 20, "dasar"), a(50, 50, "teknikal")];
  const r = radarSeries(items);
  assert.equal(r.grouped, false);
  assert.equal(r.data.length, 2);
});

test("banyak unit: radar digabung per kelompok", () => {
  const items = Array.from({ length: RADAR_UNIT_CAP + 5 }, (_, i) =>
    a(60, 40, CATEGORY_ORDER[i % 3]));
  const r = radarSeries(items);
  assert.equal(r.grouped, true);
  assert.ok(r.data.length <= 3, "paling banyak 3 titik (satu per kelompok)");
});

test("radar gabungan memakai rata-rata nilai kelompok", () => {
  const items = [
    ...Array(10).fill(0).map(() => a(100, 0, "dasar")),
    ...Array(10).fill(0).map(() => a(0, 100, "teknikal")),
  ];
  const r = radarSeries(items, 5);
  const dasar = r.data.find((d) => d.label.includes("Dasar"));
  const tek = r.data.find((d) => d.label.includes("Teknikal"));
  assert.equal(dasar.aktual, 100);
  assert.equal(tek.aktual, 0);
});

test("groupByCategory menghitung ringkasan tiap kelompok", () => {
  const items = [a(80, 20, "dasar"), a(40, 60, "dasar"), a(90, 10, "teknikal")];
  const g = groupByCategory(items);
  const dasar = g.find((x) => x.key === "dasar");
  assert.equal(dasar.total, 2);
  assert.equal(dasar.avg, 60);
  assert.equal(dasar.mastered, 1, "hanya yang >=60");
  assert.equal(dasar.gaps, 2);
});

test("unit dalam kelompok terurut gap terbesar dulu", () => {
  const items = [a(90, 10, "teknikal", "kecil"), a(20, 80, "teknikal", "besar")];
  const g = groupByCategory(items);
  assert.equal(g[0].items[0].competencyName, "besar");
});

test("kelompok kosong tidak muncul", () => {
  const g = groupByCategory([a(50, 50, "teknikal")]);
  assert.equal(g.length, 1);
  assert.equal(g[0].key, "teknikal");
});

test("kelompok selalu urut: dasar, teknikal, lanjutan", () => {
  const items = [a(50, 50, "lanjutan"), a(50, 50, "dasar"), a(50, 50, "teknikal")];
  const g = groupByCategory(items);
  assert.deepEqual(g.map((x) => x.key), ["dasar", "teknikal", "lanjutan"]);
});

test("kategori tak dikenal jatuh ke teknikal, bukan hilang", () => {
  const g = groupByCategory([a(50, 50, "ngawur"), a(50, 50, null)]);
  assert.equal(g.length, 1);
  assert.equal(g[0].key, "teknikal");
  assert.equal(g[0].total, 2);
});

test("daftar kosong tidak melempar", () => {
  assert.deepEqual(groupByCategory([]), []);
  assert.deepEqual(radarSeries([]).data, []);
});

test("nilai yang hilang dianggap nol, bukan NaN", () => {
  const g = groupByCategory([{ category: "dasar" }]);
  assert.equal(g[0].avg, 0);
  assert.ok(Number.isInteger(g[0].avg));
});
