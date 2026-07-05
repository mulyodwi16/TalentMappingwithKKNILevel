import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import api from "../../api/client.js";
import { rankName } from "../../lib/rank.js";

const EMPTY = { competencyCode: "", kkniLevel: 6, question: "", options: ["", "", "", ""], answerKey: 0, points: 1 };

export default function QuestionBank() {
  const qc = useQueryClient();
  const [filter, setFilter] = useState({ level: "", competency: "" });
  const [modal, setModal] = useState(null);
  const [form, setForm] = useState(EMPTY);

  const { data: questions = [] } = useQuery({
    queryKey: ["admin-questions", filter],
    queryFn: () => {
      const p = new URLSearchParams(Object.fromEntries(Object.entries(filter).filter(([, v]) => v)));
      return api.get(`/admin/questions?${p}`);
    },
  });

  const { data: competencies = [] } = useQuery({ queryKey: ["admin-comps"], queryFn: () => api.get("/admin/competencies") });

  const save = useMutation({
    mutationFn: (d) => modal.mode === "create" ? api.post("/admin/questions", d) : api.put(`/admin/questions/${modal.data.id}`, d),
    onSuccess: () => { toast.success("Soal disimpan"); qc.invalidateQueries(["admin-questions"]); setModal(null); },
    onError: (err) => toast.error(err || "Gagal"),
  });

  const del = useMutation({
    mutationFn: (id) => api.delete(`/admin/questions/${id}`),
    onSuccess: () => { toast.success("Soal dihapus"); qc.invalidateQueries(["admin-questions"]); },
    onError: (err) => toast.error(err || "Gagal"),
  });

  const openCreate = () => { setForm({ ...EMPTY, kkniLevel: parseInt(filter.level) || 6, competencyCode: filter.competency || "" }); setModal({ mode: "create" }); };
  const openEdit = (q) => { setForm({ competencyCode: q.competencyCode, kkniLevel: q.kkniLevel, question: q.question, options: [...q.options], answerKey: q.answerKey, points: q.points }); setModal({ mode: "edit", data: q }); };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <h2 className="text-xl font-bold text-white">Bank Soal</h2>
        <div className="flex gap-2 flex-wrap">
          <select className="input text-sm py-1.5 w-auto" value={filter.level}
            onChange={(e) => setFilter((f) => ({ ...f, level: e.target.value }))}>
            <option value="">Semua Level</option>
            {[1,2,3,4,5,6,7,8,9].map((l) => <option key={l} value={l}>Level {l}</option>)}
          </select>
          <select className="input text-sm py-1.5 w-auto" value={filter.competency}
            onChange={(e) => setFilter((f) => ({ ...f, competency: e.target.value }))}>
            <option value="">Semua Kompetensi</option>
            {competencies.map((c) => <option key={c.code} value={c.code}>{c.name}</option>)}
          </select>
          <button onClick={openCreate} className="btn-primary text-sm py-1.5 px-3">+ Tambah Soal</button>
        </div>
      </div>

      <div className="space-y-3">
        {questions.map((q, i) => (
          <div key={q.id} className="card p-5">
            <div className="flex items-start gap-4">
              <span className="w-7 h-7 rounded-lg bg-slate-700 flex items-center justify-center text-xs font-bold flex-shrink-0">{i + 1}</span>
              <div className="flex-1 min-w-0">
                <div className="flex gap-2 mb-2">
                  <span className="badge bg-brand-500/20 text-brand-400 border-brand-500/30 text-[10px]">{q.competencyCode}</span>
                  <span className="badge bg-slate-700/60 text-slate-400 border-slate-600/30 text-[10px]">Level {q.kkniLevel}</span>
                </div>
                <p className="text-sm font-medium text-white mb-3">{q.question}</p>
                <div className="grid sm:grid-cols-2 gap-1.5">
                  {q.options.map((opt, idx) => (
                    <p key={idx} className={`text-xs px-3 py-1.5 rounded-lg ${idx === q.answerKey ? "bg-emerald-500/15 text-emerald-400 font-medium" : "bg-slate-900/50 text-slate-400"}`}>
                      {String.fromCharCode(65 + idx)}. {opt}
                    </p>
                  ))}
                </div>
              </div>
              <div className="flex gap-1.5 flex-shrink-0">
                <button onClick={() => openEdit(q)} className="text-xs px-2.5 py-1 rounded-lg bg-slate-700 hover:bg-slate-600 text-white">Edit</button>
                <button onClick={() => { if (confirm("Hapus soal ini?")) del.mutate(q.id); }}
                  className="text-xs px-2.5 py-1 rounded-lg bg-red-500/20 hover:bg-red-500/30 text-red-400">Hapus</button>
              </div>
            </div>
          </div>
        ))}
        {questions.length === 0 && (
          <div className="card p-12 text-center text-slate-500">Belum ada soal. Klik "+ Tambah Soal".</div>
        )}
      </div>

      {modal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="card p-6 w-full max-w-lg max-h-screen overflow-y-auto">
            <h3 className="font-semibold text-white mb-5">{modal.mode === "create" ? "Tambah Soal" : "Edit Soal"}</h3>
            <form onSubmit={(e) => { e.preventDefault(); save.mutate({ ...form, answerKey: parseInt(form.answerKey), kkniLevel: parseInt(form.kkniLevel), points: parseInt(form.points) }); }} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-sm font-medium text-slate-300 mb-1.5 block">Kompetensi</label>
                  <select className="input" value={form.competencyCode} onChange={(e) => setForm((f) => ({ ...f, competencyCode: e.target.value }))} required>
                    <option value="">Pilih</option>
                    {competencies.map((c) => <option key={c.code} value={c.code}>{c.code} - {c.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-sm font-medium text-slate-300 mb-1.5 block">Rank (jenjang soal)</label>
                  <select className="input" value={form.kkniLevel} onChange={(e) => setForm((f) => ({ ...f, kkniLevel: e.target.value }))}>
                    {[1,2,3,4,5,6,7,8,9].map((l) => <option key={l} value={l}>{rankName(l)} (Rank {l})</option>)}
                  </select>
                </div>
              </div>
              <div>
                <label className="text-sm font-medium text-slate-300 mb-1.5 block">Pertanyaan</label>
                <textarea className="input h-20 resize-none" value={form.question} onChange={(e) => setForm((f) => ({ ...f, question: e.target.value }))} required />
              </div>
              <div>
                <label className="text-sm font-medium text-slate-300 mb-2 block">Pilihan Jawaban</label>
                {form.options.map((opt, i) => (
                  <div key={i} className="flex items-center gap-2 mb-2">
                    <input type="radio" name="answer" checked={form.answerKey === i} onChange={() => setForm((f) => ({ ...f, answerKey: i }))} className="accent-emerald-500" />
                    <span className="text-xs font-bold text-slate-400 w-4">{String.fromCharCode(65+i)}</span>
                    <input className="input text-sm py-1.5 flex-1" value={opt}
                      onChange={(e) => setForm((f) => { const o = [...f.options]; o[i] = e.target.value; return { ...f, options: o }; })}
                      placeholder={`Pilihan ${String.fromCharCode(65+i)}`} required />
                    {form.answerKey === i && <span className="text-emerald-400 text-xs font-medium">✓ Benar</span>}
                  </div>
                ))}
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
