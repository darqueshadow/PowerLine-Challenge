@echo off
REM ============================================================================
REM  The Aquanaut - open a Claude Code session on this track.
REM  Double-click, or right-click > Send to > Desktop to make a shortcut.
REM
REM  "Continue_Aquanaut" was declared 2026-08-07 in memory/aquanaut-track.md, this project's
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
REM  It has its OWN CLAUDE.md - read that first. Two older SharedOneDrive stores exist and were NOT merged; one of them is misfiled and holds Nerva Beacon notes.
REM
REM  📌 Governance is NOT in memory - it is on disk and auto-loads.
REM  (PCL)/Game/CLAUDE.md loads for every cartridge session as a parent folder;
REM  the Laws / Overview / Build Procedure live outside Game/, see
REM  (PCL)/PLC_Project_Instructions.md and (PCL)/REPO_WIRING.md.
REM ============================================================================
setlocal
cd /d "%~dp0"
echo.
echo   The Aquanaut - Claude Code
echo   ------------------------------------------------
echo   Resuming with: Continue_Aquanaut
echo   Session name : Aquanaut   (auto mode ON)
echo.
echo   [!] Much of it is BUILT BUT NEVER SEEN OR HEARD - ask for eyes and ears.
echo.
REM  --permission-mode auto = auto mode ON from the first turn (no Shift+Tab).
REM  -n names the session - it shows in the prompt box, the /resume picker and the
REM  WINDOW TITLE, which is what makes a stack of these tellable apart.
call claude --permission-mode auto -n "Aquanaut" "Continue_Aquanaut"
endlocal
