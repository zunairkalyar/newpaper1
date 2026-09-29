@echo off
title Localhost Setup - Newspaper System
color 0a
echo ========================================================
echo   E-Paper Master Localhost Complete Setup Script
echo ========================================================
echo.

echo [1/4] Checking Node.js...
node -v >nul 2>&1
if %errorlevel% neq 0 (
    echo [ERROR] Node.js is not installed or not in PATH.
    echo Please install Node.js v18 or v20 from https://nodejs.org/
    pause
    exit /b 1
)
echo Node.js detected.

echo.
echo [2/4] Installing NPM dependencies...
call npm install
if %errorlevel% neq 0 (
    echo [ERROR] npm install encountered errors.
    pause
    exit /b 1
)

echo.
echo [3/4] Checking Python & Virtual Environment...
python --version >nul 2>&1
if %errorlevel% equ 0 (
    if not exist venv (
        echo Creating Python virtual environment in venv/...
        python -m venv venv
    )
    if exist venv\Scripts\pip.exe (
        echo Installing Python AI & Scraper dependencies...
        venv\Scripts\pip install -r requirements.txt
    )
) else (
    echo [NOTE] Python not detected in PATH.
    echo The core newspaper scrapers and PDF engine will work, but Passport AI
    echo and dynamic Dawn/TheNews slot finders will need Python installed.
)

echo.
echo [4/4] Creating runtime folders & configs...
if not exist output mkdir output
if not exist downloads mkdir downloads
if not exist cache mkdir cache
if not exist config mkdir config

if not exist config\telegram.json (
    if exist config\telegram.json.example (
        copy config\telegram.json.example config\telegram.json
        echo Created config\telegram.json from example template.
    )
)

echo.
echo ========================================================
echo   Setup Complete!
echo   Run START_APP.bat or 'npm start' to launch the app.
echo   Application URL: http://localhost:3012
echo ========================================================
echo.
pause
