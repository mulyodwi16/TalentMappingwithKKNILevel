import { create } from "zustand";

// Penanda "sedang mengerjakan ujian". Dipakai lintas komponen yang tidak sepohon:
// halaman tes mengunci dirinya sendiri, sementara AI companion (dirender dari Layout)
// perlu tahu agar tidak bisa dibuka saat ujian berlangsung.
const useExamStore = create((set) => ({
  locked: false,
  lockLabel: "",                                   // nama ujian, untuk pesan companion
  lockExam: (lockLabel = "") => set({ locked: true, lockLabel }),
  unlockExam: () => set({ locked: false, lockLabel: "" }),
}));

export default useExamStore;
