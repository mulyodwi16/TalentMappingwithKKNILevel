import { useState, useEffect } from "react";
import { useLocation, useNavigate, Link } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Bell, Sun, Moon, Menu, UserCircle, LogOut, Palette, Check, Languages } from "lucide-react";
import api from "../api/client.js";
import useAuthStore from "../store/authStore.js";
import CoinPill from "./CoinPill.jsx";
import HelpButton from "./HelpButton.jsx";
import { ACCENTS, getAccent, applyAccent } from "../lib/theme.js";
import { useLang, LANGS, dateLocale } from "../lib/i18n.jsx";

const ROLE_LABEL = { user: "Talenta", hrd: "HRD", admin: "Admin" };

const TITLES = {
  "/app/dashboard":       "Dashboard",
  "/app/cv-upload":       "Upload CV",
  "/app/exam":            "Ujian Kompetensi",
  "/app/skill-gap":       "Skill Gap Analyzer",
  "/app/learning-path":   "Learning Path",
  "/app/mentor":          "AI Mentor Karier",
  "/app/toko":            "Toko & Kelas",
  "/app/jobs":            "Peta Posisi & Kesiapan",
  "/app/hrd/jobs":        "Peta Posisi & Talenta",
  "/app/admin/avataredu": "Course AvatarEdu",
  "/app/hrd":             "Dashboard HRD",
  "/app/admin":           "Dashboard Admin",
  "/app/admin/users":     "Manajemen Pengguna",
  "/app/admin/rules":     "Aturan Mapping",
  "/app/admin/questions": "Bank Soal",
  "/app/admin/requests":  "Inbox Request",
  "/app/admin/audit":     "Audit Log",
};

export default function Topbar({ onBurger }) {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const { lang, t, setLang } = useLang();
  const { user, logout } = useAuthStore();
  const [showNotif, setShowNotif] = useState(false);
  const [showProfile, setShowProfile] = useState(false);
  const [accent, setAccent] = useState(getAccent);
  const [dark, setDark] = useState(() => localStorage.getItem("theme") === "dark");
  const qc = useQueryClient();

  const pickAccent = (key) => { applyAccent(key); setAccent(key); };

  useEffect(() => {
    document.documentElement.classList.toggle("dark", dark);
    localStorage.setItem("theme", dark ? "dark" : "light");
  }, [dark]);

  const { data: notifs = [] } = useQuery({
    queryKey: ["notifications"],
    queryFn: () => api.get("/user/notifications"),
    enabled: !!user,
    refetchInterval: 30_000,
  });

  const markAll = useMutation({
    mutationFn: () => api.put("/user/notifications/read-all"),
    onSuccess: () => qc.invalidateQueries(["notifications"]),
  });

  const unread = notifs.filter((n) => !n.read).length;

  useEffect(() => {
    const close = () => { setShowNotif(false); setShowProfile(false); };
    if (showNotif || showProfile) document.addEventListener("click", close);
    return () => document.removeEventListener("click", close);
  }, [showNotif, showProfile]);

  const doLogout = () => { qc.clear(); logout(); navigate("/login"); };

  const iconBtn = "p-2 rounded-xl transition-colors hover:bg-brand-50";

  return (
    <header
      className="h-14 flex items-center px-4 sm:px-6 gap-2 sm:gap-3 sticky top-0 z-20"
      style={{ backgroundColor: "var(--bg-surface)", borderBottom: "1px solid var(--border)" }}
    >
      {/* Burger — mobile only */}
      <button
        onClick={onBurger}
        className={`lg:hidden ${iconBtn}`}
        style={{ color: "var(--text-3)" }}
        aria-label={t("Buka menu")}
      >
        <Menu size={20} />
      </button>

      {/* Page title */}
      <h1 className="flex-1 text-sm font-semibold truncate" style={{ color: "var(--text-base)" }}>
        {TITLES[pathname] ? t(TITLES[pathname]) : "TalentaAI"}
      </h1>

      {/* Koin (khusus User) */}
      {user?.role === "user" && <CoinPill />}

      {/* Bantuan / tur fitur (khusus User) */}
      <HelpButton />

      {/* Theme toggle */}
      <button
        onClick={() => setDark((d) => !d)}
        title={dark ? t("Mode terang") : t("Mode gelap")}
        className={iconBtn}
        style={{ color: "var(--text-3)" }}
      >
        {dark ? <Sun size={18} /> : <Moon size={18} />}
      </button>

      {/* Notification bell */}
      <div className="relative" onClick={(e) => e.stopPropagation()}>
        <button
          onClick={() => setShowNotif((v) => !v)}
          className={`${iconBtn} relative`}
          style={{ color: "var(--text-3)" }}
          aria-label={t("Notifikasi")}
        >
          <Bell size={18} />
          {unread > 0 && (
            <span className="absolute -top-0.5 -right-0.5 w-4 h-4 bg-red-500 rounded-full text-[10px] font-bold flex items-center justify-center text-white">
              {unread > 9 ? "9+" : unread}
            </span>
          )}
        </button>

        {showNotif && (
          <div className="absolute right-0 top-12 w-80 card z-50 overflow-hidden" style={{ padding: 0 }}>
            <div className="flex items-center justify-between px-4 py-3" style={{ borderBottom: "1px solid var(--border)" }}>
              <p className="text-sm font-semibold" style={{ color: "var(--text-base)" }}>{t("Notifikasi")}</p>
              {unread > 0 && (
                <button onClick={() => markAll.mutate()} className="text-xs text-brand-600 hover:text-brand-700">
                  {t("Tandai semua dibaca")}
                </button>
              )}
            </div>
            <div className="max-h-72 overflow-y-auto">
              {notifs.length === 0 ? (
                <p className="text-sm p-4 text-center" style={{ color: "var(--text-4)" }}>{t("Tidak ada notifikasi")}</p>
              ) : (
                notifs.slice(0, 10).map((n) => (
                  <div key={n.id} className="px-4 py-3 text-sm" style={{ borderBottom: "1px solid var(--border)", opacity: n.read ? 0.6 : 1 }}>
                    <p className="font-medium mb-0.5 text-brand-600 capitalize">{n.type.replace(/_/g, " ")}</p>
                    <p className="text-xs" style={{ color: "var(--text-2)" }}>{n.message}</p>
                    <p className="text-xs mt-1" style={{ color: "var(--text-4)" }}>{new Date(n.createdAt).toLocaleString(dateLocale(lang))}</p>
                  </div>
                ))
              )}
            </div>
          </div>
        )}
      </div>

      {/* Avatar + dropdown profil */}
      <div className="relative" onClick={(e) => e.stopPropagation()}>
        <button
          onClick={() => { setShowProfile((v) => !v); setShowNotif(false); }}
          className="w-8 h-8 rounded-full bg-gradient-to-br from-brand-600 to-tosca-500 flex items-center justify-center text-xs font-bold text-white flex-shrink-0 hover:ring-2 hover:ring-brand-400/50 transition-shadow"
          title={user?.name}
          aria-label={t("Menu profil")}
        >
          {user?.name?.[0]?.toUpperCase() || "?"}
        </button>

        {showProfile && (
          <div className="absolute right-0 top-12 w-64 card z-50 overflow-hidden" style={{ padding: 0 }}>
            {/* Identitas */}
            <div className="px-4 py-3 flex items-center gap-3" style={{ borderBottom: "1px solid var(--border)" }}>
              <div className="w-9 h-9 rounded-full bg-gradient-to-br from-brand-600 to-tosca-500 flex items-center justify-center text-sm font-bold text-white flex-shrink-0">
                {user?.name?.[0]?.toUpperCase() || "?"}
              </div>
              <div className="min-w-0">
                <p className="text-sm font-semibold truncate" style={{ color: "var(--text-base)" }}>{user?.name}</p>
                <p className="text-xs text-brand-600">{t(ROLE_LABEL[user?.role] || user?.role)}</p>
              </div>
            </div>

            {/* Menu */}
            <div className="py-1">
              <Link
                to="/app/profile"
                onClick={() => setShowProfile(false)}
                className="flex items-center gap-2.5 px-4 py-2.5 text-sm hover:bg-brand-50 transition-colors"
                style={{ color: "var(--text-2)" }}
              >
                <UserCircle size={16} /> {t("Profil Saya")}
              </Link>
            </div>

            {/* Pilihan bahasa UI (ID/EN) — juga menentukan bahasa jawaban AI */}
            <div className="px-4 py-3" style={{ borderTop: "1px solid var(--border)" }}>
              <p className="text-xs font-semibold mb-2 flex items-center gap-1.5" style={{ color: "var(--text-3)" }}>
                <Languages size={13} /> {t("Bahasa")}
              </p>
              <div className="grid grid-cols-2 gap-1.5">
                {LANGS.map((l) => (
                  <button
                    key={l.key}
                    onClick={() => setLang(l.key)}
                    className={`text-xs font-medium rounded-lg px-2 py-1.5 border transition-colors ${
                      lang === l.key ? "border-brand-500 bg-brand-600/10 text-brand-600" : "hover:border-slate-400"
                    }`}
                    style={lang === l.key ? {} : { borderColor: "var(--border)", color: "var(--text-3)" }}
                  >
                    {l.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Kustomisasi warna aksen */}
            <div className="px-4 py-3" style={{ borderTop: "1px solid var(--border)" }}>
              <p className="text-xs font-semibold mb-2 flex items-center gap-1.5" style={{ color: "var(--text-3)" }}>
                <Palette size={13} /> {t("Warna Tampilan")}
              </p>
              <div className="flex items-center gap-2">
                {ACCENTS.map((a) => (
                  <button
                    key={a.key}
                    onClick={() => pickAccent(a.key)}
                    title={a.label}
                    className="w-6 h-6 rounded-full flex items-center justify-center transition-transform hover:scale-110"
                    style={{ background: a.color, outline: accent === a.key ? "2px solid var(--text-base)" : "none", outlineOffset: "1px" }}
                    aria-label={t("Warna {label}", { label: a.label })}
                  >
                    {accent === a.key && <Check size={13} className="text-white" strokeWidth={3} />}
                  </button>
                ))}
              </div>
            </div>

            {/* Logout */}
            <div className="py-1" style={{ borderTop: "1px solid var(--border)" }}>
              <button
                onClick={doLogout}
                className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm hover:bg-red-50 hover:text-red-500 transition-colors"
                style={{ color: "var(--text-3)" }}
              >
                <LogOut size={16} /> {t("Keluar")}
              </button>
            </div>
          </div>
        )}
      </div>
    </header>
  );
}
