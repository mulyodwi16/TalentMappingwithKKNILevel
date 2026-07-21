import test from "node:test";
import assert from "node:assert/strict";
import { planCoverage, coveragePct } from "../../client/src/lib/planprogress.js";

// Progres Learning Path harus mencerminkan CAKUPAN kompetensi, bukan langkah tematik.
// Tes ini mengunci bug nyata: 11/62 unit lulus tapi rencana tampak 83% karena menghitung
// "10 dari 12 langkah".

test("cakupan = unit dikuasai / total unit kompetensi", () => {
  const c = planCoverage({ passedUnits: new Array(11), competency: { unitCount: 62 } });
  assert.equal(c.mastered, 11);
  assert.equal(c.total, 62);
  assert.equal(c.pct, 18);
});

test("kasus dari layar owner: 11/62 TIDAK boleh terbaca hampir tuntas", () => {
  const c = planCoverage({ passedUnits: new Array(11), competency: { unitCount: 62 } });
  assert.ok(c.pct < 25, `cakupan ${c.pct}% seharusnya jauh dari penuh, bukan 83%`);
});

test("seluruh unit dikuasai = 100%", () => {
  assert.equal(planCoverage({ passedUnits: new Array(62), competency: { unitCount: 62 } }).pct, 100);
});

test("belum ada unit lulus = 0%, bukan NaN", () => {
  const c = planCoverage({ passedUnits: [], competency: { unitCount: 62 } });
  assert.equal(c.pct, 0);
  assert.equal(c.known, true);
});

test("kompetensi belum ter-cache: total tak diketahui (known=false)", () => {
  const c = planCoverage({ passedUnits: new Array(3) });
  assert.equal(c.total, 0);
  assert.equal(c.known, false);
  assert.equal(c.pct, 0);
});

test("payload kosong tidak melempar", () => {
  const c = planCoverage(null);
  assert.equal(c.mastered, 0);
  assert.equal(c.known, false);
});

test("coveragePct membulatkan dan menjaga rentang 0-100", () => {
  assert.equal(coveragePct(1, 3), 33);
  assert.equal(coveragePct(2, 3), 67);
  assert.equal(coveragePct(0, 0), 0);
  assert.equal(coveragePct(99, 10), 100, "data rusak tak boleh melewati 100");
});
