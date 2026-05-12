# ============================================================
#  db.ps1 — Drizzle / Neon database helpers (Windows / PowerShell)
# ============================================================
#  Cách chạy:
#    PS> .\scripts\db.ps1 generate       # sinh SQL migration từ schema TS
#    PS> .\scripts\db.ps1 migrate        # apply migration vào DATABASE_URL
#    PS> .\scripts\db.ps1 push           # sync nhanh (CẢNH BÁO: destructive)
#    PS> .\scripts\db.ps1 studio         # mở Drizzle Studio (web UI)
#
#  DATABASE_URL được đọc từ file .env ở root v2.
# ============================================================

[CmdletBinding()]
param(
    [Parameter(Position = 0, Mandatory = $true)]
    [ValidateSet('generate', 'migrate', 'push', 'studio')]
    [string]$Command
)

$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
Set-Location $root

if (-not (Test-Path .env)) {
    Write-Host "LOI: .env chua ton tai. Chay .\scripts\setup.ps1 truoc." -ForegroundColor Red
    exit 1
}

Write-Host ""
switch ($Command) {
    'generate' {
        Write-Host "Sinh migration SQL tu Drizzle schema..." -ForegroundColor Cyan
        Write-Host "  Output: packages/db/migrations/NNNN_<name>.sql"
        Write-Host ""
        npm run db:generate
    }
    'migrate' {
        Write-Host "Apply migration vao DATABASE_URL (trong .env)..." -ForegroundColor Cyan
        Write-Host ""
        npm run db:migrate
    }
    'push' {
        Write-Host "[CANH BAO] db:push co the DROP cot/table khong khop schema." -ForegroundColor Yellow
        Write-Host "           Chi dung tren dev branch Neon, KHONG dung production."
        $confirm = Read-Host "Tiep tuc? (yes/N)"
        if ($confirm -ne 'yes') {
            Write-Host "Da huy."
            exit 0
        }
        npm run db:push
    }
    'studio' {
        Write-Host "Mo Drizzle Studio..." -ForegroundColor Cyan
        Write-Host "  URL: https://local.drizzle.studio (mo trong browser)"
        Write-Host ""
        npm run db:studio -w '@v2/db'
    }
}
