@echo off
title Senz - Sistema de Mantenimiento
SET PATH=C:\Program Files\nodejs;%PATH%

echo.
echo  ==========================================
echo    SENZ - Sistema de Mantenimiento
echo  ==========================================
echo.

:: Verificar .env del backend
IF NOT EXIST "%~dp0backend\.env" (
  echo  [!] No se encontro backend\.env
  echo  [!] Crea el archivo con tus credenciales de Supabase.
  echo.
  pause
  exit /b 1
)

:: Matar procesos anteriores en 4000 y 5173 si los hay
for /f "tokens=5" %%a in ('netstat -ano 2^>nul ^| findstr ":4000 " ^| findstr "LISTENING"') do (
  taskkill /PID %%a /F >nul 2>&1
)
for /f "tokens=5" %%a in ('netstat -ano 2^>nul ^| findstr ":5173 " ^| findstr "LISTENING"') do (
  taskkill /PID %%a /F >nul 2>&1
)

echo  Iniciando backend  (puerto 4000)...
start "Senz-Backend"  cmd /k "SET PATH=C:\Program Files\nodejs;%%PATH%% && cd /d ""%~dp0backend"" && npm run dev"

timeout /t 5 /nobreak >nul

echo  Iniciando frontend (puerto 5173)...
start "Senz-Frontend" cmd /k "SET PATH=C:\Program Files\nodejs;%%PATH%% && cd /d ""%~dp0frontend"" && npm run dev -- --host"

timeout /t 6 /nobreak >nul

:: Abrir navegador
start "" "http://localhost:5173"

echo.
echo  ==========================================
echo   APP LISTA en http://localhost:5173
echo.
echo   Red local: http://192.168.254.28:5173
echo.
echo   admin@planta.com  /  Admin1234!
echo  ==========================================
echo.
