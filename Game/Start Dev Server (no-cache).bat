@echo off
title PowerLine Challenge - Dev Server (no-cache)
echo.
echo   PowerLine Challenge - Dev Server (NO-CACHE)
echo   ===========================================
echo   Server running at: http://localhost:8000
echo   Caching is DISABLED - a normal reload always loads fresh files,
echo   so you never have to hard-refresh (Ctrl+Shift+R) to see JS/CSS edits.
echo   Opening browser...
echo.
echo   Press Ctrl+C to stop the server.
echo.
start "" "http://localhost:8000"
cd /d "%~dp0"
python dev_server_nocache.py
