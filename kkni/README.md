# Referensi KKNI / SKKNI

Taruh dokumen acuan KKNI/SKKNI (per profesi) di sini. Satu subfolder per profesi:

```
reference/kkni/
  video-editing/
    skkni-video-editing.pdf      <- dokumen sumber dari Kemnaker (PDF/teks)
  <profesi-lain>/
    ...
```

## Yang perlu kamu lakukan sekarang
1. Buat subfolder sesuai profesi, mis. `video-editing/`.
2. Letakkan file KKNI yang sudah kamu download (PDF) di dalamnya.

## Catatan
- Format **PDF teks** (bisa di-select/copy) paling ideal - nanti diekstrak otomatis
  seperti CV. Kalau PDF hasil scan/gambar, perlu OCR (dipikir belakangan).
- Boleh juga ditaruh sebagai `.txt`/`.md` kalau kamu sudah punya versi teks.
- Folder ini **di-commit** ke repo (referensi bersama tim) - bukan rahasia.
- Langkah berikutnya: dokumen ini akan di-parse menjadi unit-unit kompetensi
  terstruktur, lalu saat perbandingan hanya unit yang relevan yang dikirim ke
  LLM (metode retrieval) agar hemat token.
