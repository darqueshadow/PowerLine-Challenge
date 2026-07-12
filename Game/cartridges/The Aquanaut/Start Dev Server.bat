@echo off
title The Aquanaut — Dev Server
echo.
echo   The Aquanaut — Below The Black
echo   ================================
echo   Server running at: http://localhost:8000
echo   Opening game...
echo.
echo   Press Ctrl+C to stop the server.
echo.
cd /d "%~dp0"
start "" "http://localhost:8000/files/index.html"
python -m http.server 8000
