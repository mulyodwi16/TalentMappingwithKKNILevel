import { useEffect, useState } from "react";

// Reaktif terhadap toggle mode gelap/terang (kelas .dark di <html>) — dipakai panel
// yang latarnya berbeda per tema (RankHero, RankIdentityCard) agar berganti tanpa reload.
export default function useIsDark() {
  const [dark, setDark] = useState(() => document.documentElement.classList.contains("dark"));
  useEffect(() => {
    const el = document.documentElement;
    const obs = new MutationObserver(() => setDark(el.classList.contains("dark")));
    obs.observe(el, { attributes: true, attributeFilter: ["class"] });
    return () => obs.disconnect();
  }, []);
  return dark;
}
