@echo off
title Backend - Planta Mantenimiento
SET PATH=C:\Program Files\nodejs;%PATH%
echo.
echo  =========================================
echo   BACKEND - Sistema de Mantenimiento
echo   Puerto: 4000
echo   Red local: http://192.168.254.28:4000
echo  =========================================
echo.
cd /d "%~dp0backend"
npm run dev
pause
