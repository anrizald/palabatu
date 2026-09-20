# Redeploys palabatu.id: pulls the latest `stage` branch on the VPS and
# rebuilds/restarts the app container. Wraps step 12 of
# hostinger_vps_deployment_handoff.md so the ssh command doesn't have to be
# retyped by hand every time.
#
# Usage:
#   .\scripts\deploy.ps1
#
# Requires the `palabatu` SSH alias (deploy@<vps-ip>, key auth) already
# configured in ~/.ssh/config -- see the vps-access notes. There is a brief
# gap while the container restarts; this is not a zero-downtime deploy (see
# step 12's own note on that).

$ErrorActionPreference = "Stop"

Write-Host "==> Pulling latest stage and rebuilding on the VPS..."
ssh palabatu 'cd /opt/palabatu && git pull && docker compose -f deploy/compose.yml up -d --build'
if ($LASTEXITCODE -ne 0) {
    Write-Error "Deploy command failed on the VPS (exit $LASTEXITCODE)."
    exit 1
}

Write-Host "==> Verifying..."
Start-Sleep -Seconds 3
try {
    $response = Invoke-WebRequest -Uri "https://palabatu.id/api/waitlist/count" -UseBasicParsing -TimeoutSec 10
    if ($response.StatusCode -eq 200) {
        Write-Host "==> Done. Site responded 200 after redeploy."
    } else {
        Write-Warning "Site responded $($response.StatusCode) after redeploy - check manually."
    }
} catch {
    Write-Warning "Could not verify site after redeploy: $($_.Exception.Message)"
}
