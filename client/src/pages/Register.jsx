import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useMutation } from "@tanstack/react-query";
import toast from "react-hot-toast";
import api from "../api/client.js";
import useAuthStore from "../store/authStore.js";
import { ACADEMIC_STATUS } from "../lib/academic.js";

export default function Register() {
  const navigate = useNavigate();
  const setAuth = useAuthStore((s) => s.setAuth);
  const [form, setForm] = useState({ name: "", email: "", password: "", academicStatus: "" });

  const register = useMutation({
    mutationFn: (data) => api.post("/auth/register", data),
    onSuccess: ({ token, user }) => {
      setAuth(token, user);
      toast.success("Akun dibuat! Sekarang pilih kompetensi targetmu.");
      // Arahkan ke Profil dengan picker kompetensi terbuka otomatis.
      navigate("/app/profile?welcome=1");
    },
    onError: (err) => toast.error(err || "Registrasi gagal"),
  });

  const upd = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  return (
    <div className="min-h-screen flex items-center justify-center p-4 py-12"
      style={{ background: "linear-gradient(135deg, #eef2ff 0%, #f5f7ff 55%, #ede9fe 100%)" }}>

      {/* decorative blobs */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute -top-32 -right-32 w-96 h-96 bg-violet-200/40 rounded-full blur-3xl" />
        <div className="absolute bottom-0 -left-16 w-80 h-80 bg-indigo-200/30 rounded-full blur-3xl" />
      </div>

      <div className="w-full max-w-md relative">
        {/* logo + heading */}
        <div className="text-center mb-8">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-brand-600 to-tosca-500 flex items-center justify-center text-xl font-black text-white mx-auto mb-4">T</div>
          <h1 className="text-2xl font-bold" style={{ color: "var(--text-base)" }}>Buat Akun Baru</h1>
          <p className="mt-1 text-sm" style={{ color: "var(--text-3)" }}>Siapkan diri memenuhi standar kompetensi SKKNI</p>
        </div>

        <form
          onSubmit={(e) => { e.preventDefault(); if (!form.academicStatus) return toast.error("Pilih status akademikmu terlebih dahulu"); register.mutate(form); }}
          className="card p-6 sm:p-8 space-y-4"
        >
          {[
            { key: "name",     label: "Nama Lengkap", type: "text",     ph: "Nama lengkapmu" },
            { key: "email",    label: "Email",         type: "email",    ph: "email@contoh.com" },
            { key: "password", label: "Password",      type: "password", ph: "Min. 6 karakter" },
          ].map(({ key, label, type, ph }) => (
            <div key={key}>
              <label className="text-sm font-medium mb-1.5 block" style={{ color: "var(--text-2)" }}>{label}</label>
              <input className="input" type={type} placeholder={ph} value={form[key]} onChange={upd(key)} required />
            </div>
          ))}

          {/* Status akademik/karier → menentukan pendidikan & rank awal */}
          <div>
            <label className="text-sm font-medium mb-1.5 block" style={{ color: "var(--text-2)" }}>Status kamu saat ini</label>
            <div className="grid grid-cols-2 gap-2">
              {ACADEMIC_STATUS.map((s) => {
                const active = form.academicStatus === s.key;
                return (
                  <button type="button" key={s.key} onClick={() => setForm((f) => ({ ...f, academicStatus: s.key }))}
                    className={`text-left rounded-xl p-3 border transition-colors ${active ? "border-brand-500 bg-brand-600/10" : "hover:border-slate-400"}`}
                    style={active ? {} : { borderColor: "var(--border)" }}>
                    <p className="text-sm font-semibold" style={{ color: "var(--text-base)" }}>{s.label}</p>
                    <p className="text-[11px]" style={{ color: "var(--text-4)" }}>{s.desc}</p>
                  </button>
                );
              })}
            </div>
            <p className="text-[11px] mt-1.5" style={{ color: "var(--text-4)" }}>Kompetensi target dipilih setelah ini, dan bisa diganti kapan saja di Profil.</p>
          </div>

          <button type="submit" disabled={register.isPending} className="btn-primary w-full py-3 mt-2">
            {register.isPending ? "Mendaftarkan…" : "Daftar Sekarang →"}
          </button>

          <p className="text-center text-sm" style={{ color: "var(--text-4)" }}>
            Sudah punya akun?{" "}
            <Link to="/login" className="text-brand-600 hover:text-brand-700 font-medium">Masuk</Link>
          </p>
        </form>

        <p className="text-center mt-4">
          <Link to="/" className="text-sm hover:text-brand-600 transition-colors" style={{ color: "var(--text-4)" }}>
            ← Kembali ke Beranda
          </Link>
        </p>
      </div>
    </div>
  );
}
