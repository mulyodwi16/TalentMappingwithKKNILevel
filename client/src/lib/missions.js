import api from "../api/client.js";

// Tandai satu tugas misi harian selesai (dipanggil saat user membuka halaman terkait).
// Fire-and-forget — gamifikasi tak boleh memblok alur utama.
export async function markMission(task) {
  try { await api.post("/missions/daily/progress", { task }); } catch { /* abaikan */ }
}
