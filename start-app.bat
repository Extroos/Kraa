@echo off
setlocal
title KRA Start Utility

:: Force UTF-8 character handling
@chcp 65001 >nul

echo ================================================================
echo                     KRA START UTILITY                    
echo ================================================================
echo.

:: Diagnostic 1: Check Internet
echo [1/4] Checking Connection...
ping -n 1 8.8.8.8 >nul
if %errorlevel% neq 0 (
    echo [!] Status: OFFLINE MODE.
) else (
    echo [!] Status: ONLINE.
)
echo.

:: Diagnostic 2: Check Node/NPM and Dependencies
echo [2/4] Verifying System and Dependencies...
WHERE npm >nul 2>nul
if %errorlevel% neq 0 (
    echo [ERROR] 'npm' was not found on your system.
    echo Please install Node.js from https://nodejs.org/
    pause
    exit /b 1
)

:: Check if node_modules exists, if not run npm install
if not exist "node_modules\" (
    echo [!] node_modules not found. Installing dependencies...
    call npm install
) else (
    echo [!] Status: System Ready.
)
echo.

:: Diagnostic 3: Automated Stability Scan
echo [3/4] Running Stability Check...
call npm run test
if %errorlevel% neq 0 (
    echo.
    echo [!] ALERT: One or more components failed stability tests.
    set /p bypass="Do you want to start the app anyway? (y/n): "
    if /i "%bypass%" neq "y" exit /b 1
)
echo [!] Status: Verified.
echo.

:: Diagnostic 4: Launching App
echo [4/4] Starting Web Hub on Port 3000...
echo.
echo [!] KEEP THIS WINDOW OPEN for cloud syncing.
echo [!] You can minimize it once the browser opens.
echo.

:: Short delay
timeout /t 2 /nobreak >nul
start "" "http://localhost:3000"

:: Final command
call npm run dev

if %errorlevel% neq 0 (
    echo.
    echo [ERROR] The server stopped unexpectedly.
    pause
)
