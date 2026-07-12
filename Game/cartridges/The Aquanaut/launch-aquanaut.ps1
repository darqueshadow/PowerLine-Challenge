# ==========================================================================
#  The Aquanaut - Fullscreen Launcher
# ==========================================================================
#  Runs the game as its own chromeless, fullscreen "kiosk" window:
#    1. Serves the cartridge over http://localhost  (CSV loading needs http://,
#       not file://).
#    2. Opens Chrome (or Edge as a fallback) in --kiosk mode, so the WHOLE
#       experience is fullscreen from the first frame - boot console, menus,
#       and the dive - with no tabs or address bar.
#
#  Why kiosk solves the Esc problem: the fullscreen is owned by the browser
#  WINDOW, not the page's Fullscreen API, so Esc reaches the game as an ordinary
#  key (-> pause) instead of dropping you out of fullscreen / showing chrome.
#  There is no browser chrome to reveal in the first place.
#
#  To quit: use the in-game quit, or press Alt+F4.
#  Double-click "Play The Aquanaut.bat" to run this.
#
#  NOTE: keep this file ASCII-only. Windows PowerShell 5.1 reads a no-BOM
#  script as ANSI, so non-ASCII chars (em dashes, box art) corrupt the parse.
# ==========================================================================

$ErrorActionPreference = 'Stop'

$Port       = 8000
$Root       = $PSScriptRoot                                  # this script lives in the cartridge folder
$Url        = "http://localhost:$Port/The%20Aquanaut.html"   # canonical entry (full sonar boot intro)
$ProfileDir = Join-Path $env:LOCALAPPDATA 'TheAquanaut\kiosk-profile'

function Test-Port($p) {
    try { $c = New-Object Net.Sockets.TcpClient; $c.Connect('localhost', $p); $c.Close(); return $true }
    catch { return $false }
}

# --- 1. Start the local server (unless something is already serving this port) ---
$server    = $null
$ownServer = $false
if (Test-Port $Port) {
    Write-Host "Reusing the server already running on port $Port."
} else {
    $python = (Get-Command python -ErrorAction SilentlyContinue).Source
    if (-not $python) { $python = (Get-Command py -ErrorAction SilentlyContinue).Source }
    if (-not $python) {
        Write-Host "ERROR: Python was not found on PATH. Install Python, or start the server manually." -ForegroundColor Red
        Read-Host "Press Enter to close"
        exit 1
    }
    Write-Host "Starting local server on port $Port ..."
    $startArgs = @{
        FilePath         = $python
        ArgumentList     = @('-m', 'http.server', "$Port")
        WorkingDirectory = $Root
        WindowStyle      = 'Minimized'
        PassThru         = $true
    }
    $server    = Start-Process @startArgs
    $ownServer = $true
}

try {
    # --- 2. Wait for the server to answer (up to ~15s) ---
    $ready = $false
    for ($i = 0; $i -lt 30; $i++) {
        if (Test-Port $Port) { $ready = $true; break }
        Start-Sleep -Milliseconds 500
    }
    if (-not $ready) {
        Write-Host "ERROR: the local server did not come up in time." -ForegroundColor Red
        Read-Host "Press Enter to close"
        exit 1
    }

    # --- 3. Locate a Chromium browser (Chrome preferred, Edge as fallback) ---
    $candidates = @(
        "$env:ProgramFiles\Google\Chrome\Application\chrome.exe",
        "${env:ProgramFiles(x86)}\Google\Chrome\Application\chrome.exe",
        "$env:LOCALAPPDATA\Google\Chrome\Application\chrome.exe",
        "${env:ProgramFiles(x86)}\Microsoft\Edge\Application\msedge.exe",
        "$env:ProgramFiles\Microsoft\Edge\Application\msedge.exe"
    )
    $browser = $candidates | Where-Object { Test-Path $_ } | Select-Object -First 1

    # --- 4. Launch fullscreen and block until the game window closes ---
    if ($browser) {
        # Total blank slate: wipe the browser profile so nothing (cache, cookies,
        # localStorage) survives from a previous session. The game also clears its
        # own storage on load; this is the belt-and-suspenders at the browser level.
        if (Test-Path $ProfileDir) { Remove-Item $ProfileDir -Recurse -Force -ErrorAction SilentlyContinue }

        Write-Host "Launching The Aquanaut (fullscreen). Quit with the in-game menu or Alt+F4."
        $browserArgs = @(
            "--user-data-dir=$ProfileDir",   # fresh, dedicated profile (wiped above) so the launch is a clean slate
            '--no-first-run',
            '--no-default-browser-check',
            '--kiosk',
            "--app=$Url"
        )
        Start-Process -FilePath $browser -ArgumentList $browserArgs -Wait
    } else {
        Write-Host "Chrome/Edge not found - opening in your default browser instead." -ForegroundColor Yellow
        Start-Process $Url
        Read-Host "Press Enter when you are done to stop the server and exit"
    }
}
finally {
    # --- 5. Tear down the server we started (never one we found already running) ---
    if ($ownServer -and $server) {
        Write-Host "Shutting down local server ..."
        Stop-Process -Id $server.Id -Force -ErrorAction SilentlyContinue
    }
}
