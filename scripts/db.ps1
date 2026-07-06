# Wrapper around the `migrate` CLI so you don't have to remember its flags
# or re-type a password every time. Reads DATABASE_URL from palabatu-be-go/.env.
#
# Usage:
#   .\scripts\db.ps1 up
#   .\scripts\db.ps1 down          # rolls back ALL migrations (asks to confirm)
#   .\scripts\db.ps1 down 1        # rolls back one step
#   .\scripts\db.ps1 version
#   .\scripts\db.ps1 force 1       # unstick a "dirty" migration state

param(
    [Parameter(Mandatory = $true, Position = 0)]
    [ValidateSet("up", "down", "version", "force")]
    [string]$Command,

    [Parameter(Position = 1)]
    [string]$Arg
)

$ErrorActionPreference = "Stop"

$repoRoot = Split-Path -Parent $PSScriptRoot
$envFile = Join-Path $repoRoot "palabatu-be-go\.env"
# migrate builds a file:// URL from -path; backslashes plus a Windows drive
# letter colon (C:\...) break URL parsing, so force forward slashes.
$migrationsPath = (Join-Path $repoRoot "migrations") -replace '\\', '/'

if (-not (Test-Path $envFile)) {
    Write-Error "Missing $envFile. Create it with a line like: DATABASE_URL=postgresql://postgres:YOUR_LOCAL_PASSWORD@localhost:5432/palabatu_test?sslmode=disable (use your LOCAL postgres password, not the Neon one from palabatu-be/.env)."
    exit 1
}

$databaseUrl = $null
Get-Content $envFile | ForEach-Object {
    if ($_ -match '^\s*DATABASE_URL\s*=\s*(.+?)\s*$') {
        $databaseUrl = $Matches[1]
    }
}

if (-not $databaseUrl) {
    Write-Error "DATABASE_URL not found in $envFile"
    exit 1
}

if ($databaseUrl -match "neon\.tech") {
    Write-Error "DATABASE_URL in $envFile points at Neon (production). Refusing to run - point this at your local Postgres instead."
    exit 1
}

$migrateArgs = @("-path", $migrationsPath, "-database", $databaseUrl, $Command)
if ($Arg) { $migrateArgs += $Arg }

& migrate @migrateArgs
