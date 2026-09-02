# Regenerates palabatu-be/docs/swagger.json from swag annotations on the Go
# handler code. Requires the swag v2 CLI:
#   go install github.com/swaggo/swag/v2/cmd/swag@v2.0.0-rc5
# (installs to %GOPATH%\bin, same as `migrate` -- see scripts/db.ps1)
#
# Usage:
#   .\scripts\gen-api-docs.ps1

# Deliberately NOT $ErrorActionPreference = "Stop": swag prints a "@host is
# deprecated, use servers instead" *warning* to stderr on every successful
# run, and PowerShell 5.1 wraps any native-command stderr into a terminating
# NativeCommandError. With "Stop" set, that turned a perfectly good run into
# a reported failure -- with docs/swagger.json left unregenerated. The real
# success signal for a native exe is its exit code, checked below.
$repoRoot = Split-Path -Parent $PSScriptRoot
$beDir = Join-Path $repoRoot "palabatu-be"

if (-not (Get-Command swag -ErrorAction SilentlyContinue)) {
    Write-Error "swag CLI not found on PATH. Install: go install github.com/swaggo/swag/v2/cmd/swag@v2.0.0-rc5"
    exit 1
}

Push-Location $beDir
try {
    swag init -g cmd/api/main.go -o ./docs --outputTypes json --parseDependency --parseInternal --v3.1
    $swagExit = $LASTEXITCODE
} finally {
    Pop-Location
}

if ($swagExit -ne 0) {
    Write-Error "swag init failed with exit code $swagExit -- docs/swagger.json was not regenerated."
    exit $swagExit
}

Write-Host "Regenerated palabatu-be/docs/swagger.json -- review the diff and commit it."
