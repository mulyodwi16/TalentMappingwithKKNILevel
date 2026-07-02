import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useMutation } from "@tanstack/react-query";
import toast from "react-hot-toast";
import api from "../api/client.js";
import useAuthStore from "../store/authStore.js";

export default function Register() {
  const navigate = useNavigate();
  const setAuth = useAuthStore((s) => s.setAuth);
  const [form, setForm] = useState({ name: "", email: "", password: "", department: "", position: "" });

  const register = useMutation({
    mutationFn: (data) => api.post("/auth/register", data),
    onSuccess: ({ token, user }) => {
      setAuth(token, user);
      toast.success("Akun berhasil dibuat!");
      navigate("/app/dashboard");
    },
    onError: (err) => toast.error(err || "Registrasi gagal"),
  });

  const upd = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4">
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-96 h-96 bg-tosca-500/10 rounded-full blur-3xl" />
      </div>

      <div className="w-full max-w-md relative">
        <div className="text-center mb-8">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-brand-600 to-tosca-500 flex items-center justify-center text-xl font-black mx-auto mb-4">K</div>
          <h1 className="text-2xl font-bold text-white">Buat Akun Baru</h1>
          <p className="text-slate-400 mt-1 text-sm">Mulai pemetaan KKNI Anda hari ini</p>
        </div>

        <form onSubmit={(e) => { e.preventDefault(); register.mutate(form); }} className="card p-8 space-y-4">
          {[
            { key: "name",       label: "Nama Lengkap",  type: "text",     ph: "Nama Anda" },
            { key: "email",      label: "Email",          type: "email",    ph: "email@contoh.com" },
            { key: "password",   label: "Password",       type: "password", ph: "Min. 6 karakter" },
            { key: "department", label: "Departemen",     type: "text",     ph: "Produksi, Marketing…" },
            { key: "position",   label: "Jabatan",        type: "text",     ph: "Video Editor, Desainer…" },
          ].map(({ key, label, type, ph }) => (
            <div key={key}>
              <label className="text-sm font-medium text-slate-300 mb-1.5 block">{label}</label>
              <input
                className="input"
                type={type}
                placeholder={ph}
                value={form[key]}
                onChange={upd(key)}
                required={["name", "email", "password"].includes(key)}
              />
            </div>
          ))}

          <button type="submit" disabled={register.isPending} className="btn-primary w-full py-3 mt-2">
            {register.isPending ? "Mendaftarkan…" : "Daftar Sekarang →"}
          </button>

          <p className="text-center text-sm text-slate-500">
            Sudah punya akun?{" "}
            <Link to="/login" className="text-brand-400 hover:text-brand-300">Masuk</Link>
          </p>
        </form>

        <p className="text-center mt-4">
          <Link to="/" className="text-sm text-slate-600 hover:text-slate-400">← Kembali ke Beranda</Link>
        </p>
      </div>
    </div>
  );
}
