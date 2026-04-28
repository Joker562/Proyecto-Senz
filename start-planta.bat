@echo off
REM ─────────────────────────────────────────────────────────────────
REM  Planta Mantenimiento — Senz
REM  Arranca backend (puerto 4000) y frontend (puerto 5173)
REM ─────────────────────────────────────────────────────────────────

SET ROOT=%~dp0

REM Espera 5 s para que Windows termine de arrancar la red
timeout /t 5 /nobreak >nul

REM ── Backend ──────────────────────────────────────────────────────
start "Planta-Backend" /MIN cmd /c "cd /d "%ROOT%backend" && npm run dev"

REM Espera a que el backend levante
timeout /t 8 /nobreak >nul

REM ── Frontend ─────────────────────────────────────────────────────
start "Planta-Frontend" /MIN cmd /c "cd /d "%ROOT%frontend" && npm run dev -- --host"

REM Espera a que Vite compile
timeout /t 10 /nobreak >nul

REM ── Abre el navegador ────────────────────────────────────────────
start "" "http://localhost:5173"
