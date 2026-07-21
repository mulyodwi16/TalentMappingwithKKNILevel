import { PrismaClient } from "@prisma/client";

// Alamat database diambil dari schema.prisma (file:../dev.db) KECUALI `DATABASE_URL` diisi.
// `.env` proyek sengaja TIDAK memuat DATABASE_URL, jadi jalannya aplikasi tak berubah -
// yang memakai jalur ini hanya tes, supaya bisa berjalan di database sementara sendiri
// tanpa pernah menyentuh dev.db. Menyetel env var ini di produksi juga jadi mungkin.
export const prisma = new PrismaClient(
  process.env.DATABASE_URL ? { datasourceUrl: process.env.DATABASE_URL } : {},
);
