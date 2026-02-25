@echo off
setlocal enabledelayedexpansion
chcp 65001 >nul 2>&1

:: ============================================================
::  VoiceLab — Windows Installer
::  Installs all dependencies and builds the application.
::  Run once from the repo root: install.bat
:: ============================================================

set "REPO_DIR=%~dp0"
set "BACKEND_DIR=%REPO_DIR%backend"
set "VENV_DIR=%BACKEND_DIR%\venv"
set "LOG_FILE=%REPO_DIR%install_log.txt"
set "ERRORS=0"

:: Minimum version requirements
set "MIN_PYTHON_MAJOR=3"
set "MIN_PYTHON_MINOR=10"
set "MIN_NODE_MAJOR=18"

call :header
call :log "Install log — %date% %time%"
call :log "Repo: %REPO_DIR%"

echo.
call :step "Checking prerequisites..."
echo.

:: ── 1. Python ──────────────────────────────────────────────
call :check_python
if !ERRORS! neq 0 goto :fatal_error

:: ── 2. pip ─────────────────────────────────────────────────
call :check_pip
if !ERRORS! neq 0 goto :fatal_error

:: ── 3. Node.js ─────────────────────────────────────────────
call :check_node
if !ERRORS! neq 0 goto :fatal_error

:: ── 4. npm ─────────────────────────────────────────────────
call :check_npm
if !ERRORS! neq 0 goto :fatal_error

echo.
call :step "Setting up Python virtual environment..."
call :setup_venv
if !ERRORS! neq 0 goto :fatal_error

echo.
call :step "Installing Python dependencies..."
call :install_python_deps
if !ERRORS! neq 0 goto :fatal_error

echo.
call :step "Installing Node.js dependencies and building frontend..."
call :install_node_deps
if !ERRORS! neq 0 goto :fatal_error

echo.
call :step "Creating data directories..."
call :create_data_dirs

echo.
call :done
goto :eof

:: ============================================================
::  FUNCTIONS
:: ============================================================

:header
cls
echo.
echo  ===============================================================
echo   🎙️  VoiceLab  ^|  Windows Installer
echo  ===============================================================
echo   PT-BR Voice Cloning ^& Text-to-Speech Studio
echo  ===============================================================
echo.
goto :eof

:step
echo  [ .. ] %~1
goto :eof

:ok
echo  [ OK ] %~1
call :log "OK: %~1"
goto :eof

:warn
echo  [WARN] %~1
call :log "WARN: %~1"
goto :eof

:fail
echo  [FAIL] %~1
call :log "FAIL: %~1"
set /a ERRORS+=1
goto :eof

:log
echo %~1 >> "%LOG_FILE%"
goto :eof

:: ── Python check ────────────────────────────────────────────
:check_python
set "PYTHON_CMD="

:: Try 'python' first, then 'py' (Windows launcher)
for %%C in (python py python3) do (
    if not defined PYTHON_CMD (
        %%C --version >nul 2>&1
        if !errorlevel! equ 0 (
            set "PYTHON_CMD=%%C"
        )
    )
)

if not defined PYTHON_CMD (
    call :fail "Python not found."
    echo.
    echo        Python %MIN_PYTHON_MAJOR%.%MIN_PYTHON_MINOR%+ is required.
    echo        Download from: https://www.python.org/downloads/
    echo        Make sure to check "Add Python to PATH" during installation.
    echo.
    set /a ERRORS+=1
    goto :eof
)

:: Get version
for /f "tokens=2" %%V in ('%PYTHON_CMD% --version 2^>^&1') do set "PY_VERSION=%%V"
for /f "tokens=1,2 delims=." %%A in ("!PY_VERSION!") do (
    set "PY_MAJOR=%%A"
    set "PY_MINOR=%%B"
)

if !PY_MAJOR! lss %MIN_PYTHON_MAJOR% (
    call :fail "Python !PY_VERSION! found — need %MIN_PYTHON_MAJOR%.%MIN_PYTHON_MINOR%+"
    set /a ERRORS+=1
    goto :eof
)
if !PY_MAJOR! equ %MIN_PYTHON_MAJOR% (
    if !PY_MINOR! lss %MIN_PYTHON_MINOR% (
        call :fail "Python !PY_VERSION! found — need %MIN_PYTHON_MAJOR%.%MIN_PYTHON_MINOR%+"
        set /a ERRORS+=1
        goto :eof
    )
)

call :ok "Python !PY_VERSION! (%PYTHON_CMD%)"
goto :eof

:: ── pip check ───────────────────────────────────────────────
:check_pip
%PYTHON_CMD% -m pip --version >nul 2>&1
if !errorlevel! neq 0 (
    call :fail "pip not found. Run: %PYTHON_CMD% -m ensurepip"
    set /a ERRORS+=1
    goto :eof
)
for /f "tokens=2" %%V in ('%PYTHON_CMD% -m pip --version 2^>^&1') do (
    call :ok "pip %%V"
    goto :eof
)
call :ok "pip (version unknown)"
goto :eof

:: ── Node.js check ───────────────────────────────────────────
:check_node
node --version >nul 2>&1
if !errorlevel! neq 0 (
    call :fail "Node.js not found."
    echo.
    echo        Node.js %MIN_NODE_MAJOR%+ is required.
    echo        Download from: https://nodejs.org/
    echo.
    set /a ERRORS+=1
    goto :eof
)
for /f "tokens=1" %%V in ('node --version 2^>^&1') do set "NODE_VERSION=%%V"
set "NODE_MAJOR=!NODE_VERSION:v=!"
for /f "tokens=1 delims=." %%M in ("!NODE_MAJOR!") do set "NODE_MAJOR=%%M"
if !NODE_MAJOR! lss %MIN_NODE_MAJOR% (
    call :fail "Node.js !NODE_VERSION! found — need v%MIN_NODE_MAJOR%+"
    set /a ERRORS+=1
    goto :eof
)
call :ok "Node.js !NODE_VERSION!"
goto :eof

:: ── npm check ───────────────────────────────────────────────
:check_npm
npm --version >nul 2>&1
if !errorlevel! neq 0 (
    call :fail "npm not found (should come with Node.js)."
    set /a ERRORS+=1
    goto :eof
)
for /f "tokens=1" %%V in ('npm --version 2^>^&1') do call :ok "npm %%V"
goto :eof

:: ── Virtual environment ─────────────────────────────────────
:setup_venv
if exist "%VENV_DIR%\Scripts\activate.bat" (
    call :ok "Virtual environment already exists — skipping creation."
    goto :eof
)

echo        Creating venv at: %VENV_DIR%
%PYTHON_CMD% -m venv "%VENV_DIR%" >> "%LOG_FILE%" 2>&1
if !errorlevel! neq 0 (
    call :fail "Failed to create virtual environment."
    set /a ERRORS+=1
    goto :eof
)
call :ok "Virtual environment created."
goto :eof

:: ── Python deps ─────────────────────────────────────────────
:install_python_deps
set "PIP=%VENV_DIR%\Scripts\pip"

echo        Upgrading pip...
"%PIP%" install --upgrade pip >> "%LOG_FILE%" 2>&1

:: PyTorch CPU (large, ~700 MB) — skip if already installed
"%PIP%" show torch >nul 2>&1
if !errorlevel! equ 0 (
    call :ok "PyTorch already installed — skipping."
) else (
    echo        Installing PyTorch (CPU) — this may take several minutes...
    "%PIP%" install torch torchaudio --index-url https://download.pytorch.org/whl/cpu >> "%LOG_FILE%" 2>&1
    if !errorlevel! neq 0 (
        call :fail "PyTorch installation failed. Check install_log.txt for details."
        set /a ERRORS+=1
        goto :eof
    )
    call :ok "PyTorch (CPU) installed."
)

:: Coqui TTS — skip if already installed
"%PIP%" show coqui-tts >nul 2>&1
if !errorlevel! equ 0 (
    call :ok "Coqui TTS already installed — skipping."
) else (
    echo        Installing Coqui TTS — this may take a few minutes...
    "%PIP%" install "coqui-tts[codec]" "transformers>=4.57.0,<5.0.0" >> "%LOG_FILE%" 2>&1
    if !errorlevel! neq 0 (
        call :fail "Coqui TTS installation failed. Check install_log.txt for details."
        set /a ERRORS+=1
        goto :eof
    )
    call :ok "Coqui TTS installed."
)

:: Remaining requirements
echo        Installing remaining backend requirements...
"%PIP%" install -r "%BACKEND_DIR%\requirements.txt" >> "%LOG_FILE%" 2>&1
if !errorlevel! neq 0 (
    call :fail "requirements.txt installation failed. Check install_log.txt for details."
    set /a ERRORS+=1
    goto :eof
)
call :ok "All Python packages installed."
goto :eof

:: ── Node / frontend ─────────────────────────────────────────
:install_node_deps
echo        Installing npm packages...
pushd "%REPO_DIR%"
call npm install >> "%LOG_FILE%" 2>&1
if !errorlevel! neq 0 (
    call :fail "npm install failed. Check install_log.txt for details."
    set /a ERRORS+=1
    popd
    goto :eof
)
call :ok "npm packages installed."

echo        Building frontend (production)...
call npm run build >> "%LOG_FILE%" 2>&1
if !errorlevel! neq 0 (
    call :fail "Frontend build failed. Check install_log.txt for details."
    set /a ERRORS+=1
    popd
    goto :eof
)
call :ok "Frontend built successfully."
popd
goto :eof

:: ── Data directories ────────────────────────────────────────
:create_data_dirs
if not exist "%BACKEND_DIR%\data\references" mkdir "%BACKEND_DIR%\data\references"
if not exist "%BACKEND_DIR%\data\generated"  mkdir "%BACKEND_DIR%\data\generated"
if not exist "%BACKEND_DIR%\data\exports"    mkdir "%BACKEND_DIR%\data\exports"
if not exist "%BACKEND_DIR%\data\voices.json" (
    echo {"voices":[]} > "%BACKEND_DIR%\data\voices.json"
)
call :ok "Data directories ready."
goto :eof

:: ── Fatal error ─────────────────────────────────────────────
:fatal_error
echo.
echo  ===============================================================
echo   INSTALLATION FAILED
echo  ===============================================================
echo   %ERRORS% error(s) encountered. See install_log.txt for details.
echo.
echo   Common fixes:
echo     - Python not found: install from https://www.python.org/downloads/
echo       (check "Add Python to PATH")
echo     - Node.js not found: install from https://nodejs.org/
echo     - Network errors: check internet connection and retry
echo  ===============================================================
echo.
pause
exit /b 1

:: ── Success ─────────────────────────────────────────────────
:done
echo  ===============================================================
echo   INSTALLATION COMPLETE
echo  ===============================================================
echo.
echo   To start VoiceLab, run:
echo.
echo     start.bat
echo.
echo   Or manually:
echo     - Backend : cd backend ^& venv\Scripts\activate ^& set COQUI_TOS_AGREED=1
echo                 python -m uvicorn main:app --host 0.0.0.0 --port 8000
echo     - Frontend: npm run dev   (from repo root)
echo.
echo   First run: XTTS-v2 model (~1.8 GB) downloads automatically.
echo   The app works immediately via espeak-ng while the model downloads.
echo  ===============================================================
echo.
set /p LAUNCH="Launch VoiceLab now? [Y/n]: "
if /i "!LAUNCH!" neq "n" (
    start "" "%REPO_DIR%start.bat"
)
endlocal
exit /b 0
