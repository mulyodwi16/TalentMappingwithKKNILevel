import { useState, useEffect, useRef, useCallback } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import api from "../api/client.js";
import useAuthStore from "../store/authStore.js";
import LangToggle from "../components/LangToggle.jsx";
import { useLang } from "../lib/i18n.jsx";

// Muat script Google Identity Services sekali (idempoten).
function loadGis() {
  return new Promise((resolve, reject) => {
    if (window.google?.accounts?.id) return resolve();
    const existing = document.getElementById("gis-script");
    if (existing) { existing.addEventListener("load", resolve); return; }
    const s = document.createElement("script");
    s.id = "gis-script";
    s.src = "https://accounts.google.com/gsi/client";
    s.async = true; s.defer = true;
    s.onload = resolve; s.onerror = () => reject(new Error("Gagal memuat Google Sign-In"));
    document.head.appendChild(s);
  });
}

export default function Login() {
  const navigate = useNavigate();
  const setAuth = useAuthStore((s) => s.setAuth);
  const queryClient = useQueryClient();
  const { lang, t } = useLang();
  const [form, setForm] = useState({ email: "", password: "" });
  const gBtnRef = useRef(null);
  const [gReady, setGReady] = useState(false);

  const onLoggedIn = useCallback(({ token, user, isNew }) => {
    queryClient.clear();
    setAuth(token, user);
    toast.success(t("Selamat datang, {name}!", { name: user.name }));
    // Akun Google baru → onboarding: pilih kompetensi target dulu.
    if (isNew) return navigate("/app/profile?welcome=1");
    const dest = user.role === "hrd" ? "/app/hrd" : user.role === "admin" ? "/app/admin" : "/app/dashboard";
    navigate(dest);
  }, [navigate, queryClient, setAuth, t]);

  const login = useMutation({
    mutationFn: (data) => api.post("/auth/login", data),
    onSuccess: onLoggedIn,
    onError: (err) => toast.error(err || t("Login gagal")),
  });

  // Tombol "Masuk dengan Google" (GIS): ambil client ID publik → render tombol resmi.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { clientId } = await api.get("/auth/google-config");
        if (!clientId || cancelled) return;
        await loadGis();
        if (cancelled || !gBtnRef.current) return;
        window.google.accounts.id.initialize({
          client_id: clientId,
          callback: async (resp) => {
            try {
              const r = await api.post("/auth/google", { credential: resp.credential }, { timeout: 20_000 });
              onLoggedIn(r);
            } catch (e) {
              toast.error(typeof e === "string" ? e : t("Login Google gagal"));
            }
          },
        });
        // Kosongkan kontainer dulu — efek re-run saat ganti bahasa, GIS jangan menumpuk tombol.
        gBtnRef.current.innerHTML = "";
        window.google.accounts.id.renderButton(gBtnRef.current, {
          theme: "outline", size: "large", text: "signin_with", shape: "pill", locale: lang, width: 320,
        });
        setGReady(true);
      } catch { /* Google login opsional — form biasa tetap jalan */ }
    })();
    return () => { cancelled = true; };
  }, [onLoggedIn, lang, t]);

  const submit = (e) => { e.preventDefault(); login.mutate(form); };

  return (
    <div className="min-h-screen flex items-center justify-center p-4"
      style={{ background: "linear-gradient(135deg, #eef2ff 0%, #f5f7ff 55%, #ede9fe 100%)" }}>

      {/* decorative blobs */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute -top-32 -left-32 w-96 h-96 bg-indigo-200/40 rounded-full blur-3xl" />
        <div className="absolute bottom-0 right-0 w-80 h-80 bg-violet-200/30 rounded-full blur-3xl" />
      </div>

      {/* Pemilih bahasa — pojok kanan atas */}
      <div className="fixed top-4 right-4 z-10">
        <LangToggle />
      </div>

      <div className="w-full max-w-md relative">
        {/* logo + heading */}
        <div className="text-center mb-8">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-brand-600 to-tosca-500 flex items-center justify-center text-xl font-black text-white mx-auto mb-4">T</div>
          <h1 className="text-2xl font-bold" style={{ color: "var(--text-base)" }}>{t("Masuk ke TalentaAI")}</h1>
          <p className="mt-1 text-sm" style={{ color: "var(--text-3)" }}>{t("Masukkan email & password Anda")}</p>
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
            <label className="text-sm font-medium mb-1.5 block" style={{ color: "var(--text-2)" }}>{t("Password")}</label>
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
            {login.isPending ? t("Masuk…") : t("Masuk →")}
          </button>

          {/* Login Google (muncul bila dikonfigurasi). Kontainer ref selalu ter-mount
              agar GIS bisa render ke dalamnya; pembatas "atau" baru tampil saat siap. */}
          <div className="space-y-3">
            {gReady && (
              <div className="flex items-center gap-3">
                <span className="h-px flex-1" style={{ background: "var(--border)" }} />
                <span className="text-xs" style={{ color: "var(--text-4)" }}>{t("atau")}</span>
                <span className="h-px flex-1" style={{ background: "var(--border)" }} />
              </div>
            )}
            <div ref={gBtnRef} className="flex justify-center" />
          </div>

          <div className="text-center text-sm" style={{ color: "var(--text-4)" }}>
            {t("Belum punya akun?")}{" "}
            <Link to="/register" className="text-brand-600 hover:text-brand-700 font-medium">{t("Daftar")}</Link>
          </div>
        </form>

        {/* demo accounts */}
        <div className="card mt-4 p-4">
          <p className="text-xs font-medium mb-2" style={{ color: "var(--text-4)" }}>{t("Demo login:")}</p>
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
            {t("← Kembali ke Beranda")}
          </Link>
        </p>
      </div>
    </div>
  );
}
