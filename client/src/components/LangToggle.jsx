import { Languages } from "lucide-react";
import { useLang, LANGS } from "../lib/i18n.jsx";

// Pemilih bahasa ringkas (ID | EN) untuk halaman sebelum login (Login/Register/Landing).
// Setelah login, pilihan bahasa ada di dropdown profil Topbar.
export default function LangToggle({ className = "" }) {
  const { lang, setLang } = useLang();
  return (
    <div className={`inline-flex items-center gap-1 rounded-full border px-1.5 py-1 backdrop-blur ${className}`}
      style={{ borderColor: "var(--border)", backgroundColor: "var(--bg-surface)" }}>
      <Languages size={13} style={{ color: "var(--text-4)" }} />
      {LANGS.map((l) => (
        <button
          key={l.key}
          onClick={() => setLang(l.key)}
          className={`text-[11px] font-semibold rounded-full px-2 py-0.5 transition-colors ${
            lang === l.key ? "bg-brand-600 text-white" : "hover:bg-[var(--bg-muted)]"
          }`}
          style={lang === l.key ? {} : { color: "var(--text-3)" }}
        >
          {l.short}
        </button>
      ))}
    </div>
  );
}
