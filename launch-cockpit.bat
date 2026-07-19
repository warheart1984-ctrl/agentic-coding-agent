@echo off
title Nova Cockpit Launcher
cd /d "%~dp0cockpit"

echo Starting Nova Cockpit...
echo.

REM Check if dist exists, if not build
if not exist "dist\index.html" (
    echo Building frontend...
    npm run build
    if errorlevel 1 (
        echo Build failed!
        pause
        exit /b 1
    )
)

echo Launching Electron...
npx electron electron/main.cjs

if errorlevel 1 (
    echo.
    echo Electron exited with error.
    pause
)