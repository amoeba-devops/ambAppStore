# ============================================================
#  setup.ps1 — Cài đặt môi trường local (Windows / PowerShell)
# ============================================================
#  Cách chạy:
#    PS> .\scripts\setup.ps1
#
#  Script này thực hiện 3 bước:
#    1. Kiểm tra Node.js >= 20
#    2. Chạy `npm install` (workspaces: web / worker / cron / db / shared / ui)
#    3. Tạo .env từ .env.example nếu chưa có
# ============================================================

$ErrorActionPreference = 'Stop'

# Di chuyển về thư mục gốc của app v2 (parent của scripts/)
$root = Split-Path -Parent $PSScriptRoot
Set-Location $root

Write-Host ""
Write-Host "===== Setup app-sales-report-v2 (local) =====" -ForegroundColor Cyan
Write-Host ""

# -------- Bước 1: Kiểm tra Node --------
Write-Host "[1/3] Kiem tra Node.js..."
if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
    Write-Host "  LOI: Node.js chua duoc cai dat." -ForegroundColor Red
    Write-Host "       Tai Node 20.x tu https://nodejs.org/ va chay lai script nay." -ForegroundColor Red
    exit 1
}
$nodeVersion = (node --version) -replace '^v', ''
$majorVersion = [int]($nodeVersion -split '\.')[0]
if ($majorVersion -lt 20) {
    Write-Host "  LOI: Can Node >= 20.x (dang co $nodeVersion)." -ForegroundColor Red
    exit 1
}
Write-Host "  OK: Node v$nodeVersion" -ForegroundColor Green

# -------- Bước 2: npm install --------
Write-Host ""
Write-Host "[2/3] npm install (co the mat 1-3 phut lan dau)..."
npm install
if ($LASTEXITCODE -ne 0) {
    Write-Host "  LOI: npm install that bai." -ForegroundColor Red
    exit 1
}
Write-Host "  OK: dependencies da cai dat" -ForegroundColor Green

# -------- Bước 3: tạo .env --------
Write-Host ""
Write-Host "[3/3] Kiem tra file .env..."
if (Test-Path .env) {
    Write-Host "  .env da ton tai - bo qua." -ForegroundColor Yellow
} else {
    if (-not (Test-Path .env.example)) {
        Write-Host "  LOI: khong tim thay .env.example." -ForegroundColor Red
        exit 1
    }
    Copy-Item .env.example .env
    Write-Host "  Da tao .env tu .env.example." -ForegroundColor Green
    Write-Host "  -> Mo .env va dien: DATABASE_URL, JWT_SECRET, AWS_*" -ForegroundColor Yellow
}

# -------- Tổng kết --------
Write-Host ""
Write-Host "===== Setup hoan tat =====" -ForegroundColor Cyan
Write-Host ""
Write-Host "Buoc tiep theo:"
Write-Host "  1. Mo .env, dien DATABASE_URL (Neon) va JWT_SECRET"
Write-Host "  2. .\scripts\db.ps1 migrate     (lan dau - apply schema vao DB)"
Write-Host "  3. .\scripts\dev.ps1             (khoi dong dev server)"
Write-Host "  4. .\scripts\token.ps1 OWNER     (mint JWT de login)"
Write-Host ""
