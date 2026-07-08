import { Sun, Moon } from "lucide-react";
import { useLang } from "../lib/i18n.jsx";
import useIsDark from "../lib/useIsDark.js";
import { applyTheme } from "../lib/theme.js";

// Toggle mode gelap/terang untuk halaman PRA-LOGIN (Login/Register). #9: hanya sesi — tak persist
// ke key global & tak menyentuh preferensi akun. Boot selalu default biru navy; toggle ini sementara.
export default function ThemeToggle({ className = "" }) {
  const { t } = useLang();
  const dark = useIsDark();

  return (
    <button
      onClick={() => applyTheme(dark ? "light" : "dark")}
      title={dark ? t("Mode terang") : t("Mode gelap")}
      aria-label={dark ? t("Mode terang") : t("Mode gelap")}
      className={`p-2 rounded-xl transition-colors ${className}`}
      style={{ color: "var(--text-3)", border: "1px solid var(--border)", background: "var(--bg-surface)" }}
    >
      {dark ? <Sun size={16} /> : <Moon size={16} />}
    </button>
  );
}
