import dotenv from "dotenv";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
// override: true - .env proyek HARUS menang atas env var sistem Windows.
// Tanpa ini, OPENAI_API_KEY milik tim lain yang terpasang di env sistem menimpa
// key pribadi di .env (billing nyasar ke akun tim lain). Jangan dihapus.
dotenv.config({ path: resolve(dirname(fileURLToPath(import.meta.url)), "../.env"), override: true });
