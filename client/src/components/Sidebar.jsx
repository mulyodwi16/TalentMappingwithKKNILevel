import { useState } from "react";
import { NavLink, Link, useLocation } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import {
  LayoutDashboard, Upload, ClipboardCheck, Target, BookOpen,
  Users, Settings2, Mail, ScrollText, X, Bot, ShoppingBag, Compass,
  GraduationCap, ChevronDown,
} from "lucide-react";
import api from "../api/client.js";
import useAuthStore from "../store/authStore.js";
import Logo from "./Logo.jsx";
import { useLang } from "../lib/i18n.jsx";

// Item nav (Profil dipindah ke dropdown ikon profil di Topbar — #16).
const USER_MAIN   = { to: "/app/dashboard", label: "Dashboard", Icon: LayoutDashboard };
const USER_LEARN  = [
  { to: "/app/kelas",         label: "Kelas",         Icon: GraduationCap },
  { to: "/app/exam",          label: "Ujian",         Icon: ClipboardCheck },
  { to: "/app/skill-gap",     label: "Skill Gap",     Icon: Target },
  { to: "/app/learning-path", label: "Learning Path", Icon: BookOpen },
];
const USER_CAREER = [
  { to: "/app/cv-upload",     label: "Upload CV",     Icon: Upload },
  { to: "/app/mentor",        label: "AI Mentor",     Icon: Bot },
  { to: "/app/jobs",          label: "Peta Posisi",   Icon: Compass },
  { to: "/app/toko",          label: "Toko Koin",     Icon: ShoppingBag },
];
const HRD_ITEMS = [
  { to: "/app/hrd",      label: "Dashboard HRD", Icon: LayoutDashboard },
  { to: "/app/hrd/jobs", label: "Peta Posisi",   Icon: Compass },
];
const ADMIN_ITEMS = [
  { to: "/app/admin",           label: "Dashboard",       Icon: LayoutDashboard },
  { to: "/app/admin/users",     label: "Pengguna",        Icon: Users },
  { to: "/app/admin/rules",     label: "Aturan Mapping",  Icon: Settings2 },
  { to: "/app/admin/questions", label: "Bank Soal",       Icon: ClipboardCheck },
  { to: "/app/admin/requests",  label: "Inbox Request",   Icon: Mail },
  { to: "/app/admin/avataredu", label: "Course AvatarEdu",Icon: GraduationCap },
  { to: "/app/admin/audit",     label: "Audit Log",       Icon: ScrollText },
];

// Susunan nav per role: item lepas (flat) + grup dropdown.
function navFor(role) {
  if (role === "hrd") return { flat: HRD_ITEMS, groups: [] };
  if (role === "admin") return {
    flat: [],
    groups: [
      { key: "admin",   label: "Admin",   items: ADMIN_ITEMS },
      { key: "hrd",     label: "HRD",     items: HRD_ITEMS },
      { key: "talenta", label: "Talenta", items: [USER_MAIN, ...USER_LEARN, ...USER_CAREER] },
    ],
  };
  return {
    flat: [USER_MAIN],
    groups: [
      { key: "learn",  label: "Belajar & Ujian",  items: USER_LEARN },
      { key: "career", label: "Karier & Lainnya", items: USER_CAREER },
    ],
  };
}

const ROLE_LABEL = { user: "Talenta", hrd: "HRD", admin: "Admin" };

const linkClass = ({ isActive }) =>
  `flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 ${
    isActive ? "bg-brand-500 text-white shadow-lg shadow-brand-600/30" : "hover:bg-white/10"
  }`;
const linkStyle = ({ isActive }) => (isActive ? {} : { color: "var(--text-3)" });

function NavItem({ to, label, Icon, onNavigate }) {
  const { t } = useLang();
  return (
    <NavLink to={to} end className={linkClass} style={linkStyle} onClick={onNavigate}>
      {({ isActive }) => (<><Icon size={17} className={isActive ? "text-white" : ""} />{t(label)}</>)}
    </NavLink>
  );
}

// Grup nav collapsible (container dropdown).
function NavGroup({ group, activePath, onNavigate }) {
  const { t } = useLang();
  const hasActive = group.items.some((i) => activePath === i.to);
  const [open, setOpen] = useState(hasActive || false);
  return (
    <div>
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between px-3 py-1.5 text-[11px] font-bold uppercase tracking-wider hover:opacity-80"
        style={{ color: "var(--text-4)" }}
      >
        {t(group.label)}
        <ChevronDown size={13} className={`transition-transform ${open ? "" : "-rotate-90"}`} />
      </button>
      {open && (
        <div className="space-y-0.5 mt-0.5">
          {group.items.map((i) => <NavItem key={i.to} {...i} onNavigate={onNavigate} />)}
        </div>
      )}
    </div>
  );
}

export default function Sidebar({ open, onClose }) {
  const { t } = useLang();
  const { user } = useAuthStore();
  const { pathname } = useLocation();
  const role = user?.role || "user";
  const nav = navFor(role);

  // Foto & data akun (khusus User punya /user/overview; HRD/Admin pakai inisial).
  const { data: overview } = useQuery({
    queryKey: ["overview"],
    queryFn: () => api.get("/user/overview"),
    enabled: role === "user",
    staleTime: 60_000,
  });
  const p = overview?.profile;
  const avatarUrl = p?.avatarUrl;
  const subtitle = p?.position || p?.email || user?.email || "";

  return (
    <aside
      className={[
        "sidebar-dark w-60 h-screen flex flex-col flex-shrink-0",
        "fixed inset-y-0 left-0 z-40 lg:static lg:z-auto",
        "transition-transform duration-300 ease-out",
        open ? "translate-x-0" : "-translate-x-full lg:translate-x-0",
      ].join(" ")}
      style={{ backgroundColor: "var(--bg-surface)", borderRight: "1px solid var(--border)" }}
    >
      {/* Logo + close on mobile */}
      <div className="p-5 flex items-center justify-between" style={{ borderBottom: "1px solid var(--border)" }}>
        <Logo size={34} />
        <button onClick={onClose} className="lg:hidden p-1.5 rounded-lg hover:bg-white/10 hover:text-red-400 transition-colors" style={{ color: "var(--text-4)" }}>
          <X size={16} />
        </button>
      </div>

      {/* Kartu akun: foto + data (di bawah logo, di atas menu — #10) */}
      <div className="px-4 py-3" style={{ borderBottom: "1px solid var(--border)" }}>
        {(() => {
          const inner = (
            <>
              {avatarUrl ? (
                <img src={avatarUrl} alt="" className="w-11 h-11 rounded-full object-cover ring-2 ring-brand-500/40 flex-shrink-0" />
              ) : (
                <div className="w-11 h-11 rounded-full bg-gradient-to-br from-brand-600 to-tosca-500 flex items-center justify-center text-base font-bold text-white flex-shrink-0">
                  {user?.name?.[0]?.toUpperCase() || "?"}
                </div>
              )}
              <div className="min-w-0 leading-tight">
                <p className="text-sm font-semibold truncate" style={{ color: "var(--text-base)" }}>{user?.name}</p>
                {subtitle && <p className="text-[11px] truncate" style={{ color: "var(--text-3)" }}>{subtitle}</p>}
                <span className="text-[11px] font-medium text-brand-400">{t(ROLE_LABEL[role])}</span>
              </div>
            </>
          );
          return role === "user" ? (
            <Link to="/app/profile" onClick={onClose} className="flex items-center gap-3 rounded-xl p-2 -mx-2 hover:bg-white/5 transition-colors">
              {inner}
            </Link>
          ) : (
            <div className="flex items-center gap-3 px-0">{inner}</div>
          );
        })()}
      </div>

      {/* Nav: item lepas + grup collapsible */}
      <nav className="flex-1 p-3 space-y-2 overflow-y-auto">
        {nav.flat.length > 0 && (
          <div className="space-y-0.5">
            {nav.flat.map((i) => <NavItem key={i.to} {...i} onNavigate={onClose} />)}
          </div>
        )}
        {nav.groups.map((g) => (
          <NavGroup key={g.key} group={g} activePath={pathname} onNavigate={onClose} />
        ))}
      </nav>
    </aside>
  );
}
