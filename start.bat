@echo off
setlocal enabledelayedexpansion
chcp 65001 >nul 2>&1

:: ============================================================
::  VoiceLab — Windows Launcher
::  Starts the FastAPI backend and opens the app in your browser.
::  Run from the repo root: start.bat
:: ============================================================

set "REPO_DIR=%~dp0"
set "BACKEND_DIR=%REPO_DIR%backend"
set "VENV_PYTHON=%BACKEND_DIR%\venv\Scripts\python.exe"
set "BACKEND_PORT=8000"
set "FRONTEND_PORT=5173"

:: ── Verify installation ─────────────────────────────────────
if not exist "%VENV_PYTHON%" (
    echo.
    echo  [ERROR] Virtual environment not found.
    echo          Please run install.bat first.
    echo.
    pause
    exit /b 1
)

if not exist "%REPO_DIR%node_modules" (
    echo.
    echo  [ERROR] Node modules not found.
    echo          Please run install.bat first.
    echo.
    pause
    exit /b 1
)

:: ── Check if ports are already in use ───────────────────────
netstat -ano | findstr ":%BACKEND_PORT% " | findstr "LISTENING" >nul 2>&1
if !errorlevel! equ 0 (
    echo  [WARN] Port %BACKEND_PORT% is already in use. Backend may already be running.
)

:: ── Start backend ────────────────────────────────────────────
echo.
echo  ===============================================================
echo   🎙️  VoiceLab  ^|  Starting...
echo  ===============================================================
echo.
echo   Backend : http://localhost:%BACKEND_PORT%
echo   Frontend: http://localhost:%FRONTEND_PORT%
echo   API docs: http://localhost:%BACKEND_PORT%/docs
echo.
echo   Close this window to stop VoiceLab.
echo  ===============================================================
echo.

:: Start backend in a new window
start "VoiceLab Backend" cmd /k "cd /d "%BACKEND_DIR%" && set COQUI_TOS_AGREED=1 && "%VENV_PYTHON%" -m uvicorn main:app --host 0.0.0.0 --port %BACKEND_PORT%"

:: Wait briefly for backend to start
echo  Waiting for backend to initialise...
timeout /t 3 /nobreak >nul

:: ── Start frontend dev server ────────────────────────────────
start "VoiceLab Frontend" cmd /k "cd /d "%REPO_DIR%" && npm run dev"

:: Wait for frontend
echo  Waiting for frontend to initialise...
timeout /t 4 /nobreak >nul

:: ── Open browser ─────────────────────────────────────────────
echo  Opening browser...
start "" "http://localhost:%FRONTEND_PORT%"

echo.
echo  VoiceLab is running!
echo.
echo  - Backend window : "VoiceLab Backend"  (port %BACKEND_PORT%)
echo  - Frontend window: "VoiceLab Frontend" (port %FRONTEND_PORT%)
echo.
echo  Close both console windows to stop the application.
echo.
pause
endlocal
