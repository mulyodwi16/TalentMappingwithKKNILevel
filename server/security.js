// Opsi header keamanan. Dipisah dari server.js supaya bisa DIUJI: server.js memanggil
// app.listen() saat diimpor, jadi tes tak bisa menyentuhnya tanpa menyalakan server.
import helmet from "helmet";

export const helmetOptions = {
  // Izinkan aplikasi di-embed sebagai iframe di situs lain (Canvas/eJourney kolega).
  // frameguard:false → hapus X-Frame-Options (yang tak bisa whitelist banyak domain).
  // CORP cross-origin → aset (JS/CSS) tetap termuat saat di-embed lintas-origin.
  contentSecurityPolicy: false,
  frameguard: false,
  crossOriginResourcePolicy: { policy: "cross-origin" },
  crossOriginOpenerPolicy: false,

  // Bawaan helmet adalah `no-referrer`, dan itu MEMATAHKAN semua sematan pihak ketiga:
  // YouTube & AvatarEdu memverifikasi domain penyemat lewat header Referer, dan tanpa
  // header itu pemutar YouTube membalas "Error 153 - Video player configuration error".
  //
  // Cacatnya tak terlihat saat pengembangan: di lokal, HTML disajikan Vite yang tidak
  // memasang header ini sama sekali. Di produksi HTML-nya keluar dari Express, jadi
  // helmet ikut menyentuhnya - bug yang HANYA muncul di domain asli.
  //
  // `strict-origin-when-cross-origin` = perilaku bawaan peramban modern: origin saja yang
  // dikirim ke tujuan lintas-origin (bukan alamat halaman penuh, jadi kode unit & parameter
  // tidak bocor), dan tidak dikirim sama sekali bila turun dari HTTPS ke HTTP.
  referrerPolicy: { policy: "strict-origin-when-cross-origin" },
};

export const securityHeaders = () => helmet(helmetOptions);
