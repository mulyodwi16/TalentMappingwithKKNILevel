import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import api from "../../api/client.js";
import RankBadge from "../../components/RankBadge.jsx";
import { rankName } from "../../lib/rank.js";

const EMPTY = { order: 1, conditions: { education: "", cert: "", minExperience: "" }, predictedLevel: 3 };

export default function RuleManagement() {
  const qc = useQueryClient();
  const [modal, setModal] = useState(null);
  const [form, setForm] = useState(EMPTY);

  const { data: rules = [] } = useQuery({ queryKey: ["admin-rules"], queryFn: () => api.get("/admin/rules") });

  const save = useMutation({
    mutationFn: (d) => modal.mode === "create" ? api.post("/admin/rules", d) : api.put(`/admin/rules/${modal.data.id}`, d),
    onSuccess: () => { toast.success("Aturan disimpan"); qc.invalidateQueries(["admin-rules"]); setModal(null); },
    onError: (err) => toast.error(err || "Gagal"),
  });

  const del = useMutation({
    mutationFn: (id) => api.delete(`/admin/rules/${id}`),
    onSuccess: () => { toast.success("Aturan dihapus"); qc.invalidateQueries(["admin-rules"]); },
    onError: (err) => toast.error(err || "Gagal"),
  });

  const openCreate = () => {
    const nextOrder = rules.length ? Math.max(...rules.map((r) => r.order)) + 1 : 1;
    setForm({ ...EMPTY, order: nextOrder });
    setModal({ mode: "create" });
  };

  const openEdit = (r) => {
    setForm({ order: r.order, conditions: { education: r.conditions?.education || "", cert: r.conditions?.cert || "", minExperience: r.conditions?.minExperience || "" }, predictedLevel: r.predictedLevel });
    setModal({ mode: "edit", data: r });
  };

  const upd = (path, val) => setForm((f) => {
    if (path.startsWith("conditions.")) {
      const k = path.split(".")[1];
      return { ...f, conditions: { ...f.conditions, [k]: val } };
    }
    return { ...f, [path]: val };
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-white">Aturan Mapping Rank</h2>
          <p className="text-slate-400 text-sm mt-0.5">Aturan dicocokkan berurutan — aturan pertama yang cocok menang</p>
        </div>
        <button onClick={openCreate} className="btn-primary text-sm py-2 px-4">+ Tambah Aturan</button>
      </div>

      <div className="card overflow-hidden">
        <table className="w-full text-sm">
          <thead className="border-b border-slate-700">
            <tr>
              {["Urutan", "Pendidikan", "Sertifikasi", "Min. Pengalaman", "→ Rank", "Aksi"].map((h) => (
                <th key={h} className="text-left text-xs font-semibold text-slate-500 px-4 py-3">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/60">
            {rules.map((r) => (
              <tr key={r.id} className="hover:bg-slate-800/30 transition-colors">
                <td className="px-4 py-3">
                  <span className="w-7 h-7 rounded-lg bg-slate-700 flex items-center justify-center text-xs font-bold">{r.order}</span>
                </td>
                <td className="px-4 py-3 font-medium text-white">{r.conditions?.education || "—"}</td>
                <td className="px-4 py-3 text-slate-400">{r.conditions?.cert || "—"}</td>
                <td className="px-4 py-3 text-slate-400">{r.conditions?.minExperience ? `${r.conditions.minExperience} thn` : "—"}</td>
                <td className="px-4 py-3">
                  <RankBadge level={r.predictedLevel} />
                </td>
                <td className="px-4 py-3">
                  <div className="flex gap-1.5">
                    <button onClick={() => openEdit(r)} className="text-xs px-2.5 py-1 rounded-lg bg-slate-700 hover:bg-slate-600 text-white">Edit</button>
                    <button onClick={() => { if (confirm("Hapus aturan ini?")) del.mutate(r.id); }}
                      className="text-xs px-2.5 py-1 rounded-lg bg-red-500/20 hover:bg-red-500/30 text-red-400">Hapus</button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {modal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="card p-6 w-full max-w-sm">
            <h3 className="font-semibold text-white mb-5">{modal.mode === "create" ? "Tambah Aturan" : "Edit Aturan"}</h3>
            <form onSubmit={(e) => { e.preventDefault(); save.mutate({ ...form, conditions: { ...form.conditions, minExperience: form.conditions.minExperience ? parseInt(form.conditions.minExperience) : undefined } }); }} className="space-y-4">
              <div>
                <label className="text-sm font-medium text-slate-300 mb-1.5 block">Urutan</label>
                <input className="input" type="number" min={1} value={form.order} onChange={(e) => upd("order", parseInt(e.target.value))} required />
              </div>
              <div>
                <label className="text-sm font-medium text-slate-300 mb-1.5 block">Pendidikan</label>
                <select className="input" value={form.conditions.education} onChange={(e) => upd("conditions.education", e.target.value)} required>
                  <option value="">Pilih pendidikan</option>
                  {["SD","SMP","SMA","SMK","D1","D2","D3","D4","S1","S2","S3","Profesi"].map((e) => (
                    <option key={e} value={e}>{e}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-sm font-medium text-slate-300 mb-1.5 block">Kata kunci sertifikasi (opsional)</label>
                <input className="input" type="text" placeholder="mis: editing, premiere" value={form.conditions.cert} onChange={(e) => upd("conditions.cert", e.target.value)} />
              </div>
              <div>
                <label className="text-sm font-medium text-slate-300 mb-1.5 block">Min. pengalaman (tahun, opsional)</label>
                <input className="input" type="number" min={0} value={form.conditions.minExperience} onChange={(e) => upd("conditions.minExperience", e.target.value)} />
              </div>
              <div>
                <label className="text-sm font-medium text-slate-300 mb-1.5 block">→ Prediksi Rank</label>
                <select className="input" value={form.predictedLevel} onChange={(e) => upd("predictedLevel", parseInt(e.target.value))}>
                  {[1,2,3,4,5,6,7,8,9].map((l) => <option key={l} value={l}>{rankName(l)} (Rank {l})</option>)}
                </select>
              </div>
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setModal(null)} className="btn-outline flex-1">Batal</button>
                <button type="submit" disabled={save.isPending} className="btn-primary flex-1">
                  {save.isPending ? "Menyimpan…" : "Simpan"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
