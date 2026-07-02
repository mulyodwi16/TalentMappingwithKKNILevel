import { useState, useEffect } from "react";
import { useLocation } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Bell, Sun, Moon, Menu } from "lucide-react";
import api from "../api/client.js";
import useAuthStore from "../store/authStore.js";

const TITLES = {
  "/app/dashboard":       "Dashboard",
  "/app/cv-upload":       "Upload CV",
  "/app/exam":            "Ujian Kompetensi",
  "/app/skill-gap":       "Skill Gap Analyzer",
  "/app/learning-path":   "Learning Path",
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
  const { user } = useAuthStore();
  const [showNotif, setShowNotif] = useState(false);
  const [dark, setDark] = useState(() => localStorage.getItem("theme") === "dark");
  const qc = useQueryClient();

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
    const close = () => setShowNotif(false);
    if (showNotif) document.addEventListener("click", close);
    return () => document.removeEventListener("click", close);
  }, [showNotif]);

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
        aria-label="Buka menu"
      >
        <Menu size={20} />
      </button>

      {/* Page title */}
      <h1 className="flex-1 text-sm font-semibold truncate" style={{ color: "var(--text-base)" }}>
        {TITLES[pathname] || "KKNI Talent"}
      </h1>

      {/* Theme toggle */}
      <button
        onClick={() => setDark((d) => !d)}
        title={dark ? "Mode terang" : "Mode gelap"}
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
          aria-label="Notifikasi"
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
              <p className="text-sm font-semibold" style={{ color: "var(--text-base)" }}>Notifikasi</p>
              {unread > 0 && (
                <button onClick={() => markAll.mutate()} className="text-xs text-brand-600 hover:text-brand-700">
                  Tandai semua dibaca
                </button>
              )}
            </div>
            <div className="max-h-72 overflow-y-auto">
              {notifs.length === 0 ? (
                <p className="text-sm p-4 text-center" style={{ color: "var(--text-4)" }}>Tidak ada notifikasi</p>
              ) : (
                notifs.slice(0, 10).map((n) => (
                  <div key={n.id} className="px-4 py-3 text-sm" style={{ borderBottom: "1px solid var(--border)", opacity: n.read ? 0.6 : 1 }}>
                    <p className="font-medium mb-0.5 text-brand-600 capitalize">{n.type.replace(/_/g, " ")}</p>
                    <p className="text-xs" style={{ color: "var(--text-2)" }}>{n.message}</p>
                    <p className="text-xs mt-1" style={{ color: "var(--text-4)" }}>{new Date(n.createdAt).toLocaleString("id-ID")}</p>
                  </div>
                ))
              )}
            </div>
          </div>
        )}
      </div>

      {/* Avatar */}
      <div
        className="w-8 h-8 rounded-full bg-gradient-to-br from-brand-600 to-tosca-500 flex items-center justify-center text-xs font-bold text-white flex-shrink-0"
        title={user?.name}
      >
        {user?.name?.[0]?.toUpperCase() || "?"}
      </div>
    </header>
  );
}
