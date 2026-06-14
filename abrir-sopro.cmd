@echo off
title Sopro - Alojamento Local
cd /d "%~dp0"

where npm >nul 2>nul
if errorlevel 1 (
  echo.
  echo Node.js / npm nao encontrado neste PC.
  echo Instala o Node.js LTS primeiro: https://nodejs.org
  echo.
  pause
  exit /b 1
)

if not exist node_modules (
  echo Primeira utilizacao: a instalar dependencias. Pode demorar uns minutos...
  call npm install
)

echo.
echo ============================================================
echo   A iniciar o Sopro.
echo   Deixa ESTA JANELA ABERTA enquanto usas a aplicacao.
echo   O navegador abre sozinho em http://localhost:3000
echo   Para fechar a app: fecha esta janela (ou Ctrl+C).
echo ============================================================
echo.

rem Abre o browser passados uns segundos (da tempo ao servidor de arrancar).
start "" cmd /c "timeout /t 6 /nobreak >nul & start http://localhost:3000"

call npm run dev
