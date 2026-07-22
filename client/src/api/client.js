import axios from "axios";
import useAuthStore from "../store/authStore.js";

const api = axios.create({ baseURL: "/api", timeout: 30_000 });

// Batas tunggu untuk permintaan yang MENYUSUN sesuatu dengan AI (soal ujian, materi kelas,
// rencana belajar). Penyusunan satu paket soal bisa lewat satu menit, sedangkan batas umum
// 30 detik - hasilnya permintaan tampak GAGAL padahal servernya jalan terus dan hasilnya
// tersimpan. Angka ini sengaja longgar; pengulangan setelahnya murah karena server
// menumpangkan percobaan kedua ke pekerjaan yang sedang berjalan (server/inflight.js).
export const AI_TIMEOUT = 240_000;

// Kehabisan waktu BUKAN kegagalan: pekerjaannya lanjut di server dan hasilnya bisa dipanen
// dengan mencoba lagi. Ditandai lewat pesan tetap ini supaya pemanggil bisa membedakannya dari
// galat sungguhan (dan mengulang otomatis), sekaligus tetap layak ditampilkan apa adanya.
export const TIMEOUT_ERROR = "AI masih menyusun - tunggu sebentar lalu coba lagi, hasilnya tidak hilang.";
export const isTimeout = (e) => e === TIMEOUT_ERROR;

api.interceptors.request.use((config) => {
  const token = useAuthStore.getState().token;
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

api.interceptors.response.use(
  (r) => r.data,
  (err) => {
    if (err.response?.status === 401) useAuthStore.getState().logout();
    // `ECONNABORTED` = batas tunggu axios; `ETIMEDOUT` = jaringan menyerah lebih dulu.
    if (!err.response && (err.code === "ECONNABORTED" || err.code === "ETIMEDOUT")) {
      return Promise.reject(TIMEOUT_ERROR);
    }
    return Promise.reject(err.response?.data?.error || err.message || "Server error");
  }
);

export default api;
