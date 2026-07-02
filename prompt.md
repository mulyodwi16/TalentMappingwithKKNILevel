# PROMPT: Website Talent Mapping Berbasis KKNI

> Copy-paste seluruh isi dokumen ini ke AI coding assistant (Claude Code, Cursor, dsb.) atau berikan ke tim developer sebagai *build brief*. Tulisan diarahkan sebagai instruksi ("Bangunkan…", "Buat…").

---

## 1. Ringkasan Produk

Bangunkan sebuah web application **Talent Mapping** yang memetakan setiap pekerja ke **Level KKNI (Kerangka Kualifikasi Nasional Indonesia)**. Sistem menebak level KKNI awal seseorang dari latar belakang pendidikan & sertifikasinya, lalu **memverifikasi lewat ujian kompetensi**. Bila hasil ujian menunjukkan kompetensi belum cukup/sesuai, sistem menampilkan **Skill Gap Analyzer** + **rekomendasi belajar yang dipersonalisasi** agar pekerja tahu apa yang harus dipelajari untuk naik/menyesuaikan level.

Tujuan bisnis: memudahkan HRD & pimpinan melihat siapa yang **siap naik posisi** dan siapa yang **belum siap**, tanpa kerja manual.

**Tiga role:**
| Role | Ringkasan wewenang |
|---|---|
| **User (Pekerja)** | Lihat profil & level KKNI sendiri, ikut ujian, lihat skill gap, terima rekomendasi belajar. |
| **HRD** | **Serba otomatis & "terima jadi".** Lihat dashboard performa seluruh pekerja, indikator kesiapan promosi, laporan otomatis. Hampir tidak ada input manual — bila butuh perubahan, cukup kirim *request* ke Admin. |
| **Admin (Superadmin)** | **Kontrol penuh atas segalanya.** Kelola aturan mapping, bank soal, standar kompetensi, katalog rekomendasi, user, dan **menangani request dari HRD/pimpinan**. |

Prinsip desain peran: **Admin = pengatur (full control), HRD = penerima hasil (otomatis), User = subjek yang dipetakan.**

---

## 2. Konteks KKNI (WAJIB diverifikasi ke Perpres No. 8 Tahun 2012)

KKNI memiliki **9 jenjang kualifikasi**. Gunakan tabel default berikut sebagai *seed data* awal, namun beri catatan agar Admin bisa mengedit deskriptor & pemetaannya (jangan hardcode):

| Jenjang KKNI | Perkiraan Pendidikan | Kelompok Jabatan |
|---|---|---|
| 1 | SD | Operator |
| 2 | SMP + pelatihan | Operator |
| 3 | SMA/SMK | Operator |
| 4 | D1 | Teknisi/Analis |
| 5 | D2/D3 | Teknisi/Analis |
| 6 | D4/S1 | Teknisi/Analis |
| 7 | Pendidikan Profesi | Ahli |
| 8 | S2 / Spesialis | Ahli |
| 9 | S3 | Ahli |

> Deskriptor tiap jenjang (kemampuan kerja, penguasaan pengetahuan, kemampuan manajerial) harus disimpan sebagai data yang bisa dikelola Admin, bukan konstanta di kode.

---

## 3. Alur Inti Sistem (Logika Utama)

1. **Onboarding** — User mengisi pendidikan, sertifikasi, dan pengalaman kerja.
2. **Auto-Mapping Engine** — Sistem menebak **level KKNI awal** dari kombinasi pendidikan + sertifikat (berdasarkan *rules* yang dikelola Admin).
3. **Verifikasi via Ujian** — User mengambil ujian kompetensi yang dipetakan ke jenjang tersebut.
4. **Evaluasi Gap** — Bila skor pada kompetensi tertentu di bawah ambang, kompetensi itu ditandai sebagai *gap*.
5. **Skill Gap Analyzer** — Menampilkan kompetensi yang kurang (visual radar/spider chart: "dimiliki" vs "dibutuhkan").
6. **Rekomendasi Personalisasi** — Sistem menyarankan materi/kursus/sertifikasi untuk menutup gap (katalog dikelola Admin).
7. **Konfirmasi Level** — Setelah gap tertutup / ujian ulang lulus, level dikonfirmasi.
8. **Kesiapan Promosi** — HRD otomatis melihat status: **Siap Naik / Dalam Proses / Belum Siap** per pekerja.

Buat status ini transparan dan otomatis diperbarui setiap kali user menyelesaikan ujian atau update profil.

---

## 4. Modul & Fitur

### 4.1 Autentikasi & RBAC
- JWT (access + refresh token), password di-hash (bcrypt).
- Role-Based Access Control ketat: User / HRD / Admin.
- Proteksi route di frontend & middleware di backend.

### 4.2 Auto-Mapping Engine (KKNI)
- Aturan pemetaan `pendidikan + sertifikat + pengalaman → prediksi jenjang KKNI`.
- Konfigurasi rules sepenuhnya lewat panel Admin (CRUD rules).

### 4.3 Modul Ujian / Asesmen
- Bank soal per jenjang & per kompetensi (pilihan ganda, benar/salah, skenario).
- Timer, penilaian otomatis, ambang lulus per kompetensi.
- Riwayat percobaan (attempt history), izin ujian ulang.
- (Opsional) Adaptive testing.

### 4.4 Skill Gap Analyzer
- Bandingkan kompetensi aktual user vs kompetensi yang dibutuhkan target jenjang/posisi.
- Visual: **radar chart** kompetensi + daftar gap terurut prioritas.
- Skor kesiapan (readiness score) 0–100%.

### 4.5 Rekomendasi & Learning Path Personalisasi
- Berdasarkan gap, sarankan resource belajar (video/kursus/sertifikasi/artikel).
- Learning path bertahap ("Selesaikan A → B → C untuk naik ke Jenjang X").
- Katalog resource dikelola Admin; tandai progres user (belum/dikerjakan/selesai).

### 4.6 Skill Profile Overview (Dashboard User)
- Ringkasan: level KKNI saat ini, target level, readiness score, riwayat ujian, progres belajar.
- Kartu kompetensi dengan status (kuat / perlu ditingkatkan / gap).

### 4.7 Dashboard HRD (otomatis, "terima jadi")
- Tabel seluruh pekerja + filter (departemen, jenjang, status kesiapan).
- Indikator promosi: **Siap Naik / Dalam Proses / Belum Siap**.
- Analitik agregat: distribusi jenjang, rata-rata readiness per divisi, tren.
- Ekspor laporan (PDF/Excel) otomatis.
- Tombol **"Ajukan Request ke Admin"** (mis. minta buka ujian ulang, ubah target posisi) — masuk ke antrean request Admin.

### 4.8 Panel Admin (kontrol penuh)
- CRUD penuh: user, jenjang KKNI & deskriptor, kompetensi, rules mapping, bank soal, katalog rekomendasi, posisi/jabatan.
- **Inbox Request** dari HRD/pimpinan: setujui/tolak/eksekusi.
- Audit log semua aksi penting.
- Manajemen role & reset akun.

### 4.9 Notifikasi
- Pengingat ujian, gap baru terdeteksi, eligible untuk promosi, status request.
- In-app + (opsional) email.

---

## 5. Tech Stack — MERN

- **MongoDB** + Mongoose (schema di bawah).
- **Express.js** REST API (struktur modular: routes / controllers / services / models / middleware).
- **React** dengan **Vite** (bukan CRA), **React Router**, dan **React Query (TanStack Query)** untuk data fetching; state global via **Zustand** atau **Redux Toolkit**.
- **Node.js**.
- **Styling: Tailwind CSS** (paling pas untuk aksen *rounded* & modern; gunakan `rounded-2xl`, `shadow-soft`, spacing lega).
- **Charts:** Recharts atau Chart.js (radar untuk skill gap, bar/line untuk analitik HRD).
- **3D:** **Three.js via React Three Fiber (@react-three/fiber + @react-three/drei)**.
- **Ikon:** **Flaticon** (unduh SVG/PNG dari flaticon.com). **JANGAN gunakan ikon hasil generate AI.** Simpan ikon di `client/src/assets/icons/`, dan cantumkan atribusi Flaticon bila lisensi free mensyaratkan.
- **Validasi:** Zod / Joi. **Dokumentasi API:** Swagger (OpenAPI).
- **.env** untuk konfigurasi (URI Mongo, JWT secret, port).

---

## 6. Panduan UI/UX (Modern & Profesional)

- **Gaya:** modern, profesional, bersih, banyak **sudut membulat (rounded)** — kartu `rounded-2xl`, tombol pill, input membulat, bayangan halus.
- **Palet warna (saran):** primer biru-tosca profesional (mis. `#2563EB`/`#0EA5E9`) + netral abu, aksen hijau untuk "siap" dan amber untuk "dalam proses", merah lembut untuk "gap". Sediakan **dark mode**.
- **Tipografi:** font sans modern (Inter / Plus Jakarta Sans — cocok nuansa Indonesia).
- **Layout:** sidebar kiri untuk navigasi per role, top bar dengan profil & notifikasi, konten berbasis kartu.
- **Three.js (pakai secukupnya, jangan berat):**
  - Hero/landing interaktif (mis. bola/partikel yang merepresentasikan jaringan talenta).
  - **Visualisasi 3D skill radar / "competency globe"** yang bisa diputar untuk profil skill user.
  - Animasi ringan pada dashboard. Pastikan tetap responsif & tidak menurunkan performa (lazy-load komponen 3D).
- **Ikon Flaticon** untuk menu, status, dan kategori kompetensi — konsisten satu *icon pack*.
- **Aksesibilitas:** kontras cukup, label, keyboard-friendly. **Bahasa utama: Indonesia.**
- **Responsif** penuh (desktop → mobile).

---

## 7. Skema Data (MongoDB — saran)

```
User            { name, email, passwordHash, role: [user|hrd|admin],
                  department, position, education, certifications[],
                  experienceYears, currentKkniLevel, targetKkniLevel,
                  readinessScore, status: [ready|in_progress|not_ready] }

KkniLevel       { level: 1..9, title, educationMapping, jobGroup, descriptors{} }

Competency      { name, category, description, requiredForLevels[] }

MappingRule     { conditions(education, cert, experience), predictedLevel, weight }

ExamQuestion    { competencyId, kkniLevel, type, question, options[], answerKey, points }

ExamAttempt     { userId, kkniLevel, answers[], scorePerCompetency{}, totalScore,
                  passed, createdAt }

SkillAssessment { userId, competencyId, currentScore, requiredScore, gap, updatedAt }

LearningResource{ title, type, url, competencyId, level, provider }

Recommendation  { userId, resources[], reason, progress: [todo|doing|done] }

Request         { fromHrdId, type, payload, status: [pending|approved|rejected],
                  handledByAdminId, createdAt }

AuditLog        { actorId, action, target, meta, timestamp }

Notification    { userId, type, message, read, createdAt }
```

Sediakan **seed script** untuk mengisi 9 jenjang KKNI, contoh kompetensi, dan akun demo tiap role.

---

## 8. Struktur Folder yang Diharapkan

```
talent-mapping-kkni/
├── client/            # React + Vite
│   ├── src/
│   │   ├── assets/icons/   # ikon Flaticon
│   │   ├── components/
│   │   ├── pages/
│   │   ├── three/          # komponen React Three Fiber
│   │   └── ...
│   └── package.json
├── server/            # Express + Mongoose
│   ├── src/
│   │   ├── routes/ controllers/ services/ models/ middleware/
│   │   └── seed/
│   ├── .env.example
│   └── package.json
├── data/db/           # (opsional) data MongoDB lokal
├── run-all.bat        # 1x klik jalankan semua (Windows)
└── README.md
```

Backend default port **5000**, frontend Vite default **5173**. Sertakan `.env.example`.

---

## 9. Saran / Rekomendasi Tambahan (di luar permintaan awal)

Fitur & praktik yang layak dipertimbangkan agar produk lebih kuat:

1. **Career Path Visualization** — peta jalur karier antar jenjang/posisi, bukan sekadar level tunggal.
2. **Self-assessment vs Verified score** — bandingkan penilaian mandiri user dengan hasil ujian untuk deteksi *over/under-confidence*.
3. **360° / penilaian atasan** (opsional) sebagai pelengkap ujian.
4. **Sertifikat digital** ber-QR yang bisa diunduh saat level terkonfirmasi.
5. **Integrasi LMS** (mis. Moodle) untuk sinkron progres belajar.
6. **Talent pool & suksesi** — daftar kandidat siap promosi per posisi kritikal.
7. **Audit trail lengkap** + **soft delete** untuk keamanan data HR yang sensitif.
8. **Rate limiting, helmet, sanitasi input** — data HR wajib dilindungi.
9. **Ekspor laporan otomatis terjadwal** (mingguan/bulanan) ke email pimpinan.
10. **Testing** (Jest + React Testing Library) & **dokumentasi API Swagger**.
11. **Docker Compose** sebagai alternatif menjalankan (Mongo + API + client) selain `.bat`.
12. **Analitik prediktif ringan** — estimasi waktu untuk pekerja mencapai kesiapan promosi.
13. **Multi-bahasa** (ID default, EN opsional).

---

## 10. Deliverable yang Diminta

- Kode lengkap frontend (`client/`) + backend (`server/`) sesuai spesifikasi di atas.
- Seed data 9 jenjang KKNI, kompetensi contoh, dan akun demo (User/HRD/Admin).
- `README.md` cara instalasi & menjalankan.
- **`run-all.bat`**: satu klik menjalankan MongoDB (lokal, opsional), backend, dan frontend, lalu membuka browser. (Contoh sudah disediakan — sesuaikan port/path dengan implementasi.)

---

## 11. Prioritas Pengerjaan (saran urutan)

1. Auth + RBAC + struktur proyek + seed KKNI.
2. Onboarding + Auto-Mapping Engine.
3. Modul ujian + penilaian.
4. Skill Gap Analyzer + Skill Profile (User).
5. Rekomendasi & learning path.
6. Dashboard HRD + status kesiapan promosi.
7. Panel Admin + inbox request + audit log.
8. Polishing UI (Tailwind rounded, Three.js, ikon Flaticon), dark mode, responsif.
9. Testing, Swagger, `run-all.bat`, README.



"@echo off
chcp 65001 >nul
title Talent Mapping KKNI - Local Runner
color 0A

echo ==================================================
echo   TALENT MAPPING KKNI - MENJALANKAN SEMUA SERVICE
echo ==================================================
echo.

REM ---------- Cek Node.js ----------
where node >nul 2>nul
if %errorlevel% neq 0 (
    echo [ERROR] Node.js tidak ditemukan.
    echo         Install dulu dari https://nodejs.org lalu jalankan lagi.
    pause
    exit /b
)

REM ---------- (1/3) MongoDB lokal ----------
REM Kalau kamu pakai MongoDB Atlas (cloud), HAPUS/comment blok ini
REM dan pastikan MONGO_URI di server\.env mengarah ke Atlas.
where mongod >nul 2>nul
if %errorlevel% equ 0 (
    if not exist "data\db" mkdir "data\db"
    echo [1/3] Menjalankan MongoDB lokal...
    start "MongoDB" cmd /k "mongod --dbpath .\data\db"
    timeout /t 3 >nul
) else (
    echo [1/3] mongod tidak ditemukan - lewati ^(anggap pakai MongoDB Atlas^).
)

REM ---------- (2/3) Backend / Express ----------
echo [2/3] Menjalankan Backend ^(Express^) di port 5000...
start "Backend - Express" cmd /k "cd server && if not exist node_modules (npm install) && npm run dev"
timeout /t 3 >nul

REM ---------- (3/3) Frontend / React + Vite ----------
echo [3/3] Menjalankan Frontend ^(React + Vite^) di port 5173...
start "Frontend - React" cmd /k "cd client && if not exist node_modules (npm install) && npm run dev"
timeout /t 6 >nul

echo.
echo --------------------------------------------------
echo   Semua service berjalan di window terpisah.
echo   Frontend : http://localhost:5173
echo   Backend  : http://localhost:5000
echo --------------------------------------------------
echo.
echo Membuka browser...
timeout /t 3 >nul
start http://localhost:5173

echo.
echo Selesai. Window ini boleh ditutup ^(service tetap jalan di window lain^).
pause"