@echo off
chcp 65001 >nul
title Talent Mapping KKNI - Runner
color 0A
cd /d "%~dp0"

echo ==================================================
echo   TALENT MAPPING KKNI - Express + SQLite
echo   Backend: http://localhost:5000
echo   Frontend: http://localhost:5173
echo ==================================================
echo.

where node >nul 2>nul
if %errorlevel% neq 0 (
    echo [ERROR] Node.js tidak ditemukan. Install dari https://nodejs.org
    pause
    exit /b
)

REM --- Bebaskan port ---
for /f "tokens=5" %%p in ('netstat -ano ^| findstr :5000 ^| findstr LISTENING 2^>nul') do taskkill /F /PID %%p >nul 2>nul
for /f "tokens=5" %%p in ('netstat -ano ^| findstr :5173 ^| findstr LISTENING 2^>nul') do taskkill /F /PID %%p >nul 2>nul

REM --- [1/3] Backend ---
echo [1/3] Menyiapkan backend...
cd server
echo     Menginstall dependencies...
call npm install
echo     Membuat/memperbarui database SQLite...
call npx prisma db push
echo     Menjalankan seed DB...
node seed/seed.js
echo     Menjalankan server...
start "Backend KKNI" cmd /k "node server.js"
cd ..
echo     Menunggu backend siap...
timeout /t 5 >nul

REM --- [2/3] Frontend ---
echo [2/3] Menyiapkan frontend...
cd client
echo     Menginstall dependencies...
call npm install
start "Frontend KKNI" cmd /k "npm run dev"
cd ..
timeout /t 6 >nul

echo.
echo ==================================================
echo   SELESAI - Semua service berjalan
echo   Frontend  : http://localhost:5173
echo   Backend   : http://localhost:5000
echo   Demo login ^(password: demo123^):
echo     user@demo.id   - Pekerja ^(User^)
echo     hrd@demo.id    - HRD
echo     admin@demo.id  - Admin
echo ==================================================
echo.
echo Membuka browser...
start http://localhost:5173
pause
