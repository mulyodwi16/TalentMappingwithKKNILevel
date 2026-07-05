import { useState } from "react";
import { NavLink, useNavigate, useLocation } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import {
  LayoutDashboard, Upload, ClipboardCheck, Target, BookOpen,
  Users, Settings2, Mail, ScrollText, LogOut, X, Bot, ShoppingBag, Compass,
  GraduationCap, ChevronDown,
} from "lucide-react";
import useAuthStore from "../store/authStore.js";
import Logo from "./Logo.jsx";

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
    isActive ? "bg-brand-600 text-white shadow-lg shadow-brand-600/20" : "hover:bg-brand-50"
  }`;
const linkStyle = ({ isActive }) => (isActive ? {} : { color: "var(--text-3)" });

function NavItem({ to, label, Icon, onNavigate }) {
  return (
    <NavLink to={to} end className={linkClass} style={linkStyle} onClick={onNavigate}>
      {({ isActive }) => (<><Icon size={17} className={isActive ? "text-white" : ""} />{label}</>)}
    </NavLink>
  );
}

// Grup nav collapsible (container dropdown).
function NavGroup({ group, activePath, onNavigate }) {
  const hasActive = group.items.some((i) => activePath === i.to);
  const [open, setOpen] = useState(hasActive || false);
  return (
    <div>
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between px-3 py-1.5 text-[11px] font-bold uppercase tracking-wider hover:opacity-80"
        style={{ color: "var(--text-4)" }}
      >
        {group.label}
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
  const { user, logout } = useAuthStore();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const queryClient = useQueryClient();
  const role = user?.role || "user";
  const nav = navFor(role);

  return (
    <aside
      className={[
        "w-60 h-screen flex flex-col flex-shrink-0",
        "fixed inset-y-0 left-0 z-40 lg:static lg:z-auto",
        "transition-transform duration-300 ease-out",
        open ? "translate-x-0" : "-translate-x-full lg:translate-x-0",
      ].join(" ")}
      style={{ backgroundColor: "var(--bg-surface)", borderRight: "1px solid var(--border)" }}
    >
      {/* Logo + close on mobile */}
      <div className="p-5 flex items-center justify-between" style={{ borderBottom: "1px solid var(--border)" }}>
        <Logo size={34} />
        <button onClick={onClose} className="lg:hidden p-1.5 rounded-lg hover:bg-red-50 hover:text-red-500 transition-colors" style={{ color: "var(--text-4)" }}>
          <X size={16} />
        </button>
      </div>

      {/* User badge */}
      <div className="px-4 py-3" style={{ borderBottom: "1px solid var(--border)" }}>
        <div className="glass rounded-xl px-3 py-2.5">
          <p className="text-xs" style={{ color: "var(--text-3)" }}>Login sebagai</p>
          <p className="text-sm font-semibold truncate" style={{ color: "var(--text-base)" }}>{user?.name}</p>
          <span className="text-xs font-medium text-brand-600">{ROLE_LABEL[role]}</span>
        </div>
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

      {/* Logout */}
      <div className="p-4" style={{ borderTop: "1px solid var(--border)" }}>
        <button
          onClick={() => { queryClient.clear(); logout(); navigate("/login"); }}
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium hover:bg-red-50 hover:text-red-500 transition-all duration-200"
          style={{ color: "var(--text-3)" }}
        >
          <LogOut size={17} /> Keluar
        </button>
      </div>
    </aside>
  );
}
