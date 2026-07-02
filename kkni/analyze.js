// SKKNI gap analysis: load static chunks -> retrieve relevant units -> LLM.
// Never re-parses the PDF; only the top-k relevant units go to the model (token-cheap).
// Env: OPENROUTER_API_KEY (required), OPENROUTER_MODEL (default deepseek-chat).
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const HERE = dirname(fileURLToPath(import.meta.url));

export function loadDoc(profesi = "video-editing") {
  return JSON.parse(readFileSync(join(HERE, profesi, "skkni.json"), "utf8"));
}

const tokenize = (s) => (s.toLowerCase().match(/[a-z0-9]+/g) || []).filter((w) => w.length > 2);

// ponytail: keyword overlap over ~11 units. Add embeddings only if corpus hits 100s of docs.
export function retrieve(query, doc, k = 3) {
  const q = new Set(tokenize(query));
  return doc.units
    .map((u) => {
      const hay = tokenize(`${u.judul} ${u.deskripsi} ${u.elemen.join(" ")} ${u.text}`);
      let score = 0;
      for (const w of hay) if (q.has(w)) score++;
      return { unit: u, score };
    })
    .filter((r) => r.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, k)
    .map((r) => r.unit);
}

export async function analyze({ profile, query, profesi = "video-editing", k = 3 }) {
  const key = process.env.OPENROUTER_API_KEY;
  if (!key) throw new Error("OPENROUTER_API_KEY not set (see .env.example)");
  const model = process.env.OPENROUTER_MODEL || "deepseek/deepseek-chat";

  const doc = loadDoc(profesi);
  const units = retrieve(query || profile, doc, k);
  if (!units.length) throw new Error("no relevant SKKNI units matched the query");

  const context = units
    .map((u) => `### ${u.kode} — ${u.judul}\n${u.deskripsi}\nElemen: ${u.elemen.join("; ")}`)
    .join("\n\n");

  const prompt = `Anda asesor kompetensi SKKNI (${doc.profesi}).
Bandingkan profil pekerja dengan unit kompetensi berikut. Untuk tiap unit, nilai
apakah pekerja SUDAH / BELUM kompeten, sebutkan skill gap-nya, dan beri satu
rekomendasi belajar singkat. Jawab ringkas per unit.

UNIT KOMPETENSI RELEVAN:
${context}

PROFIL PEKERJA:
${profile}`;

  const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({ model, messages: [{ role: "user", content: prompt }] }),
  });
  if (!res.ok) throw new Error(`OpenRouter ${res.status}: ${await res.text()}`);
  const data = await res.json();
  return { model, used_units: units.map((u) => u.kode), analysis: data.choices[0].message.content };
}

// --- runnable check: retrieval must rank the right unit without any API call ---
function selfCheck() {
  const doc = loadDoc();
  console.assert(doc.units.length === 11, "expected 11 units");
  const hits = retrieve("menyunting audio dan video sesuai naskah", doc, 3);
  console.assert(hits.some((u) => u.kode === "J.591200.008.01"), "editing query must hit unit 008");
  const k3 = retrieve("keselamatan kesehatan kerja K3", doc, 2);
  console.assert(k3[0].kode === "J.591200.001.01", "K3 query must rank unit 001 first");
  console.log("selfCheck OK — retrieved:", hits.map((u) => u.kode).join(", "));
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const arg = process.argv[2];
  if (arg === "check" || !arg) { selfCheck(); }
  else {
    // demo: node analyze.js "profil pekerja..." "query opsional"
    analyze({ profile: arg, query: process.argv[3] })
      .then((r) => { console.log("model:", r.model, "\nunits:", r.used_units.join(", "), "\n\n", r.analysis); })
      .catch((e) => { console.error("ERROR:", e.message); process.exit(1); });
  }
}
