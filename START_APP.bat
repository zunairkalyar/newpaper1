@echo off
title E-Paper Master - Pakistan News PDF & Watermark Engine
color 0b
echo ========================================================
echo   E-Paper Master | Pakistan News PDF & Watermark Engine
echo   Branding: Social Media Pakistan 0342-4938217
echo ========================================================
echo.

if not exist node_modules (
    echo [Setup] Installing Node.js packages...
    call npm install
)

if not exist output mkdir output
if not exist downloads mkdir downloads
if not exist cache mkdir cache
if not exist config mkdir config

if not exist config\telegram.json (
    if exist config\telegram.json.example (
        copy config\telegram.json.example config\telegram.json
    )
)

echo.
echo Starting Web Application on http://localhost:3012...
echo.

start "" http://localhost:3012
node server.js

pause
