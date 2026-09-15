@echo off
echo Starting GridWise...
echo.

echo [1/2] Starting Backend (FastAPI)...
start "GridWise Backend" cmd /k "cd /d D:\CHARUSAT\gridwise\backend && .venv\Scripts\uvicorn.exe app.main:app --reload --host 0.0.0.0 --port 8000"

timeout /t 3 /nobreak > nul

echo [2/2] Starting Frontend (Vite)...
start "GridWise Frontend" cmd /k "cd /d D:\CHARUSAT\gridwise\frontend && npm run dev"

echo.
echo GridWise is starting...
echo   Backend:  http://localhost:8000
echo   Frontend: http://localhost:5173
echo   API Docs: http://localhost:8000/docs
echo.
timeout /t 4 /nobreak > nul
start http://localhost:5173
