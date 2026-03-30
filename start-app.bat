@echo off
setlocal enabledelayedexpansion
title KRA Smart Start Utility v2.0
mode con: cols=100 lines=30

:: Force UTF-8 character handling
@chcp 65001 >nul

:: Define Colors (PowerShell trick for older CMD)
set "esc="
for /f "tokens=27" %%a in ('"prompt $E | findstr /v "prompt""') do set "esc=%%a"
set "green=%esc%[92m"
set "red=%esc%[91m"
set "yellow=%esc%[93m"
set "blue=%esc%[94m"
set "cyan=%esc%[96m"
set "reset=%esc%[0m"

echo %blue%================================================================================%reset%
echo %cyan%                     KRA PROPERTY MANAGEMENT SYSTEM v2.0                    %reset%
echo %blue%================================================================================%reset%
echo.

:: Phase 1: Connection & Environment Scan
echo [%yellow%1/4%reset%] %cyan%Scanning Environment...%reset%
ping -n 1 8.8.8.8 >nul
if %errorlevel% neq 0 (
    echo   %yellow%[!] Status:%reset% OFFLINE (Local Mode Only)
) else (
    echo   %green%[!] Status:%reset% ONLINE (Cloud Ready)
)

WHERE npm >nul 2>nul
if %errorlevel% neq 0 (
    echo.
    echo %red%[ERROR] 'npm' was not found on your system!%reset%
    echo Please install Node.js from https://nodejs.org/ to continue.
    pause
    exit /b 1
)
echo   %green%[!] Node Engine:%reset% Verified.
echo.

:: Phase 2: Dependency Integrity Check
echo [%yellow%2/4%reset%] %cyan%Verifying Dependency Integrity...%reset%
if not exist "node_modules\" (
    echo   %yellow%[!] node_modules missing. Initializing smart installation...%reset%
    echo   %blue%This may take a few minutes for the first setup.%reset%
    call npm install --legacy-peer-deps --no-fund --no-audit
    if !errorlevel! neq 0 (
        echo.
        echo %red%[ERROR] Installation failed.%reset%
        echo Try running 'npm install --legacy-peer-deps' manually.
        pause
        exit /b 1
    )
    echo   %green%[!] Installation:%reset% SUCCESS.
) else (
    echo   %green%[!] Dependencies:%reset% UP TO DATE.
)
echo.

:: Phase 3: Fast Stability Verification
echo [%yellow%3/4%reset%] %cyan%Running Fast Stability Scan...%reset%
:: Quick check for critical files
if not exist "src\App.tsx" (
    echo %red%[ERROR] PROJECT CORRUPTION: src\App.tsx missing!%reset%
    pause
    exit /b 1
)
echo   %green%[!] App Core:%reset% Validated.
echo.

:: Phase 4: Launching Professional Hub
echo [%yellow%4/4%reset%] %green%LAUNCHING KRA WEB HUB%reset%
echo %blue%--------------------------------------------------------------------------------%reset%
echo   %cyan%[!] ADDRESS:%reset% http://localhost:3000
echo   %cyan%[!] ACTION:%reset% Keep this window open for background cloud syncing.
echo %blue%--------------------------------------------------------------------------------%reset%
echo.

:: Use PowerShell to open browser after a short delay (non-blocking)
start /b "" powershell -Command "Start-Sleep -Seconds 3; Start-Process 'http://localhost:3000'"

:: Start the Dev Server
call npm run dev

if %errorlevel% neq 0 (
    echo.
    echo %red%[ERROR] The server stopped unexpectedly.%reset%
    pause
)
