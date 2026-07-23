// Bahasa antarmuka pengguna untuk permintaan ini. Klien mengirimnya lewat header `X-Lang`
// (dipasang otomatis oleh axios di client/src/lib/i18n.jsx); `body.lang` cuma cadangan untuk
// pemanggil yang memakai fetch mentah.
//
// Dipakai memilih versi prompt AI: setiap prompt baru WAJIB punya versi ID dan EN, kalau
// tidak pengguna berbahasa Inggris menerima jawaban Indonesia di tengah antarmuka Inggris.
export function uiLang(req) {
  const l = req?.headers?.["x-lang"] || req?.body?.lang;
  return l === "en" ? "en" : "id";
}
