#!/usr/bin/env bash
# ==============================================================================
# Oceiana (ARIEL 2.0) — Standalone Offline Startup Launcher (Linux/Mac/WSL)
# Designed for AIU Anveshan 2026-27 Research Convention Demo
# Operates 100% offline from verified observation cache.
# ==============================================================================

set -e
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

echo "[Oceiana] Initializing Oceiana Offline Platform..."

# Check Python environment
if [ -f "backend/.venv/bin/python" ]; then
    PYTHON_BIN="backend/.venv/bin/python"
elif [ -f "backend/.venv/Scripts/python.exe" ]; then
    PYTHON_BIN="backend/.venv/Scripts/python.exe"
else
    echo "[ERROR] Python virtualenv not found in backend/.venv"
    exit 1
fi

echo "[Oceiana] Starting FastAPI Backend on http://127.0.0.1:8000 ..."
(cd backend && "$PYTHON_BIN" -m uvicorn app.main:app --host 127.0.0.1 --port 8000) &
BACKEND_PID=$!

sleep 3

echo "[Oceiana] Starting Frontend Server on http://localhost:3000 ..."
(cd frontend && npm run dev -- --host 127.0.0.1) &
FRONTEND_PID=$!

sleep 3

echo "=============================================================================="
echo "[SUCCESS] Oceiana is running offline!"
echo "Backend API:  http://127.0.0.1:8000/api/docs"
echo "Frontend App: http://localhost:3000/app"
echo "PID Backend:  $BACKEND_PID"
echo "PID Frontend: $FRONTEND_PID"
echo "Press Ctrl+C to terminate both servers."
echo "=============================================================================="

# Attempt to open browser
if which xdg-open > /dev/null; then
    xdg-open "http://localhost:3000/app"
elif which open > /dev/null; then
    open "http://localhost:3000/app"
fi

trap "kill $BACKEND_PID $FRONTEND_PID 2>/dev/null || true; exit" INT TERM
wait
