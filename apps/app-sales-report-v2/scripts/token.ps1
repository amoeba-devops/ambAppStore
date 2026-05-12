# ============================================================
#  token.ps1 — Mint dev JWT token để login (Windows / PowerShell)
# ============================================================
#  Cách chạy:
#    PS> .\scripts\token.ps1             # default role OWNER (→ ADMIN local)
#    PS> .\scripts\token.ps1 OWNER       # ADMIN
#    PS> .\scripts\token.ps1 MASTER      # ADMIN
#    PS> .\scripts\token.ps1 MANAGER     # MANAGER
#    PS> .\scripts\token.ps1 MEMBER      # OPERATOR
#
#  Script sẽ in ra URL dạng:
#    http://localhost:3000/?ama_token=eyJhbGc...
#  Mở URL trong browser -> cookie được set -> redirect tới /dashboard.
#  Token có hạn 8h.
# ============================================================

[CmdletBinding()]
param(
    [Parameter(Position = 0)]
    [ValidateSet('OWNER', 'MASTER', 'MANAGER', 'MEMBER')]
    [string]$Role = 'OWNER'
)

$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
Set-Location $root

if (-not (Test-Path .env)) {
    Write-Host "LOI: .env chua ton tai. Chay .\scripts\setup.ps1 truoc." -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "Mint dev JWT cho role: $Role" -ForegroundColor Cyan
Write-Host ""
npm run dev:token -- $Role
