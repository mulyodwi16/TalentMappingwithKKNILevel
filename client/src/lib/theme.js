// Kustomisasi warna aksen (brand) — menyetel html[data-accent] yang menimpa CSS var
// --brand-*/--tosca-* (lihat index.css). Disimpan di localStorage & diterapkan saat boot.
export const ACCENTS = [
  { key: "indigo",  label: "Indigo", color: "#6366f1" },
  { key: "sky",     label: "Biru",   color: "#0ea5e9" },
  { key: "emerald", label: "Hijau",  color: "#10b981" },
  { key: "amber",   label: "Amber",  color: "#f59e0b" },
  { key: "rose",    label: "Rose",   color: "#f43f5e" },
];

export function getAccent() {
  const k = localStorage.getItem("accent");
  return ACCENTS.some((a) => a.key === k) ? k : "indigo";
}

export function applyAccent(key) {
  const k = ACCENTS.some((a) => a.key === key) ? key : "indigo";
  if (k === "indigo") document.documentElement.removeAttribute("data-accent");
  else document.documentElement.setAttribute("data-accent", k);
  localStorage.setItem("accent", k);
}
