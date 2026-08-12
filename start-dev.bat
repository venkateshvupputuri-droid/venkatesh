@echo off
REM ================================================
REM Trimble Extension - Local Development Server
REM ================================================
REM This script starts a local HTTP server for testing
REM Open browser to: http://localhost:8080
REM

cls
echo.
echo ========================================
echo  TRIMBLE EXTENSION - DEV SERVER
echo ========================================
echo.
echo Starting local server on port 8080...
echo.
echo Access points:
echo   Main:        http://localhost:8080
echo   Tests:       http://localhost:8080/TEST_PRODUCT_API.html
echo   Index:       http://localhost:8080/index.html
echo.
echo To test with Trimble Connect:
echo   1. Stop this server (Ctrl+C)
echo   2. Run: start-dev-with-tunnel.bat
echo   3. Use the ngrok URL in your manifest
echo.
echo Press Ctrl+C to stop
echo.
echo ========================================
echo.

cd /d "%~dp0"
npx http-server -p 8080 -c-1

pause
