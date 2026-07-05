import { StrictMode } from "react";
// init theme before first render — default light + warna aksen tersimpan
if (localStorage.getItem("theme") === "dark") document.documentElement.classList.add("dark");
import { applyAccent, getAccent } from "./lib/theme.js";
applyAccent(getAccent());
import { createRoot } from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import App from "./App.jsx";
import "./index.css";

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: 1, staleTime: 30_000 } },
});

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <App />
    </QueryClientProvider>
  </StrictMode>
);
