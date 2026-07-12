@echo off
title The Aquanaut
rem Double-click to play The Aquanaut fullscreen (chromeless kiosk window).
rem All the real work lives in launch-aquanaut.ps1, next to this file.
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0launch-aquanaut.ps1"
