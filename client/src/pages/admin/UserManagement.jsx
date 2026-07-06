import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import api from "../../api/client.js";
import { rankName } from "../../lib/rank.js";
import { useLang } from "../../lib/i18n.jsx";

const ROLE_LABEL = { user: "Talenta", hrd: "HRD", admin: "Admin" };
const ROLE_CLS   = { user: "text-brand-400", hrd: "text-emerald-400", admin: "text-amber-400" };

const EMPTY = { name: "", email: "", password: "", role: "user", department: "", position: "" };

export default function UserManagement() {
  const { t } = useLang();
  const qc = useQueryClient();
  const [modal, setModal] = useState(null); // null | {mode: 'create'|'edit', data}
  const [form, setForm] = useState(EMPTY);

  const { data: users = [], isLoading } = useQuery({
    queryKey: ["admin-users"],
    queryFn: () => api.get("/admin/users"),
  });

  const save = useMutation({
    mutationFn: (d) => modal.mode === "create" ? api.post("/admin/users", d) : api.put(`/admin/users/${modal.data.id}`, d),
    onSuccess: () => { toast.success(modal.mode === "create" ? t("User dibuat") : t("User diperbarui")); qc.invalidateQueries(["admin-users"]); setModal(null); },
    onError: (err) => toast.error(err || t("Gagal")),
  });

  const del = useMutation({
    mutationFn: (id) => api.delete(`/admin/users/${id}`),
    onSuccess: () => { toast.success(t("User dihapus")); qc.invalidateQueries(["admin-users"]); },
    onError: (err) => toast.error(err || t("Gagal")),
  });

  const openCreate = () => { setForm(EMPTY); setModal({ mode: "create" }); };
  const openEdit = (u) => { setForm({ name: u.name, email: u.email, password: "", role: u.role, department: u.department || "", position: u.position || "" }); setModal({ mode: "edit", data: u }); };
  const upd = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold text-white">{t("Manajemen Pengguna")}</h2>
        <button onClick={openCreate} className="btn-primary text-sm py-2 px-4">{t("+ Tambah User")}</button>
      </div>

      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b border-slate-700">
              <tr>
                {["Nama", "Email", "Role", "Departemen", "Rank", "Status", "Aksi"].map((h) => (
                  <th key={h} className="text-left text-xs font-semibold text-slate-500 px-4 py-3">{t(h)}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {isLoading ? (
                <tr><td colSpan={7} className="text-center py-8 text-slate-500">{t("Memuat…")}</td></tr>
              ) : users.map((u) => (
                <tr key={u.id} className="hover:bg-slate-800/30 transition-colors">
                  <td className="px-4 py-3 font-medium text-white">{u.name}</td>
                  <td className="px-4 py-3 text-slate-400 text-xs">{u.email}</td>
                  <td className="px-4 py-3">
                    <span className={`text-xs font-semibold ${ROLE_CLS[u.role]}`}>{t(ROLE_LABEL[u.role])}</span>
                  </td>
                  <td className="px-4 py-3 text-slate-400">{u.department || "—"}</td>
                  <td className="px-4 py-3 text-center text-xs">{u.currentKkniLevel ? rankName(u.currentKkniLevel) : "—"}</td>
                  <td className="px-4 py-3">
                    <span className={`badge text-xs ${u.status === "ready" ? "badge-ready" : u.status === "in_progress" ? "badge-in-progress" : "badge-not-ready"}`}>
                      {u.status || "—"}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex gap-1.5">
                      <button onClick={() => openEdit(u)} className="text-xs px-2.5 py-1 rounded-lg bg-slate-700 hover:bg-slate-600 text-white transition-colors">{t("Edit")}</button>
                      <button onClick={() => { if (confirm(t("Hapus {name}?", { name: u.name }))) del.mutate(u.id); }}
                        className="text-xs px-2.5 py-1 rounded-lg bg-red-500/20 hover:bg-red-500/30 text-red-400 transition-colors">{t("Hapus")}</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal */}
      {modal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="card p-6 w-full max-w-md max-h-screen overflow-y-auto">
            <h3 className="font-semibold text-white mb-5">{modal.mode === "create" ? t("Tambah User") : t("Edit User")}</h3>
            <form onSubmit={(e) => { e.preventDefault(); save.mutate(form); }} className="space-y-4">
              {[
                { k: "name",       label: "Nama Lengkap", type: "text" },
                { k: "email",      label: "Email",        type: "email" },
                { k: "password",   label: modal.mode === "create" ? "Password" : "Password (kosong = tidak diubah)", type: "password" },
                { k: "department", label: "Departemen",   type: "text" },
                { k: "position",   label: "Jabatan",      type: "text" },
              ].map(({ k, label, type }) => (
                <div key={k}>
                  <label className="text-sm font-medium text-slate-300 mb-1.5 block">{t(label)}</label>
                  <input className="input" type={type} value={form[k]} onChange={upd(k)} required={["name","email"].includes(k) || (k === "password" && modal.mode === "create")} />
                </div>
              ))}
              <div>
                <label className="text-sm font-medium text-slate-300 mb-1.5 block">{t("Role")}</label>
                <select className="input" value={form.role} onChange={upd("role")}>
                  {Object.entries(ROLE_LABEL).map(([k, v]) => <option key={k} value={k}>{t(v)}</option>)}
                </select>
              </div>
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setModal(null)} className="btn-outline flex-1">{t("Batal")}</button>
                <button type="submit" disabled={save.isPending} className="btn-primary flex-1">
                  {save.isPending ? t("Menyimpan…") : t("Simpan")}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
