import { useEffect, useState } from "react";

// Hook media-query reaktif - untuk perilaku responsif yang butuh cabang di JS (bukan sekadar CSS),
// mis. mengganti avatar companion besar → tombol quick-access di layar HP.
export function useMediaQuery(query) {
  const [match, setMatch] = useState(
    () => typeof window !== "undefined" && window.matchMedia(query).matches
  );
  useEffect(() => {
    const m = window.matchMedia(query);
    const on = () => setMatch(m.matches);
    on();
    m.addEventListener("change", on);
    return () => m.removeEventListener("change", on);
  }, [query]);
  return match;
}
