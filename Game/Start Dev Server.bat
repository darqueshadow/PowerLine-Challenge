@echo off
title PowerLine Challenge — Dev Server
echo.
echo   PowerLine Challenge — Dev Server
echo   =================================
echo   Server running at: http://localhost:8000
echo   Opening browser...
echo.
echo   Press Ctrl+C to stop the server.
echo.
start "" "http://localhost:8000"
cd /d "%~dp0"
python -m http.server 8000
