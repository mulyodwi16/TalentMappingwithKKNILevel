import { createContext, useContext, useEffect, useMemo, useState } from "react";
import api from "../api/client.js";
import EN from "./translations.en.js";

// ============================================================
// Bahasa UI: "id" (default) & "en".
// Pola kamus: TEKS INDONESIA DI KODE = KUNCI KAMUS.
//   t("Peta Posisi") → "Position Map" saat lang=en,
//   fallback ke teks Indonesia bila belum ada terjemahan
//   (migrasi bertahap aman - halaman yang belum digarap tetap tampil ID).
// Interpolasi: t("Selamat datang, {name}!", { name }) - placeholder {x}.
// Pilihan bahasa juga dikirim ke server (header X-Lang) → server memilih
// prompt AI versi ID/EN (pola sama dengan get_system_prompt(lang) di MBTI Game).
// ============================================================

const KEY = "talenta.lang";

export const LANGS = [
  { key: "id", label: "Indonesia", short: "ID" },
  { key: "en", label: "English",   short: "EN" },
];

export function getLang() {
  return localStorage.getItem(KEY) === "en" ? "en" : "id";
}

function applyLang(lang) {
  // Semua request axios membawa bahasa aktif → prompt AI mengikuti.
  api.defaults.headers.common["X-Lang"] = lang;
  document.documentElement.lang = lang;
}

// Terapkan sejak modul dimuat agar request pertama (sebelum React mount) ikut benar.
applyLang(getLang());

const LangContext = createContext({ lang: "id", t: (s) => s, setLang: () => {} });

export function LangProvider({ children }) {
  const [lang, setLang] = useState(getLang);

  useEffect(() => {
    localStorage.setItem(KEY, lang);
    applyLang(lang);
  }, [lang]);

  // useMemo: identitas t stabil selama bahasa sama → aman dipakai sebagai dependency effect.
  const value = useMemo(() => {
    const t = (s, vars) => {
      let out = lang === "en" ? (EN[s] ?? s) : s;
      if (vars) for (const [k, v] of Object.entries(vars)) out = out.replaceAll(`{${k}}`, String(v));
      return out;
    };
    return { lang, t, setLang };
  }, [lang]);

  return <LangContext.Provider value={value}>{children}</LangContext.Provider>;
}

export const useLang = () => useContext(LangContext);

// Locale untuk tanggal/angka mengikuti bahasa aktif.
export function dateLocale(lang) { return lang === "en" ? "en-US" : "id-ID"; }
