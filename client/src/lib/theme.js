// Kustomisasi tampilan (mode gelap/terang + warna aksen). #9: tema DEFAULT = biru navy dan
// berlaku di SEMUA halaman termasuk pra-login (beranda/login/daftar). Kustomisasi warna aksen &
// mode adalah OPSI PER-AKUN — hanya diterapkan saat user login (dari DB), TIDAK disimpan di key
// global localStorage, sehingga tak bocor ke halaman pra-login maupun antar-akun.

// Aksen "blue" = basis CSS di index.css (tanpa atribut data-accent) = biru navy (default).
export const DEFAULT_ACCENT = "blue";
export const DEFAULT_THEME = "dark"; // mode default = navy (gelap)

export const ACCENTS = [
  { key: "blue",    label: "Biru Navy", color: "#2563eb" }, // default (basis, tanpa data-accent)
  { key: "indigo",  label: "Indigo",    color: "#6366f1" },
  { key: "sky",     label: "Biru Langit", color: "#0ea5e9" },
  { key: "emerald", label: "Hijau",     color: "#10b981" },
  { key: "amber",   label: "Amber",     color: "#f59e0b" },
  { key: "rose",    label: "Rose",      color: "#f43f5e" },
];

const validAccent = (key) => (ACCENTS.some((a) => a.key === key) ? key : DEFAULT_ACCENT);

// Terapkan warna aksen ke <html>. "blue" (default) = hapus data-accent → pakai basis biru navy.
export function applyAccent(key) {
  const k = validAccent(key);
  if (k === DEFAULT_ACCENT) document.documentElement.removeAttribute("data-accent");
  else document.documentElement.setAttribute("data-accent", k);
}

// Terapkan mode gelap/terang ke <html> (kelas .dark). Tanpa nilai → mode default.
export function applyTheme(mode) {
  document.documentElement.classList.toggle("dark", (mode || DEFAULT_THEME) === "dark");
}

// Tampilan DEFAULT (biru navy). Dipakai di boot pra-login & saat logout — supaya kustomisasi
// akun tidak menetap di halaman umum.
export function applyDefaultTheme() {
  applyTheme(DEFAULT_THEME);
  applyAccent(DEFAULT_ACCENT);
}

// Terapkan preferensi tampilan tersimpan di AKUN (saat login, #9). Field null/kosong → pakai
// default (jangan biarkan warna custom bocor). Membuat tema mengikuti AKUN, bukan browser.
export function applyUserPrefs(user) {
  if (!user) return applyDefaultTheme();
  applyTheme(user.themeMode === "light" || user.themeMode === "dark" ? user.themeMode : DEFAULT_THEME);
  applyAccent(user.accent || DEFAULT_ACCENT);
}
