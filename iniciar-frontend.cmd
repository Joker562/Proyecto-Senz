@echo off
title Frontend - Planta Mantenimiento
SET PATH=C:\Program Files\nodejs;%PATH%
echo.
echo  =========================================
echo   FRONTEND - Sistema de Mantenimiento
echo   Este equipo:  http://localhost:5173
echo   Red local:    http://192.168.254.28:5173
echo  =========================================
echo.
cd /d "%~dp0frontend"
npm run dev
pause
