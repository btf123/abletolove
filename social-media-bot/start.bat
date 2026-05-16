@echo off
echo Starting Social Media Bot...
echo.

cd /d "%~dp0"

echo [1/3] Starting Docker (database + Redis)...
docker compose up -d
if errorlevel 1 (
    echo ERROR: Docker failed. Make sure Docker Desktop is running.
    pause
    exit /b 1
)
echo [OK] Docker running
echo.

echo [2/3] Starting Engine (API server)...
start "SMBot Engine" cmd /k "cd /d "%~dp0" && npm run dev --workspace=apps/engine"
timeout /t 5 /nobreak >nul

echo [3/3] Starting Dashboard (website)...
start "SMBot Dashboard" cmd /k "cd /d "%~dp0" && npm run dev --workspace=apps/dashboard"
timeout /t 3 /nobreak >nul

echo.
echo ========================================
echo   Social Media Bot is starting up!
echo   Dashboard: http://localhost:3000
echo   Setup:     http://localhost:3000/setup
echo   Engine:    http://localhost:4000
echo ========================================
echo.
echo You can close this window. The bot runs
echo in the two other windows that opened.
echo.
pause
