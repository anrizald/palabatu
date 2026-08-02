# Regenerates palabatu-be/docs/swagger.json from swag annotations on the Go
# handler code. Requires the swag v2 CLI:
#   go install github.com/swaggo/swag/v2/cmd/swag@v2.0.0-rc5
# (installs to %GOPATH%\bin, same as `migrate` -- see scripts/db.ps1)
#
# Usage:
#   .\scripts\gen-api-docs.ps1

$ErrorActionPreference = "Stop"

$repoRoot = Split-Path -Parent $PSScriptRoot
$beDir = Join-Path $repoRoot "palabatu-be"

if (-not (Get-Command swag -ErrorAction SilentlyContinue)) {
    Write-Error "swag CLI not found on PATH. Install: go install github.com/swaggo/swag/v2/cmd/swag@v2.0.0-rc5"
    exit 1
}

Push-Location $beDir
try {
    swag init -g cmd/api/main.go -o ./docs --outputTypes json --parseDependency --parseInternal --v3.1
} finally {
    Pop-Location
}

Write-Host "Regenerated palabatu-be/docs/swagger.json -- review the diff and commit it."
