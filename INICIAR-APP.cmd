@echo off
title SENZ - Iniciando sistema...
SET PATH=C:\Program Files\nodejs;%PATH%

echo.
echo  =========================================
echo   SENZ - SISTEMA DE GESTION INDUSTRIAL
echo  =========================================
echo.

:: ── 1. Liberar puertos en uso ─────────────────────────────────────────────────
echo  Liberando puertos 4000 y 5173...
for /f "tokens=5" %%a in ('netstat -aon ^| find "0.0.0.0:4000 " 2^>nul') do taskkill /f /pid %%a >nul 2>&1
for /f "tokens=5" %%a in ('netstat -aon ^| find "0.0.0.0:5173 " 2^>nul') do taskkill /f /pid %%a >nul 2>&1
timeout /t 2 /nobreak >nul

:: ── 2. Actualizar codigo desde GitHub ────────────────────────────────────────
echo  Descargando ultima version desde GitHub...
cd /d "%~dp0"
git pull origin master
echo.

:: ── 3. Limpiar cache de Vite (evita version obsoleta en disco) ───────────────
echo  Limpiando cache de Vite...
if exist "%~dp0frontend\node_modules\.vite" (
    rmdir /s /q "%~dp0frontend\node_modules\.vite"
    echo  Cache eliminado.
) else (
    echo  Sin cache previo.
)

:: ── 4. Iniciar backend (puerto 4000) ─────────────────────────────────────────
echo  Iniciando backend en puerto 4000...
start "SENZ Backend - Puerto 4000" cmd /k "cd /d ""%~dp0backend"" && call start.bat"
timeout /t 5 /nobreak >nul

:: ── 5. Iniciar frontend (puerto 5173) ────────────────────────────────────────
echo  Iniciando frontend en puerto 5173...
start "SENZ Frontend - Puerto 5173" cmd /k "SET PATH=C:\Program Files\nodejs;%%PATH%% && cd /d ""%~dp0frontend"" && npm run dev"
timeout /t 6 /nobreak >nul

:: ── 6. Listo ──────────────────────────────────────────────────────────────────
echo.
echo  =========================================
echo   APP LISTA - VERSION ACTUALIZADA
echo.
echo   Navegador:    http://localhost:5173
echo   Red local:    http://192.168.1.6:5173
echo.
echo   Usuario:      uriartemartin562@gmail.com
echo   Contrasena:   Admin1234!
echo  =========================================
echo.
pause
