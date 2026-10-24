@echo off
REM ==============================================================================
REM Oceiana (ARIEL 2.0) — Standalone Offline Startup Launcher
REM Designed for AIU Anveshan 2026-27 Research Convention Demo
REM Starts backend (FastAPI :8000) and frontend (Vite :3000), then launches browser.
REM Operates 100% offline from verified observation cache.
REM ==============================================================================

echo [Oceiana] Initializing Oceiana Offline Platform...
set SCRIPT_DIR=%~dp0
cd /d "%SCRIPT_DIR%"

REM Check Python virtualenv
if not exist "backend\.venv\Scripts\python.exe" (
    echo [ERROR] Backend virtual environment not found at backend\.venv
    pause
    exit /b 1
)

REM Check Node modules
if not exist "frontend\node_modules" (
    echo [ERROR] Frontend node_modules not found. Run 'npm install' in frontend first.
    pause
    exit /b 1
)

echo [Oceiana] Starting FastAPI Backend on http://127.0.0.1:8000 ...
start "Oceiana Backend (FastAPI)" cmd /c "cd /d "%SCRIPT_DIR%backend" && .venv\Scripts\python.exe -m uvicorn app.main:app --host 127.0.0.1 --port 8000"

echo [Oceiana] Waiting for backend to initialize...
timeout /t 3 /nobreak >nul

echo [Oceiana] Starting Frontend Server on http://localhost:3000 ...
start "Oceiana Frontend (Vite)" cmd /c "cd /d "%SCRIPT_DIR%frontend" && npm run dev -- --host 127.0.0.1"

echo [Oceiana] Waiting for frontend server...
timeout /t 3 /nobreak >nul

echo [Oceiana] Opening browser at http://localhost:3000/app ...
start http://localhost:3000/app

echo ==============================================================================
echo [SUCCESS] Oceiana is running offline!
echo Backend API:  http://127.0.0.1:8000/api/docs
echo Frontend App: http://localhost:3000/app
echo Reports UI:   http://localhost:3000/app (Select 'Reports' in sidebar)
echo To stop, close the two background terminal windows.
echo ==============================================================================
