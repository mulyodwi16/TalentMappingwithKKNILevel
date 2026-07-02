# KKNI Talent Mapping System

Sistem pemetaan kompetensi pekerja berbasis standar KKNI (Kerangka Kualifikasi Nasional Indonesia).

**Flow utama:** Upload CV → Auto-prediksi level KKNI → Ujian kompetensi → Skill gap radar → Learning path AI

**Stack:** Express 5 · SQLite + Prisma ORM · React 18 + Vite · Tailwind CSS · Recharts · Three.js

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
npm install              # otomatis jalankan prisma generate + db push
npx prisma db push       # buat tabel di SQLite (wajib sebelum server start)
node seed/seed.js        # isi data demo
node server.js           # start server

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
| `user@demo.id` | Pekerja | Dashboard, CV upload, ujian, skill gap, learning path |
| `hrd@demo.id` | HRD | Dashboard analitik, daftar pekerja, ekspor Excel |
| `admin@demo.id` | Admin | Semua fitur + manajemen user, rules, soal, audit log |

---

## Fitur

| Fitur | Deskripsi |
|---|---|
| **CV Auto-Mapping** | Upload PDF → ekstrak pendidikan & sertifikasi → prediksi level KKNI otomatis |
| **Ujian Kompetensi** | Bank soal terstandar SKKNI, timer, penilaian otomatis per kompetensi |
| **Skill Gap Radar** | Radar chart kompetensi aktual vs target level, urutan prioritas gap |
| **Learning Path** | Rekomendasi belajar berbasis gap, opsional analisis AI via OpenRouter |
| **Dashboard HRD** | Distribusi level KKNI, readiness score, filter departemen, ekspor Excel |
| **Panel Admin** | CRUD user/rules/soal, inbox request dari HRD, audit log semua aksi |
| **Notifikasi** | Real-time bell notification untuk hasil ujian dan update request |
| **Light/Dark Mode** | Toggle di pojok kanan atas topbar (ikon ☀️/🌙), default light mode |

---

## Struktur Proyek

```
KKNITalentMapping/
├── run-all.bat              # start semua service (Windows)
├── .env.example             # template env variable
│
├── server/
│   ├── server.js            # Express app entry point
│   ├── prisma.js            # Prisma client singleton
│   ├── cv.js                # PDF parsing & profile extraction
│   ├── env.js               # dotenv loader
│   ├── prisma/
│   │   └── schema.prisma    # 12 model: User, ExamAttempt, SkillAssessment, dll
│   ├── routes/
│   │   ├── auth.js          # POST /login, /register
│   │   ├── user.js          # profile, CV parse, exam, skill gap, recommendations
│   │   ├── hrd.js           # workers list, analytics, Excel export, requests
│   │   └── admin.js         # CRUD users/rules/questions/resources, audit log
│   ├── middleware/
│   │   └── auth.js          # JWT verify, role guard
│   └── seed/
│       └── seed.js          # data demo (user, KKNI levels, competencies, soal)
│
├── client/
│   ├── src/
│   │   ├── App.jsx          # routing (react-router-dom)
│   │   ├── index.css        # CSS vars light/dark theme + Tailwind
│   │   ├── api/client.js    # axios wrapper
│   │   ├── store/authStore.js  # Zustand auth state
│   │   ├── components/
│   │   │   ├── Layout.jsx   # sidebar + topbar wrapper
│   │   │   ├── Sidebar.jsx  # nav per role (user/hrd/admin)
│   │   │   ├── Topbar.jsx   # title, notif, theme toggle, avatar
│   │   │   └── ProtectedRoute.jsx
│   │   ├── pages/
│   │   │   ├── Landing.jsx  # halaman utama (Three.js)
│   │   │   ├── Login.jsx
│   │   │   ├── Register.jsx
│   │   │   ├── user/        # Dashboard, CVUpload, Exam, SkillGap, LearningPath
│   │   │   ├── hrd/         # HrdDashboard
│   │   │   └── admin/       # AdminDashboard, UserManagement, RuleManagement,
│   │   │                    #   QuestionBank, RequestInbox, AuditLogPage
│   │   └── three/
│   │       └── HeroCanvas.jsx  # Three.js particle background
│   └── vite.config.js       # proxy /api → localhost:5000
│
└── kkni/
    ├── analyze.js           # OpenRouter LLM integration
    ├── extract-skkni.py     # ekstrak PDF SKKNI ke JSON
    └── video-editing/
        ├── skkni.json       # data kompetensi Video Editing (SKKNI 2014-118)
        └── SKKNI 2014-118.pdf
```

---

## Environment Variables

Buat file `.env` di folder `server/` (copy dari `server/.env.example` atau buat manual):

```env
PORT=5000
JWT_SECRET=ganti-dengan-secret-panjang-acak
NODE_ENV=development

# Opsional — untuk fitur AI learning path
OPENROUTER_API_KEY=sk-or-xxxx
```

> **Catatan:** File `.env` sudah ada di `.gitignore` — jangan di-commit.

---

## Fitur LLM (Opsional)

Learning path AI menggunakan [OpenRouter](https://openrouter.ai) (gratis tier tersedia).

1. Daftar di openrouter.ai → buat API key
2. Tambahkan ke `server/.env`:
   ```
   OPENROUTER_API_KEY=sk-or-xxxx
   ```
3. Restart server — AI analysis otomatis aktif setelah ujian dengan gap

Untuk profesi baru (selain Video Editing):
```bash
python kkni/extract-skkni.py "kkni/<profesi>/file.pdf" "kkni/<profesi>/skkni.json"
```

---

## Troubleshooting

### Error: `The table main.User does not exist`

Database belum punya tabel. Jalankan di folder `server/`:

```bash
npx prisma db push
node seed/seed.js
```

Lalu restart server. Ini terjadi kalau server dijalankan manual tanpa `npm install` lebih dulu, atau setelah fresh clone.

### Error: `EPERM: operation not permitted` saat prisma generate

Server sedang berjalan dan mengunci file `.dll`. Ini **normal** — tabel sudah terbuat (`db push` sukses). Cukup restart server:

```bash
# Ctrl+C untuk stop, lalu:
node server.js
```

### Port sudah dipakai

```bash
# Windows — cari dan kill proses di port 5000
netstat -ano | findstr :5000
taskkill /F /PID <pid>
```

### Login gagal (401) padahal password benar

Seed belum dijalankan. Jalankan:

```bash
cd server
node seed/seed.js
```

---

## Development

```bash
# Backend dengan auto-reload
cd server && npm run dev     # node --watch server.js

# Frontend dengan HMR
cd client && npm run dev     # vite dev server

# Push perubahan schema Prisma
cd server && npx prisma db push

# Lihat isi database
cd server && npx prisma studio
```

---

## Kontribusi

1. Fork repo ini
2. Buat branch: `git checkout -b feature/nama-fitur`
3. Commit perubahan
4. Push dan buat Pull Request

---

## Lisensi

MIT — bebas digunakan dan dimodifikasi.
