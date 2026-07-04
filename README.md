# KKNI Talent Mapping System

Sistem pemetaan kompetensi pekerja berbasis standar KKNI (Kerangka Kualifikasi Nasional Indonesia).

**Flow utama:** Upload CV → Auto-prediksi level KKNI → Ujian kompetensi → Skill gap analyzer → Learning path + kursus AvatarEdu → Sertifikat kompetensi → Job Board (pencocokan talenta)

**Stack:** Express 5 · SQLite + Prisma ORM · React 18 + Vite · Tailwind CSS · Recharts · LLM OpenAI-compatible (OpenAI / OpenRouter / MiniMax) · AvatarEdu.ai

> **Fitur tambahan (update):** AI Mentor Karier, gamifikasi Koin Talenta (login harian + misi harian + Course Harian AI), Toko & Kelas, Job Board ala JobStreet dengan skor kecocokan skill, dan sertifikat kompetensi. Lihat bagian [Fitur Tambahan](#fitur-tambahan-update).

---

## Prasyarat

| Kebutuhan | Versi minimal |
|---|---|
| Node.js | **18+** (rekomendasinya 20+) |
| npm | 9+ |
| OS | Windows / macOS / Linux |

Cek versi: `node -v`

---

## Cara Jalankan (Fresh Clone)

### Cara 1 — 1 klik (Windows)

```
Double-click run-all.bat
```

Script ini otomatis:
1. Install dependencies backend & frontend
2. Buat database SQLite + tabel (`prisma db push`)
3. Isi data demo (`seed`)
4. Start backend di port **5000** dan frontend di port **5173**
5. Buka browser otomatis

### Cara 2 — Manual (semua OS)

```bash
# 1. Backend
cd server
npm install
npx prisma db push
node --env-file=../.env seed/seed.js
node --env-file=../.env server.js

# 2. Frontend (terminal baru)
cd client
npm install
npm run dev
```

Buka: **http://localhost:5173**

---

## Login Demo

Password semua akun: **`demo123`**

| Email | Role | Akses |
|---|---|---|
| `user@demo.id` | Pekerja (Budi Editor) | Dashboard, CV upload, ujian, skill gap, learning path |
| `hrd@demo.id` | HRD (Siti HRD) | Dashboard analitik, daftar & filter pekerja, ekspor Excel |
| `admin@demo.id` | Admin | Semua fitur + manajemen user, rules, soal, audit log |
| `andi@demo.id` | Pekerja (Andi Sinema) | Demo pekerja SMK, Level 3 |
| `dewi@demo.id` | Pekerja (Dewi Kreatif) | Demo pekerja D3, Level 5 |
| `reza@demo.id` | Pekerja (Reza Sutradara) | Demo pekerja S1, Level 6, Readiness 90% |

---

## Fitur

| Fitur | Deskripsi |
|---|---|
| **CV Auto-Mapping** | Upload PDF → ekstrak pendidikan, sertifikasi, pengalaman (termasuk deteksi range tahun `2019–2024`) → prediksi level KKNI |
| **Ujian Kompetensi** | Bank soal terstandar SKKNI, timer, penilaian otomatis per kompetensi, riwayat percobaan |
| **Skill Gap Analyzer** | Radar chart kompetensi aktual vs target level, urutan prioritas gap |
| **Learning Path** | Rekomendasi internal berbasis gap + **kursus AvatarEdu.ai** yang otomatis dicarikan sesuai gap |
| **AI Analysis** | Analisis gap via OpenRouter (DeepSeek) — aktif otomatis setelah ujian jika profesi terdeteksi (video editing, dll.) |
| **Dashboard HRD** | Distribusi level KKNI, readiness score agregat, filter departemen/status/level, ekspor Excel |
| **Panel Admin** | CRUD user/rules/soal/resource, inbox request dari HRD, audit log semua aksi |
| **Notifikasi** | Bell notification untuk hasil ujian & update request, auto-refresh 30 detik |
| **Light/Dark Mode** | Toggle di topbar, persisten via localStorage |
| **Responsive** | Sidebar slide-in dengan burger menu di mobile, layout adaptif |
| **Page Transitions** | Animasi fade+slide antar halaman, smooth scroll-to-top tiap navigasi |
| **AI Mentor Karier** | Chat konsultasi (halaman penuh + widget mengambang) yang *grounded* ke data KKNI user; riwayat persisten + auto-summarization |
| **Gamifikasi Koin** | Koin Talenta dari CV, ujian, kursus; pill saldo di topbar, sink di Toko |
| **Login Harian** | Klaim bonus koin sekali/hari dengan **streak** beruntun |
| **Misi Harian** | 3 misi (Course Harian, cek Job Board, cek Skill Gap) → klaim bonus koin |
| **Course Harian** | Kuis harian; soal **digenerate AI** dari kompetensi, beda tiap hari (anti-ulang ±5 hari), fallback ke bank soal |
| **Toko & Kelas** | Tukar koin dengan kelas premium + katalog kursus AvatarEdu yang bisa langsung diikuti |
| **Job Board** | HRD posting lowongan berkriteria; pekerja lihat **skor kecocokan** & gap yang perlu dikejar; admin lihat semua |
| **Sertifikat Kompetensi** | Terbit otomatis saat lulus ujian; memperkuat pencocokan Job Board |
| **Tombol Bantuan** | Tur fitur (auto-muncul saat pertama login) menjelaskan seluruh fitur |

---

## Struktur Proyek

```
KKNITalentMapping/
├── .env                     # API keys (tidak di-commit)
├── run-all.bat              # start semua service (Windows)
│
├── server/
│   ├── server.js            # Express app entry point
│   ├── prisma.js            # Prisma client singleton
│   ├── cv.js                # PDF parsing, profile extraction, date-range experience detection
│   ├── env.js               # dotenv loader
│   ├── prisma/
│   │   └── schema.prisma    # 12 model: User, ExamAttempt, SkillAssessment, dll
│   ├── routes/
│   │   ├── auth.js          # POST /login, /register
│   │   ├── user.js          # profile, CV parse, exam, skill gap, recommendations
│   │   ├── hrd.js           # workers list, analytics, Excel export
│   │   ├── admin.js         # CRUD + audit log
│   │   └── avataredu.js     # proxy ke AvatarEdu.ai API (key di server-side)
│   ├── middleware/
│   │   └── auth.js          # JWT verify, role guard
│   └── seed/
│       └── seed.js          # 9 KKNI levels, 6 competencies, 22 soal, 6 demo users
│
├── client/
│   ├── src/
│   │   ├── App.jsx          # routing dengan DashboardGate (redirect per role)
│   │   ├── index.css        # CSS vars light/dark + page-enter animation
│   │   ├── api/client.js    # axios wrapper
│   │   ├── store/authStore.js
│   │   ├── components/
│   │   │   ├── Layout.jsx   # sidebar + topbar, smooth scroll, page transition
│   │   │   ├── Sidebar.jsx  # nav per role, mobile slide-in, burger close
│   │   │   ├── Topbar.jsx   # title, burger, notif, theme toggle, avatar
│   │   │   └── ProtectedRoute.jsx
│   │   └── pages/
│   │       ├── Landing.jsx
│   │       ├── Login.jsx    # light indigo theme, role-based redirect, cache clear
│   │       ├── Register.jsx # light indigo theme, responsive
│   │       ├── user/        # Dashboard, CVUpload, Exam, SkillGap, LearningPath
│   │       ├── hrd/         # HrdDashboard (worker table, charts, export)
│   │       └── admin/       # AdminDashboard, UserManagement, RuleManagement,
│   │                        #   QuestionBank, RequestInbox, AuditLogPage
│   └── vite.config.js       # proxy /api → localhost:5000
│
└── kkni/
    ├── analyze.js           # OpenRouter LLM + profesi detection dari position/department
    ├── extract-skkni.py     # ekstrak PDF SKKNI ke JSON
    └── video-editing/
        ├── skkni.json       # data kompetensi Video Editing (SKKNI 2014-118)
        └── SKKNI 2014-118.pdf
```

---

## Environment Variables

Buat file `.env` di root project (sejajar `server/` dan `client/`):

```env
PORT=5000
JWT_SECRET=ganti-dengan-secret-panjang-acak
NODE_ENV=development
CLIENT_URL=http://localhost:5173

# ── LLM untuk AI Mentor, analisis gap, & Course Harian ──
# Provider dipilih OTOMATIS dengan prioritas: OpenAI → OpenRouter → MiniMax.
# Cukup isi salah satu blok.
OPENAI_API_KEY=sk-proj-xxxx
OPENAI_BASE_URL=https://api.openai.com/v1
OPENAI_MODEL=gpt-4o

# Alternatif hemat (dipakai bila OPENAI_API_KEY kosong)
OPENROUTER_API_KEY=
OPENROUTER_MODEL=deepseek/deepseek-chat

# Cadangan (dipakai bila dua di atas kosong)
MINIMAX_API_KEY=
MINIMAX_BASE_URL=https://api.minimax.io/v1
MINIMAX_MODEL=MiniMax-M2

# Kursus AvatarEdu (opsional)
AVATAREDU_API_KEY=av_xxxx
```

> Tanpa API key LLM, fitur AI tetap **degradasi mulus**: AI Mentor menampilkan pesan "belum aktif", dan Course Harian jatuh ke bank soal (bukan generate AI).

> **Catatan:** File `.env` ada di `.gitignore` — jangan di-commit.

---

## Integrasi AvatarEdu.ai

Kursus dari [AvatarEdu.ai](https://avataredu.ai) otomatis muncul di Learning Path berdasarkan gap kompetensi user.

**Setup:**
1. Dapatkan API key dari superadmin AvatarEdu
2. Tambahkan ke `.env`: `AVATAREDU_API_KEY=av_xxxx`
3. Restart server — bagian "Kursus di AvatarEdu" langsung aktif di Learning Path

**Cara kerja:**
- Backend proxy di `/api/avataredu/courses` (key tidak pernah ke browser)
- Otomatis search berdasarkan nama gap competency user
- Preview kursus via iframe embed (key di-inject server-side)
- Enroll → redirect ke avataredu.ai

Untuk profesi baru (selain Video Editing), tambahkan folder `kkni/<profesi>/skkni.json` dan daftarkan di `PROFESI_MAP` di `kkni/analyze.js`.

---

## Integrasi OpenRouter (AI Analysis)

Analisis gap kompetensi menggunakan LLM via [OpenRouter](https://openrouter.ai).

**Setup:**
1. Daftar di openrouter.ai → buat API key
2. Tambahkan ke `.env`: `OPENROUTER_API_KEY=sk-or-xxxx`
3. AI analysis otomatis aktif setelah ujian — muncul di Learning Path

AI aktif hanya jika:
- Ada gap kompetensi dari hasil ujian
- Profesi user terdeteksi dari field `position`/`department` (saat ini: video/editing/media/sinema)

---

## Fitur Tambahan (Update)

### AI Mentor Karier KKNI (role: User)
Chat konsultasi yang paham data pemetaan user (jenjang, target, gap, status). Tersedia sebagai halaman penuh (`/app/mentor`) & widget mengambang di semua halaman User. Riwayat persisten di `localStorage` + auto-summarization saat percakapan panjang. Backend: `server/routes/mentor.js` + `server/llm.js`.

### Gamifikasi — Koin Talenta (role: User)
- **Login harian** (`/api/coins/daily-claim`): bonus sekali/hari + streak beruntun.
- **Misi harian** (`/api/missions/daily`): 3 tugas → klaim bonus. Salah satunya **Course Harian** (`/api/missions/quiz`): soal digenerate AI dari kompetensi, anti-ulang ±5 hari (log di `DailyQuizLog`).
- **Koin** didapat dari: memetakan CV, menyelesaikan ujian, mengikuti kursus. **Toko & Kelas** (`/app/toko`) = sink koin (kelas premium) + katalog kursus AvatarEdu.

### Job Board (roles: User / HRD / Admin)
- **HRD** (`/app/hrd/jobs`): posting lowongan berkriteria (level KKNI, keahlian, pengalaman, sertifikasi), lihat pelamar terurut kecocokan.
- **User** (`/app/jobs`): telusuri lowongan + **skor kecocokan** (engine `server/jobmatch.js`, bobot level 30 / pengalaman 15 / skill 40 / sertifikasi 15) + daftar skill yang perlu dikejar; melamar.
- **Admin**: melihat semua lowongan. Skill user dihimpun dari CV + kompetensi lulus + **sertifikat kompetensi** (terbit otomatis saat lulus ujian, model `Certificate`).

### Course AvatarEdu diatur Admin (role: Admin)
`/app/admin/avataredu` — atur course yang tampil ke pekerja: kata kunci pencarian / daftar slug unggulan / aktif-nonaktif, dengan uji pratinjau. Backend: `admin.js` (`/api/admin/avataredu`) + `avataredu.js` (`/api/avataredu/featured`).

### Model data baru (Prisma)
`CoinWallet`, `CoinTransaction`, `ShopRedemption`, `DailyMission`, `DailyQuizLog`, `Certificate`, `Job`, `JobApplication`, `AppSetting`. Setelah pull, jalankan `npx prisma db push` di `server/`.

### Provider LLM fleksibel
`server/llm.js` memilih provider OpenAI-compatible otomatis: **OpenAI → OpenRouter → MiniMax** (lihat [Environment Variables](#environment-variables)).

---

## Troubleshooting

### `The table main.User does not exist`

```bash
cd server
npx prisma db push
node --env-file=../.env seed/seed.js
```

### `EPERM: operation not permitted` saat prisma generate

Normal — server sedang berjalan. Tabel sudah terbuat. Cukup restart server.

### Port sudah dipakai

```bash
# Windows
netstat -ano | findstr :5000
taskkill /F /PID <pid>
```

### Login gagal (401) padahal password benar

Seed belum dijalankan:
```bash
node --env-file=../.env seed/seed.js
```

### HRD melihat data user lain

Bersihkan cache browser atau klik logout lalu login ulang. (Cache TanStack Query di-reset otomatis saat login/logout.)

---

## Development

```bash
# Backend dengan auto-reload
cd server && npm run dev

# Frontend dengan HMR
cd client && npm run dev

# Push perubahan schema
cd server && npx prisma db push

# Lihat isi database
cd server && npx prisma studio

# Test CV extraction
cd server && node --env-file=../.env cv.js

# Test AI analysis (butuh OPENROUTER_API_KEY)
node kkni/analyze.js "profil pekerja..." "query opsional"
```

---

## Lisensi

MIT — bebas digunakan dan dimodifikasi.
