import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useMutation } from "@tanstack/react-query";
import toast from "react-hot-toast";
import api from "../api/client.js";
import useAuthStore from "../store/authStore.js";

export default function Login() {
  const navigate = useNavigate();
  const setAuth = useAuthStore((s) => s.setAuth);
  const [form, setForm] = useState({ email: "", password: "" });

  const login = useMutation({
    mutationFn: (data) => api.post("/auth/login", data),
    onSuccess: ({ token, user }) => {
      setAuth(token, user);
      toast.success(`Selamat datang, ${user.name}!`);
      navigate("/app/dashboard");
    },
    onError: (err) => toast.error(err || "Login gagal"),
  });

  const submit = (e) => { e.preventDefault(); login.mutate(form); };

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4">
      {/* bg glow */}
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-96 h-96 bg-brand-600/10 rounded-full blur-3xl" />
      </div>

      <div className="w-full max-w-md relative">
        <div className="text-center mb-8">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-brand-600 to-tosca-500 flex items-center justify-center text-xl font-black mx-auto mb-4">K</div>
          <h1 className="text-2xl font-bold text-white">Masuk ke KKNI Talent</h1>
          <p className="text-slate-400 mt-1 text-sm">Masukkan email & password Anda</p>
        </div>

        <form onSubmit={submit} className="card p-8 space-y-5">
          <div>
            <label className="text-sm font-medium text-slate-300 mb-1.5 block">Email</label>
            <input
              className="input"
              type="email"
              placeholder="email@contoh.com"
              value={form.email}
              onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
              required
            />
          </div>
          <div>
            <label className="text-sm font-medium text-slate-300 mb-1.5 block">Password</label>
            <input
              className="input"
              type="password"
              placeholder="••••••••"
              value={form.password}
              onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
              required
            />
          </div>

          <button type="submit" disabled={login.isPending} className="btn-primary w-full py-3">
            {login.isPending ? "Masuk…" : "Masuk →"}
          </button>

          <div className="text-center text-sm text-slate-500">
            Belum punya akun?{" "}
            <Link to="/register" className="text-brand-400 hover:text-brand-300">Daftar</Link>
          </div>
        </form>

        <div className="card mt-4 p-4">
          <p className="text-xs text-slate-500 font-medium mb-2">Demo login:</p>
          {[
            { email: "user@demo.id", role: "User" },
            { email: "hrd@demo.id", role: "HRD" },
            { email: "admin@demo.id", role: "Admin" },
          ].map(({ email, role }) => (
            <button
              key={email}
              onClick={() => setForm({ email, password: "demo123" })}
              className="w-full text-left text-xs px-3 py-2 rounded-lg hover:bg-slate-700 text-slate-400 hover:text-white transition-colors flex justify-between"
            >
              <span>{email}</span>
              <span className="text-brand-500">{role}</span>
            </button>
          ))}
        </div>

        <p className="text-center mt-6">
          <Link to="/" className="text-sm text-slate-600 hover:text-slate-400">← Kembali ke Beranda</Link>
        </p>
      </div>
    </div>
  );
}
