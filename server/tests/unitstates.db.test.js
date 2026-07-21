import test, { before, after } from "node:test";
import assert from "node:assert/strict";
import { siapkanDb, buatUser, buatKompetensi, beriNilai, UNIT_VIDEO } from "./helpers/db.js";

// unitStates memberi status Kelas & Ujian tiap unit. Yang diuji di sini adalah PENGUNCIAN
// BERJENJANG per tier rank (Fase 2): urutan mengikuti tangga, tier atas terkunci sampai tier
// bawah dikuasai, Tes Penempatan (nilai per unit) jadi jalur percepatan, dan Koin membuka
// SATU unit tanpa membuka seluruh tier.

let prisma, unitStates;

before(async () => {
  ({ prisma } = await siapkanDb("unitstates"));
  ({ unitStates } = await import("../skkni.js"));
});
after(async () => { await prisma.$disconnect(); });

async function talenta({ cap = 6 } = {}) {
  const u = await buatUser(prisma);
  const doc = await buatKompetensi(prisma, { units: UNIT_VIDEO, weightMaxRank: cap });
  await prisma.user.update({ where: { id: u.id }, data: { chosenSkkniId: doc } });
  return { user: u, doc };
}

const byTier = (states) => {
  const m = new Map();
  for (const s of states) { if (!m.has(s.tier)) m.set(s.tier, []); m.get(s.tier).push(s); }
  return m;
};
const tiersOf = (states) => [...byTier(states).keys()].sort((a, b) => a - b);

test("urutan mengikuti tangga rank: tier menaik & tiap unit punya tier", async () => {
  const { user, doc } = await talenta();
  const st = await unitStates(user.id, doc);
  assert.equal(st.length, UNIT_VIDEO.length);
  assert.ok(st.every((s) => typeof s.tier === "number"));
  const tiers = st.map((s) => s.tier);
  assert.deepEqual(tiers, [...tiers].sort((a, b) => a - b), "unit harus terurut per tier menaik");
});

test("pemula: hanya tier terendah terbuka, tier di atasnya terkunci", async () => {
  const { user, doc } = await talenta();
  const st = await unitStates(user.id, doc);
  const tiers = tiersOf(st);
  assert.ok(tiers.length > 1, "kompetensi ini harus punya beberapa tier");
  assert.ok(byTier(st).get(tiers[0]).every((s) => s.state !== "locked" && !s.tierLocked), "tier terendah terbuka");
  for (const t of tiers.slice(1)) {
    assert.ok(byTier(st).get(t).every((s) => s.state === "locked" && s.tierLocked), `tier ${t} harus terkunci di awal`);
  }
});

test("menguasai tier bawah membuka tier berikutnya (percepatan Tes Penempatan)", async () => {
  const { user, doc } = await talenta();
  let st = await unitStates(user.id, doc);
  const tiers = tiersOf(st);
  // Tes Penempatan menulis SkillAssessment per unit - simulasikan dengan meluluskan tier terbawah.
  for (const s of byTier(st).get(tiers[0])) await beriNilai(prisma, user.id, s.code, 100);
  st = await unitStates(user.id, doc);
  const grup = byTier(st);
  assert.ok(grup.get(tiers[0]).every((s) => s.state === "passed"));
  assert.ok(grup.get(tiers[1]).every((s) => !s.tierLocked), "tier kedua harus terbuka setelah tier pertama dikuasai");
});

test("tier atas tetap terkunci bila tier bawah belum tuntas", async () => {
  const { user, doc } = await talenta();
  let st = await unitStates(user.id, doc);
  const tiers = tiersOf(st);
  // Luluskan hanya SATU unit tier terbawah (belum mencapai ambang tolerance tier itu).
  const satu = byTier(st).get(tiers[0])[0];
  await beriNilai(prisma, user.id, satu.code, 100);
  st = await unitStates(user.id, doc);
  // Tier kedua masih terkunci (Gold belum lengkap → Platinum belum terbuka).
  assert.ok(byTier(st).get(tiers[1]).every((s) => s.tierLocked), "melompati tier tak boleh membuka tier atas");
});

test("Koin membuka SATU unit terkunci tanpa membuka seluruh tier", async () => {
  const { user, doc } = await talenta();
  let st = await unitStates(user.id, doc);
  const tiers = tiersOf(st);
  const atas = byTier(st).get(tiers[tiers.length - 1]);
  const target = atas[0];
  assert.equal(target.state, "locked");
  await prisma.unitProgress.create({ data: { userId: user.id, docId: doc, unitCode: target.code, unlockedByCoin: true } });
  st = await unitStates(user.id, doc);
  const after = st.find((s) => s.code === target.code);
  assert.equal(after.state, "ready", "unit yang dibuka Koin harus bisa diakses");
  assert.equal(after.tierLocked, true, "tier-nya tetap terkunci - Koin hanya membuka unit ini");
  if (atas.length > 1) {
    const sibling = st.find((s) => s.tier === target.tier && s.code !== target.code);
    assert.equal(sibling.state, "locked", "unit lain di tier itu tetap terkunci");
  }
});