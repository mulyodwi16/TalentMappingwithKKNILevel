# Talent Mapping KKNI

Memetakan pekerja ke jenjang KKNI: prediksi level → ujian → skill gap (acuan SKKNI resmi) → rekomendasi.
Status: **vertical slice** yang jalan end-to-end (Video Editing, SKKNI 2014-118).

## Jalankan (1 klik)
Double-click **`run-all.bat`** → buka http://localhost:5000

Manual:
```bash
cd server && npm install
node server.js                          # tanpa LLM
node --env-file=../kkni/.env server.js  # dengan rekomendasi LLM
```

## Login demo (password: `demo123`)
| email | role | lihat |
|---|---|---|
| user@demo.id | user | onboarding → ujian → skill gap |
| hrd@demo.id | hrd | dashboard kesiapan pekerja |
| admin@demo.id | admin | aturan mapping + overview |

## LLM (opsional, hemat token)
PDF SKKNI diekstrak **sekali** jadi `kkni/video-editing/skkni.json`. Saat analisis, hanya
unit kompetensi relevan yang dikirim ke OpenRouter — PDF tidak diproses ulang.
1. `copy kkni\.env.example kkni\.env`, isi `OPENROUTER_API_KEY`.
2. Profesi baru: taruh PDF di `kkni/<profesi>/`, jalankan
   `python kkni/extract-skkni.py "kkni/<profesi>/file.pdf" "kkni/<profesi>/skkni.json"`.

## Struktur
```
kkni/     extract-skkni.py, analyze.js, video-editing/{PDF, skkni.json}, .env.example
server/   server.js, engine.js, seed.js, auth.js, public/index.html
run-all.bat
```

## Cek (tanpa API)
```bash
node kkni/analyze.js check   # retrieval
node server/engine.js        # auto-map + scoring
node server/auth.js          # login + RBAC
```

## Belum dibangun (slice sengaja ramping)
Mongo (kini in-memory), Vite/React build (kini 1 halaman), refresh token, bank soal penuh,
katalog rekomendasi, notifikasi, 3D/charts. Shape data sudah cocok schema di `prompt.md`.
