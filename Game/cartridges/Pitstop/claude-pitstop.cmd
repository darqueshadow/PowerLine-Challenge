@echo off
REM ============================================================================
REM  Pitstop / NEMS 500 - open a Claude Code session on this track.
REM  Double-click, or right-click > Send to > Desktop to make a shortcut.
REM
REM  "Continue_Pitstop" was declared 2026-08-07 in memory/pitstop-track.md, this project's
REM  TRACK HUB. A shortcut can only ever hard-code a DURABLE track word - never a
REM  one-shot handoff word, because those are archived on first use.
REM ============================================================================
REM  🚨 ALWAYS OPEN THIS PROJECT THROUGH THIS SHORTCUT, NOT BY TYPING A PATH.
REM  C:\SharedOneDrive and C:\Users\darqu\OneDrive are THE SAME FOLDER (a
REM  junction). Claude Code keys memory to the exact path string you opened, so
REM  the same project opened both ways gets TWO separate memory stores that
REM  cannot see each other. That has already happened here. Pinning one path is
REM  the whole point of this shortcut.
REM
REM  Five pitstop-* memories moved IN from the PLC root store on 2026-08-07, joining the four already here.
REM
REM  📌 Governance is NOT in memory - it is on disk and auto-loads.
REM  (PCL)/Game/CLAUDE.md loads for every cartridge session as a parent folder;
REM  the Laws / Overview / Build Procedure live outside Game/, see
REM  (PCL)/PLC_Project_Instructions.md and (PCL)/REPO_WIRING.md.
REM ============================================================================
setlocal
cd /d "%~dp0"
echo.
echo   Pitstop / NEMS 500 - Claude Code
echo   ------------------------------------------------
echo   Resuming with: Continue_Pitstop
echo   Session name : Pitstop   (auto mode ON)
echo.
echo   [!] Design notes are on disk beside the cartridge - read those first.
echo.
REM  --permission-mode auto = auto mode ON from the first turn (no Shift+Tab).
REM  -n names the session - it shows in the prompt box, the /resume picker and the
REM  WINDOW TITLE, which is what makes a stack of these tellable apart.
call claude --permission-mode auto -n "Pitstop" "Continue_Pitstop"
endlocal
