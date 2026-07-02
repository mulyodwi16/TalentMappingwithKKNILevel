# Rencana Migrasi ke MERN Penuh

Status saat ini: **vertical slice** jalan (Express + in-memory + HTML/vanilla + Three.js).
Tujuan: migrasi ke stack `prompt.md` §5 — MongoDB+Mongoose, React+Vite, tanpa merusak loop inti.

## Yang SUDAH ada & dipertahankan (logika, bukan dibuang)
- `server/engine.js` — autoMap + scoreExam (pure, punya self-check). **Reuse apa adanya.**
- `server/cv.js` — CV PDF -> profil + klasifikasi KKNI (pdf-parse). **Reuse.**
- `server/auth.js` — JWT + bcrypt + RBAC middleware. **Reuse, ganti user store ke Mongo.**
- `kkni/analyze.js` + `kkni/video-editing/skkni.json` — retrieval SKKNI + OpenRouter. **Reuse.**
- `server/seed.js` — data seed (kkni 9 level, competencies, rules, exam). **Pindah jadi seed Mongo.**

## Backend: in-memory -> MongoDB + Mongoose
1. `npm i mongoose`. `.env`: `MONGO_URI`.
2. Buat `server/models/` sesuai skema `prompt.md` §7:
   User, KkniLevel, Competency, MappingRule, ExamQuestion, ExamAttempt,
   SkillAssessment, LearningResource, Recommendation, Request, AuditLog, Notification.
3. `server/seed/seed.js` — isi dari `seed.js` lama + 3 akun demo (hash password).
4. Ganti `submissions` Map -> koleksi ExamAttempt/User. HRD overview = query User.
5. Struktur modular: routes/ controllers/ services/ models/ middleware (prompt §5).
6. Tambah: Zod/Joi validasi, helmet, rate-limit, Swagger (`swagger-ui-express`).

## Frontend: HTML vanilla -> React + Vite
1. `client/` = Vite React. React Router, TanStack Query, Zustand.
2. Port `public/index.html` jadi komponen:
   - Landing (Three.js hero -> pindah ke `client/src/three/`, pakai @react-three/fiber+drei).
   - Auth, layout sidebar per role.
   - User: CV upload, exam, skill gap (radar chart Recharts — belum ada!).
   - HRD dashboard (Recharts analitik + ekspor PDF/Excel + tombol Request).
   - Admin: CRUD penuh + Inbox Request + Audit log.
3. Ikon: Flaticon SVG ke `client/src/assets/icons/` (ganti emoji).

## Fitur spec yang MASIH KOSONG (prompt §4) — bangun setelah migrasi
- 4.2 CRUD rules di Admin · 4.3 bank soal + timer + attempt history + ujian ulang
- 4.4 **radar chart** · 4.5 learning path bertahap + progres
- 4.7 ekspor laporan + tombol Request HRD · 4.8 Admin CRUD + Inbox Request + Audit log
- 4.9 Notifikasi · Testing (Jest+RTL) · Swagger · run-all.bat (update: client+server terpisah)

## Urutan eksekusi (prompt §11)
1. Mongo + Mongoose models + seed + wire auth/engine/cv ke Mongo.
2. Vite React scaffold + auth + shell + port landing (Three.js via R3F).
3. User flow (CV->map->exam->gap radar).
4. Rekomendasi + learning path.
5. HRD dashboard (charts, ekspor, request).
6. Admin (CRUD, inbox, audit).
7. Notifikasi.
8. Swagger + tests + polish + run-all.bat.

## Cara jalan sekarang (slice lama, sampai migrasi selesai)
`node server/server.js` -> http://localhost:5000 · login demo password `demo123`.
