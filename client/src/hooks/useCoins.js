import { useCallback, useEffect, useState } from "react";
import api from "../api/client.js";

// Store sederhana untuk saldo Koin Talenta agar pill di topbar, dashboard, & Toko tetap
// sinkron saat koin bertambah (klaim login / ujian / kursus) atau berkurang (tukar kelas).
let cachedBalance = null;
const listeners = new Set();
function broadcast(n) {
  cachedBalance = n;
  listeners.forEach((l) => l(n));
}

export function useCoins() {
  const [balance, setBal] = useState(cachedBalance);

  useEffect(() => {
    listeners.add(setBal);
    return () => { listeners.delete(setBal); };
  }, []);

  const refresh = useCallback(async () => {
    try {
      const d = await api.get("/coins");
      broadcast(d.balance ?? 0);
      return d;
    } catch {
      return null;
    }
  }, []);

  return { balance, refresh, setBalance: broadcast };
}
