@echo off
REM ============================================================================
REM  PowerLine Challenge (root) - open a Claude Code session on this track.
REM  Double-click, or right-click > Send to > Desktop to make a shortcut.
REM
REM  "Continue_PLC" was declared 2026-08-07 in memory/plc-track.md, this project's
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
REM  This store keeps only what is CROSS-CUTTING. The asteroid-* and pitstop-* memories moved to the cartridges' own stores on 2026-08-07.
REM
REM  📌 Governance is NOT in memory - it is on disk and auto-loads.
REM  (PCL)/Game/CLAUDE.md loads for every cartridge session as a parent folder;
REM  the Laws / Overview / Build Procedure live outside Game/, see
REM  (PCL)/PLC_Project_Instructions.md and (PCL)/REPO_WIRING.md.
REM ============================================================================
setlocal
cd /d "%~dp0"
echo.
echo   PowerLine Challenge (root) - Claude Code
echo   ------------------------------------------------
echo   Resuming with: Continue_PLC
echo   Session name : PLC   (auto mode ON)
echo.
echo   [!] Cross-cutting only - the game memories now live with their cartridges.
echo.
REM  --permission-mode auto = auto mode ON from the first turn (no Shift+Tab).
REM  -n names the session - it shows in the prompt box, the /resume picker and the
REM  WINDOW TITLE, which is what makes a stack of these tellable apart.
call claude --permission-mode auto -n "PLC" "Continue_PLC"
endlocal
