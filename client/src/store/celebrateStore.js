import { create } from "zustand";

// Koordinasi perayaan lintas komponen yang tak sepohon. RankUpWatcher (dirender di Layout)
// mengumumkan kenaikan rank; HelpButton (di Topbar) perlu tahu agar tur usai Tes Penempatan
// MENUNGGU animasi rank selesai dulu - supaya dua modal tidak menumpuk. Keduanya di bawah Layout.
const useCelebrateStore = create((set) => ({
  rankUp: null,                         // { from, to } saat rank efektif naik - dirayakan di mana pun
  setRankUp: (rankUp) => set({ rankUp }),

  tourQueued: false,                    // minta buka tur begitu perayaan rank (bila ada) kelar
  queueTour: () => set({ tourQueued: true }),
  clearTour: () => set({ tourQueued: false }),
}));

export default useCelebrateStore;
