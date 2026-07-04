import { NavLink, useNavigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import {
  LayoutDashboard, Upload, ClipboardCheck, Target, BookOpen,
  Users, Settings2, Mail, ScrollText, LogOut, X, Bot, ShoppingBag, Compass, GraduationCap,
} from "lucide-react";
import useAuthStore from "../store/authStore.js";

const NAV = {
  user: [
    { to: "/app/dashboard",     label: "Dashboard",      Icon: LayoutDashboard },
    { to: "/app/cv-upload",     label: "Upload CV",      Icon: Upload },
    { to: "/app/exam",          label: "Ujian",          Icon: ClipboardCheck },
    { to: "/app/skill-gap",     label: "Skill Gap",      Icon: Target },
    { to: "/app/learning-path", label: "Learning Path",  Icon: BookOpen },
    { to: "/app/mentor",        label: "AI Mentor",      Icon: Bot },
    { to: "/app/jobs",          label: "Peta Posisi",    Icon: Compass },
    { to: "/app/toko",          label: "Toko & Kelas",   Icon: ShoppingBag },
  ],
  hrd: [
    { to: "/app/hrd",           label: "Dashboard HRD",  Icon: LayoutDashboard },
    { to: "/app/hrd/jobs",      label: "Peta Posisi",    Icon: Compass },
  ],
  admin: [
    { to: "/app/admin",          label: "Dashboard",     Icon: LayoutDashboard },
    { to: "/app/admin/users",    label: "Pengguna",      Icon: Users },
    { to: "/app/admin/rules",    label: "Aturan Mapping",Icon: Settings2 },
    { to: "/app/admin/questions",label: "Bank Soal",     Icon: ClipboardCheck },
    { to: "/app/admin/requests", label: "Inbox Request", Icon: Mail },
    { to: "/app/admin/avataredu",label: "Course AvatarEdu",Icon: GraduationCap },
    { to: "/app/admin/audit",    label: "Audit Log",     Icon: ScrollText },
  ],
};

const ROLE_LABEL = { user: "Pekerja", hrd: "HRD", admin: "Admin" };

export default function Sidebar({ open, onClose }) {
  const { user, logout } = useAuthStore();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const role = user?.role || "user";

  const links = role === "admin"
    ? [...NAV.user, ...NAV.hrd, ...NAV.admin]
    : role === "hrd"
    ? NAV.hrd
    : NAV.user;

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
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-brand-600 to-tosca-500 flex items-center justify-center text-sm font-bold text-white">K</div>
          <div>
            <p className="text-sm font-bold" style={{ color: "var(--text-base)" }}>KKNI Talent</p>
            <p className="text-xs" style={{ color: "var(--text-4)" }}>Mapping System</p>
          </div>
        </div>
        <button
          onClick={onClose}
          className="lg:hidden p-1.5 rounded-lg hover:bg-red-50 hover:text-red-500 transition-colors"
          style={{ color: "var(--text-4)" }}
        >
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

      {/* Nav */}
      <nav className="flex-1 p-3 space-y-0.5 overflow-y-auto">
        {links.map(({ to, label, Icon }) => (
          <NavLink
            key={to}
            to={to}
            end
            className={({ isActive }) =>
              `flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 ${
                isActive
                  ? "bg-brand-600 text-white shadow-lg shadow-brand-600/20"
                  : "hover:bg-brand-50"
              }`
            }
            style={({ isActive }) => isActive ? {} : { color: "var(--text-3)" }}
          >
            {({ isActive }) => (
              <>
                <Icon size={17} className={isActive ? "text-white" : ""} />
                {label}
              </>
            )}
          </NavLink>
        ))}
      </nav>

      {/* Logout */}
      <div className="p-4" style={{ borderTop: "1px solid var(--border)" }}>
        <button
          onClick={() => { queryClient.clear(); logout(); navigate("/login"); }}
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium hover:bg-red-50 hover:text-red-500 transition-all duration-200"
          style={{ color: "var(--text-3)" }}
        >
          <LogOut size={17} />
          Keluar
        </button>
      </div>
    </aside>
  );
}
