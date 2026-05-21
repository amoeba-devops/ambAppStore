# ============================================================
#  dev.ps1 — Khởi động dev server (Windows / PowerShell)
# ============================================================
#  Cách chạy:
#    PS> .\scripts\dev.ps1               # chạy tất cả (web + worker + cron)
#    PS> .\scripts\dev.ps1 web           # chỉ web (http://localhost:3000)
#    PS> .\scripts\dev.ps1 worker        # chỉ background worker
#    PS> .\scripts\dev.ps1 cron          # chạy cron job daily-user-sync 1 lần
#
#  Nếu port 3000 đang bị chiếm:
#    PS> Get-NetTCPConnection -LocalPort 3000 | Select-Object -ExpandProperty OwningProcess | ForEach-Object { Stop-Process -Id $_ -Force }
# ============================================================

[CmdletBinding()]
param(
    [Parameter(Position = 0)]
    [ValidateSet('all', 'web', 'worker', 'cron')]
    [string]$Service = 'all'
)

$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
Set-Location $root

if (-not (Test-Path .env)) {
    Write-Host "LOI: .env chua ton tai. Chay .\scripts\setup.ps1 truoc." -ForegroundColor Red
    exit 1
}

Write-Host ""
switch ($Service) {
    'all' {
        Write-Host "Khoi dong TAT CA services (web + worker + cron) qua turbo..." -ForegroundColor Cyan
        Write-Host "  Web:    http://localhost:3000"
        Write-Host "  Worker: poll sal_upload_sessions PENDING moi 2s"
        Write-Host "  Cron:   chay daily-user-sync 1 lan"
        Write-Host "  Nhan Ctrl+C de dung tat ca."
        Write-Host ""
        npm run dev
    }
    'web' {
        Write-Host "Khoi dong WEB (Next.js)..." -ForegroundColor Cyan
        Write-Host "  URL: http://localhost:3000"
        Write-Host ""
        npm run dev:web
    }
    'worker' {
        Write-Host "Khoi dong WORKER (tsx watch)..." -ForegroundColor Cyan
        Write-Host ""
        npm run dev -w '@v2/worker'
    }
    'cron' {
        Write-Host "Chay CRON one-shot (daily-user-sync)..." -ForegroundColor Cyan
        Write-Host ""
        npm run dev -w '@v2/cron'
    }
}
