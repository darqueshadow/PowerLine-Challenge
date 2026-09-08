@echo off
title Asteroid Command - Rebuild Offline Data
echo.
echo   ASTEROID COMMAND - REBUILD OFFLINE DATA
echo   =======================================
echo   Baking the CSVs into the game so it still has your
echo   latest numbers when you open the HTML file directly.
echo.
cd /d "%~dp0"
python rebuild_offline_data.py
echo.
if errorlevel 1 (
    echo   Something was missing - see the warning above.
) else (
    echo   Done. Double-click "Asteroid Command.html" to play.
)
echo.
pause
