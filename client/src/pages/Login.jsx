import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import api from "../api/client.js";
import useAuthStore from "../store/authStore.js";

export default function Login() {
  const navigate = useNavigate();
  const setAuth = useAuthStore((s) => s.setAuth);
  const queryClient = useQueryClient();
  const [form, setForm] = useState({ email: "", password: "" });

  const login = useMutation({
    mutationFn: (data) => api.post("/auth/login", data),
    onSuccess: ({ token, user }) => {
      queryClient.clear();
      setAuth(token, user);
      toast.success(`Selamat datang, ${user.name}!`);
      const dest = user.role === "hrd" ? "/app/hrd" : user.role === "admin" ? "/app/admin" : "/app/dashboard";
      navigate(dest);
    },
    onError: (err) => toast.error(err || "Login gagal"),
  });

  const submit = (e) => { e.preventDefault(); login.mutate(form); };

  return (
    <div className="min-h-screen flex items-center justify-center p-4"
      style={{ background: "linear-gradient(135deg, #eef2ff 0%, #f5f7ff 55%, #ede9fe 100%)" }}>

      {/* decorative blobs */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute -top-32 -left-32 w-96 h-96 bg-indigo-200/40 rounded-full blur-3xl" />
        <div className="absolute bottom-0 right-0 w-80 h-80 bg-violet-200/30 rounded-full blur-3xl" />
      </div>

      <div className="w-full max-w-md relative">
        {/* logo + heading */}
        <div className="text-center mb-8">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-brand-600 to-tosca-500 flex items-center justify-center text-xl font-black text-white mx-auto mb-4">K</div>
          <h1 className="text-2xl font-bold" style={{ color: "var(--text-base)" }}>Masuk ke KKNI Talent</h1>
          <p className="mt-1 text-sm" style={{ color: "var(--text-3)" }}>Masukkan email & password Anda</p>
        </div>

        <form onSubmit={submit} className="card p-6 sm:p-8 space-y-5">
          <div>
            <label className="text-sm font-medium mb-1.5 block" style={{ color: "var(--text-2)" }}>Email</label>
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
            <label className="text-sm font-medium mb-1.5 block" style={{ color: "var(--text-2)" }}>Password</label>
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

          <div className="text-center text-sm" style={{ color: "var(--text-4)" }}>
            Belum punya akun?{" "}
            <Link to="/register" className="text-brand-600 hover:text-brand-700 font-medium">Daftar</Link>
          </div>
        </form>

        {/* demo accounts */}
        <div className="card mt-4 p-4">
          <p className="text-xs font-medium mb-2" style={{ color: "var(--text-4)" }}>Demo login:</p>
          {[
            { email: "user@demo.id", role: "User" },
            { email: "hrd@demo.id", role: "HRD" },
            { email: "admin@demo.id", role: "Admin" },
          ].map(({ email, role }) => (
            <button
              key={email}
              onClick={() => setForm({ email, password: "demo123" })}
              className="w-full text-left text-xs px-3 py-2 rounded-lg transition-colors flex justify-between items-center"
              style={{ color: "var(--text-3)" }}
              onMouseEnter={(e) => e.currentTarget.style.background = "var(--bg-muted)"}
              onMouseLeave={(e) => e.currentTarget.style.background = "transparent"}
            >
              <span>{email}</span>
              <span className="text-brand-600 font-medium">{role}</span>
            </button>
          ))}
        </div>

        <p className="text-center mt-6">
          <Link to="/" className="text-sm hover:text-brand-600 transition-colors" style={{ color: "var(--text-4)" }}>
            ← Kembali ke Beranda
          </Link>
        </p>
      </div>
    </div>
  );
}
