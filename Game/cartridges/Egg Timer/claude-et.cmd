@echo off
REM ============================================================================
REM  Egg Timer (formerly Whack A CAV) - open a Claude Code session on this track.
REM  Double-click, or use the "Egg Timer (Claude Code)" desktop shortcut.
REM
REM  "continue_et" was declared 2026-09-15 when Whack A CAV was renamed Egg Timer
REM  (it replaces "continue_wac"); the TRACK HUB is this project's memory track file.
REM  A shortcut can only ever hard-code a DURABLE track word - never a
REM  one-shot handoff word, because those are archived on first use.
REM ============================================================================
REM  🚨 ALWAYS OPEN THIS PROJECT THROUGH THIS SHORTCUT, NOT BY TYPING A PATH.
REM  C:\SharedOneDrive and C:\Users\darqu\OneDrive are THE SAME FOLDER (a
REM  junction). Claude Code keys memory to the exact path string you opened, so
REM  the same project opened both ways gets TWO separate memory stores that
REM  cannot see each other. That has already happened here. Pinning one path is
REM  the whole point of this shortcut.
REM
REM  Store created 2026-09-15 with the cartridge (as Whack A CAV).
REM  It is DESIGN STAGE: the context
REM  packet's open items must be answered before any gameplay code is written.
REM
REM  📌 Governance is NOT in memory - it is on disk and auto-loads.
REM  (PCL)/Game/CLAUDE.md loads for every cartridge session as a parent folder;
REM  the Laws / Overview / Build Procedure live outside Game/, see
REM  (PCL)/PLC_Project_Instructions.md and (PCL)/REPO_WIRING.md.
REM ============================================================================
setlocal
cd /d "%~dp0"
echo.
echo   Egg Timer - Claude Code
echo   ------------------------------------------------
echo   Resuming with: continue_et
echo   Session name : Egg Timer   (auto mode ON)
echo.
echo   [!] Design stage - nothing is build-authorized until the packet's open items are answered.
echo.
REM  --permission-mode auto = auto mode ON from the first turn (no Shift+Tab).
REM  -n names the session - it shows in the prompt box, the /resume picker and the
REM  WINDOW TITLE, which is what makes a stack of these tellable apart.
call claude --permission-mode auto -n "Egg Timer" "continue_et"
endlocal
