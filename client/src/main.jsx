import { StrictMode } from "react";
// Terapkan tema SEBELUM render pertama (anti-flash). #9: tema ikut AKUN - bila ada sesi login
// terpersist, pakai preferensinya; bila belum login (pra-login) → default BIRU NAVY. Aksen custom
// TIDAK disimpan di key global, jadi tak bocor ke beranda/login/daftar maupun antar-akun.
import { applyUserPrefs, applyDefaultTheme } from "./lib/theme.js";
try {
  const bootUser = JSON.parse(localStorage.getItem("kkni-auth"))?.state?.user;
  if (bootUser) applyUserPrefs(bootUser);
  else applyDefaultTheme();
} catch { applyDefaultTheme(); }
import { createRoot } from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { LangProvider } from "./lib/i18n.jsx";
import App from "./App.jsx";
import "./index.css";

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: 1, staleTime: 30_000 } },
});

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <LangProvider>
        <App />
      </LangProvider>
    </QueryClientProvider>
  </StrictMode>
);
