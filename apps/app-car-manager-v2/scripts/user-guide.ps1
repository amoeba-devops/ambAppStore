# =============================================================================
# user-guide.ps1 - one-stop runner for the user-guide HTML site
#
# Usage (from apps/app-car-manager-v2/):
#   .\scripts\user-guide.ps1            # opens the guide in your browser
#   .\scripts\user-guide.ps1 view       # alias for the default
#   .\scripts\user-guide.ps1 dev        # just start the dev server, don't open
#   .\scripts\user-guide.ps1 shots      # re-run Playwright screenshots
#   .\scripts\user-guide.ps1 shots vi   # only the vi-desktop project
#   .\scripts\user-guide.ps1 shots ko   # only the ko-desktop project
#   .\scripts\user-guide.ps1 seed       # idempotent DB seed (dev branch)
#   .\scripts\user-guide.ps1 build      # re-generate search index from HTML
#   .\scripts\user-guide.ps1 stop       # kill any running dev server on :3001
#   .\scripts\user-guide.ps1 status     # report what's running
# =============================================================================

param(
    [Parameter(Position = 0)] [string] $Command = 'view',
    [Parameter(Position = 1)] [string] $Arg
)

$ErrorActionPreference = 'Stop'
$RepoRoot = Split-Path -Parent $PSScriptRoot
$DevPort  = 3001
$GuideUrl = "http://localhost:$DevPort/docs/user-guide/index.html"
$VIUrl    = "http://localhost:$DevPort/docs/user-guide/vi/index.html"
$KOUrl    = "http://localhost:$DevPort/docs/user-guide/ko/index.html"

function Get-DevServerPid {
    $netstat = netstat -ano | Select-String ":$DevPort\s.*LISTENING"
    if ($netstat) { return ($netstat -split '\s+')[-1] }
    return $null
}

# Use a raw TCP probe instead of Invoke-WebRequest — IWR in PS5.1
# NonInteractive mode prompts for credentials on 307 redirects, which
# breaks any wrapper script.
function Test-DevServer {
    try {
        $client = New-Object System.Net.Sockets.TcpClient
        $async = $client.BeginConnect('127.0.0.1', $DevPort, $null, $null)
        $ok = $async.AsyncWaitHandle.WaitOne(2000)
        if ($ok -and $client.Connected) {
            $client.EndConnect($async) | Out-Null
            $client.Close()
            return $true
        }
        $client.Close()
        return $false
    } catch {
        return $false
    }
}

function Start-DevServer {
    Write-Host '-> Starting Next.js dev server on http://localhost:3001 ...' -ForegroundColor Cyan
    # New PowerShell window so the user can see logs and stop with Ctrl+C.
    Start-Process powershell -ArgumentList @(
        '-NoExit',
        '-Command',
        "Set-Location '$RepoRoot'; Write-Host '=== app-car-manager-v2 dev server ===' -ForegroundColor Green; npm run dev"
    ) -WorkingDirectory $RepoRoot

    Write-Host '   Waiting for server to be ready (up to 90s) ...' -NoNewline
    $start = Get-Date
    while ($true) {
        Start-Sleep -Milliseconds 1500
        Write-Host '.' -NoNewline
        if (Test-DevServer) {
            Write-Host ''
            Write-Host '   [OK] Dev server ready' -ForegroundColor Green
            return
        }
        if (((Get-Date) - $start).TotalSeconds -gt 90) {
            Write-Host ''
            Write-Host '   [FAIL] Timed out. Check the other PowerShell window.' -ForegroundColor Red
            exit 1
        }
    }
}

function Stop-DevServer {
    $existingPid = Get-DevServerPid
    if (-not $existingPid) {
        Write-Host '-> No dev server running on :3001.' -ForegroundColor Yellow
        return
    }
    Write-Host "-> Stopping dev server (PID $existingPid) ..." -ForegroundColor Cyan
    Stop-Process -Id $existingPid -Force -ErrorAction SilentlyContinue
    Start-Sleep -Seconds 1
    if (Get-DevServerPid) {
        Write-Host '   [FAIL] Could not kill - try Task Manager' -ForegroundColor Red
    } else {
        Write-Host '   [OK] Stopped' -ForegroundColor Green
    }
}

function Open-Guide {
    param([string] $Url = $GuideUrl)
    Write-Host "-> Opening $Url" -ForegroundColor Cyan
    Start-Process $Url
}

function Invoke-Shots {
    param([string] $Locale)

    if (-not (Test-DevServer)) {
        Write-Host '[FAIL] Dev server not running. Start it first:' -ForegroundColor Red
        Write-Host '       .\scripts\user-guide.ps1 dev' -ForegroundColor Yellow
        exit 1
    }

    $pipelineDir = Join-Path $RepoRoot 'scripts/user-guide'
    if (-not (Test-Path (Join-Path $pipelineDir 'node_modules'))) {
        Write-Host '-> Installing Playwright pipeline deps (first run only) ...' -ForegroundColor Cyan
        Push-Location $pipelineDir
        try {
            npm install
            npx playwright install chromium
        } finally { Pop-Location }
    }

    Push-Location $pipelineDir
    try {
        switch ($Locale) {
            'vi'    { Write-Host '-> Running VI desktop shots ...' -ForegroundColor Cyan
                      npx playwright test --project=vi-desktop }
            'ko'    { Write-Host '-> Running KO desktop shots ...' -ForegroundColor Cyan
                      npx playwright test --project=ko-desktop }
            default { Write-Host '-> Running all shots (vi + ko, desktop + mobile) ...' -ForegroundColor Cyan
                      npx playwright test }
        }
    } finally { Pop-Location }
}

function Invoke-Build {
    Write-Host '-> Regenerating KO skeleton from VI source ...' -ForegroundColor Cyan
    Push-Location $RepoRoot
    try {
        node scripts/generate-ko-skeleton.mjs
        if ($LASTEXITCODE -ne 0) { return }
        Write-Host ''
        Write-Host '-> Translating KO headings + injecting banner ...' -ForegroundColor Cyan
        node scripts/translate-ko-headings.mjs
        if ($LASTEXITCODE -ne 0) { return }
        Write-Host ''
        Write-Host '-> Rebuilding search index ...' -ForegroundColor Cyan
        node scripts/build-user-guide-index.mjs
    } finally { Pop-Location }
}

function Invoke-Seed {
    Write-Host '-> Seeding dev DB (idempotent) ...' -ForegroundColor Cyan
    Push-Location $RepoRoot
    try {
        node scripts/db-seed.mjs dev
        if ($LASTEXITCODE -ne 0) {
            Write-Host '[FAIL] db-seed.mjs failed' -ForegroundColor Red
            return
        }
        Write-Host ''
        node scripts/seed-user-guide.mjs dev
        if ($LASTEXITCODE -ne 0) {
            Write-Host '[FAIL] seed-user-guide.mjs failed' -ForegroundColor Red
        }
    } finally { Pop-Location }
}

function Show-Status {
    $existingPid = Get-DevServerPid
    if ($existingPid) {
        Write-Host "[OK]   Dev server: UP on :$DevPort (PID $existingPid)" -ForegroundColor Green
        Write-Host "       Open:   $GuideUrl"
        Write-Host "       VI:     $VIUrl"
        Write-Host "       KO:     $KOUrl  (not built yet - P6)"
    } else {
        Write-Host "[DOWN] Dev server is not running" -ForegroundColor Yellow
        Write-Host "       Start with:   .\scripts\user-guide.ps1 dev"
    }

    $guideDir = Join-Path $RepoRoot 'apps/web/public/docs/user-guide'
    if (Test-Path $guideDir) {
        $htmlCount = (Get-ChildItem $guideDir -Recurse -Filter '*.html' | Measure-Object).Count
        $pngCount  = (Get-ChildItem $guideDir -Recurse -Filter '*.png'  | Measure-Object).Count
        Write-Host ''
        Write-Host 'Guide content:'
        Write-Host "       HTML pages:  $htmlCount"
        Write-Host "       Screenshots: $pngCount"
    }
}

switch ($Command.ToLower()) {
    'view'   {
        if (-not (Test-DevServer)) { Start-DevServer }
        Open-Guide
    }
    'dev'    {
        if (Test-DevServer) {
            Write-Host '[OK] Dev server already running.' -ForegroundColor Green
        } else {
            Start-DevServer
        }
    }
    'shots'  { Invoke-Shots -Locale $Arg }
    'seed'   { Invoke-Seed }
    'build'  { Invoke-Build }
    'stop'   { Stop-DevServer }
    'status' { Show-Status }
    'help'   {
        Get-Content $PSCommandPath | Select-Object -First 18 | ForEach-Object { Write-Host $_ }
    }
    default  {
        Write-Host "Unknown command: $Command" -ForegroundColor Red
        Write-Host 'Run:   .\scripts\user-guide.ps1 help' -ForegroundColor Yellow
        exit 1
    }
}
