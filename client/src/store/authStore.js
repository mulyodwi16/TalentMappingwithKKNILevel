import { create } from "zustand";
import { persist } from "zustand/middleware";
import { applyUserPrefs, applyDefaultTheme } from "../lib/theme.js";

const useAuthStore = create(
  persist(
    (set) => ({
      token: null,
      user: null,
      // Saat login: terapkan preferensi tampilan tersimpan akun (#9) — tema ikut AKUN, bukan browser.
      setAuth: (token, user) => { applyUserPrefs(user); set({ token, user }); },
      // Saat logout: kembalikan ke tampilan DEFAULT (biru navy) agar kustomisasi akun tak menetap di pra-login.
      logout: () => { applyDefaultTheme(); set({ token: null, user: null }); },
      updateUser: (updates) => set((s) => ({ user: { ...s.user, ...updates } })),
    }),
    { name: "kkni-auth" }
  )
);

export default useAuthStore;
