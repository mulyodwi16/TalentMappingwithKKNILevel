import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import api from "../api/client.js";
import useAuthStore from "../store/authStore.js";
import useCelebrateStore from "../store/celebrateStore.js";
import RankUpOverlay from "./RankUpOverlay.jsx";

// Rank terakhir yang sudah "dilihat" user, dikunci per-akun (bukan global browser) supaya tiap
// akun punya baseline sendiri. Dulu deteksi ini hanya ada di Dashboard, jadi kenaikan rank yang
// terjadi di halaman lain (mis. tepat usai Tes Penempatan) tak pernah dirayakan.
const LAST_RANK_KEY = (id) => `talenta:lastRank:${id}`;

// Pengawas global: dirender di Layout, jadi animasi "Naik Rank!" bisa muncul di HALAMAN MANA PUN
// begitu rank efektif naik - bukan cuma saat kebetulan mendarat di Dashboard. Query overview di sini
// berbagi cache (queryKey sama) dengan halaman lain, jadi tidak menambah request ganda.
export default function RankUpWatcher() {
  const user = useAuthStore((s) => s.user);
  const isUser = user?.role === "user";
  const { rankUp, setRankUp } = useCelebrateStore();

  const { data: overview } = useQuery({
    queryKey: ["overview"],
    queryFn: () => api.get("/user/overview"),
    enabled: isUser,
    staleTime: 30 * 1000,
  });

  const effective = overview?.rank?.effective;

  useEffect(() => {
    if (!isUser || !effective || !user?.id) return;
    const key = LAST_RANK_KEY(user.id);
    const prev = Number(localStorage.getItem(key));
    // Akun baru (belum ada baseline) tidak dirayakan - hanya dicatat titik awalnya.
    if (prev && effective > prev) setRankUp({ from: prev, to: effective });
    localStorage.setItem(key, String(effective));
  }, [isUser, effective, user?.id, setRankUp]);

  if (!isUser || !rankUp) return null;
  return <RankUpOverlay from={rankUp.from} to={rankUp.to} onClose={() => setRankUp(null)} />;
}
