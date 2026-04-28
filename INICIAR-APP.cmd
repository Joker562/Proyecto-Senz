@echo off
title Planta Mantenimiento - Iniciando...
SET PATH=C:\Program Files\nodejs;%PATH%
echo.
echo  =========================================
echo   SISTEMA DE MANTENIMIENTO DE PLANTA
echo  =========================================
echo.

:: Verificar que existe el archivo .env del backend
IF NOT EXIST "%~dp0backend\.env" (
  echo  Creando archivo de configuracion...
  echo DATABASE_URL="file:./prisma/dev.db" > "%~dp0backend\.env"
  echo JWT_SECRET="planta-mtto-secret-2024-xK9mP2qL" >> "%~dp0backend\.env"
  echo PORT=4000 >> "%~dp0backend\.env"
  echo FRONTEND_URL="*" >> "%~dp0backend\.env"
)

echo  Iniciando backend (puerto 4000)...
start "Backend - Puerto 4000" cmd /k "SET PATH=C:\Program Files\nodejs;%%PATH%% && cd /d ""%~dp0backend"" && npm run dev"

timeout /t 4 /nobreak >nul

echo  Iniciando frontend (puerto 5173)...
start "Frontend - Puerto 5173" cmd /k "SET PATH=C:\Program Files\nodejs;%%PATH%% && cd /d ""%~dp0frontend"" && npm run dev"

timeout /t 5 /nobreak >nul

echo.
echo  =========================================
echo   APP LISTA
echo.
echo   Este equipo:  http://localhost:5173
echo   Red local:    http://192.168.254.28:5173
echo.
echo   Usuario:      admin@planta.com
echo   Contrasena:   Admin1234!
echo  =========================================
echo.
pause
