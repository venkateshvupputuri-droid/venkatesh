@echo off
REM ================================================
REM Trimble Extension - Dev Server + Tunnel
REM ================================================
REM Requires: ngrok installed from https://ngrok.com
REM
REM This script:
REM 1. Starts local HTTP server on port 8080
REM 2. Creates secure tunnel with ngrok
REM 3. Shows public URL for testing with Trimble
REM

cls
echo.
echo ========================================
echo  TRIMBLE EXTENSION - DEV + TUNNEL
echo ========================================
echo.
echo Checking for ngrok...
echo.

cd /d "%~dp0"

REM Check if ngrok is installed
where ngrok >nul 2>nul
if %errorlevel% neq 0 (
    echo ERROR: ngrok is not installed!
    echo.
    echo To fix:
    echo 1. Download ngrok from https://ngrok.com
    echo 2. Extract it to a folder in your PATH
    echo 3. Or add ngrok folder to Windows PATH
    echo.
    echo Quick option: Install with chocolatey
    echo   choco install ngrok
    echo.
    pause
    exit /b 1
)

echo ngrok found! Starting services...
echo.
echo ========================================
echo STEP 1: Starting local server on port 8080
echo ========================================
start /min "HTTP Server" cmd /k "npx http-server -p 8080 -c-1"

timeout /t 2 /nobreak

echo.
echo ========================================
echo STEP 2: Creating ngrok tunnel...
echo ========================================
start "ngrok Tunnel" cmd /k "ngrok http 8080"

timeout /t 3 /nobreak

echo.
echo ========================================
echo SETUP COMPLETE!
echo ========================================
echo.
echo Instructions:
echo   1. Look at the ngrok window
echo   2. Find the forwarding URL (https://xxxx-xxxx.ngrok.io)
echo   3. Copy that URL
echo   4. Update extension-manifest.json:
echo      "url": "https://xxxx-xxxx.ngrok.io/"
echo.
echo   5. Update the manifest URL for Trimble:
echo      https://xxxx-xxxx.ngrok.io/extension-manifest.json
echo.
echo   6. Register in Trimble Connect Admin
echo   7. Test your extension!
echo.
echo Press any key to close this window
pause

REM Keep original window open
cmd /k echo Window ready. Type 'exit' to close all services.
