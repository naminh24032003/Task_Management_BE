# =============================================================================
# Release Script - Create a new version tag and push to trigger release pipeline
# =============================================================================
# Usage:
#   .\scripts\release.ps1 -Version 1.0.0              # stable release
#   .\scripts\release.ps1 -Version 1.0.0 -Prerelease  # pre-release (rc)
#   .\scripts\release.ps1 -Bump patch                 # auto-bump patch  (1.0.0 → 1.0.1)
#   .\scripts\release.ps1 -Bump minor                 # auto-bump minor  (1.0.0 → 1.1.0)
#   .\scripts\release.ps1 -Bump major                 # auto-bump major  (1.0.0 → 2.0.0)
# =============================================================================

param(
    [string]$Version,
    [ValidateSet("patch", "minor", "major")]
    [string]$Bump,
    [switch]$Prerelease,
    [switch]$DryRun
)

# ---- helpers ---------------------------------------------------------------

function Get-LatestTag {
    $tag = git tag --sort=-version:refname | Where-Object { $_ -match '^v\d+\.\d+\.\d+$' } | Select-Object -First 1
    return $tag
}

function Bump-Version([string]$current, [string]$part) {
    $v = $current.TrimStart('v') -split '\.'
    $major = [int]$v[0]; $minor = [int]$v[1]; $patch = [int]$v[2]
    switch ($part) {
        "major" { $major++; $minor = 0; $patch = 0 }
        "minor" { $minor++; $patch = 0 }
        "patch" { $patch++ }
    }
    return "v${major}.${minor}.${patch}"
}

# ---- resolve version -------------------------------------------------------

if ($Bump) {
    $latest = Get-LatestTag
    if (-not $latest) {
        Write-Host "No existing tags found — starting from v0.0.0" -ForegroundColor Yellow
        $latest = "v0.0.0"
    }
    $newTag = Bump-Version -current $latest -part $Bump
} elseif ($Version) {
    $newTag = if ($Version -notmatch '^v') { "v$Version" } else { $Version }
} else {
    Write-Error "Provide -Version <x.y.z> or -Bump <patch|minor|major>"
    exit 1
}

if ($Prerelease) {
    $timestamp = Get-Date -Format "yyyyMMddHHmm"
    $newTag = "${newTag}-rc.${timestamp}"
}

# ---- confirm ---------------------------------------------------------------

$latest = Get-LatestTag
Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  Current latest tag: $(if ($latest) { $latest } else { '(none)' })"
Write-Host "  New release tag:    $newTag" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

if ($DryRun) {
    Write-Host "[DRY RUN] Would create and push tag: $newTag" -ForegroundColor Yellow
    exit 0
}

$confirm = Read-Host "Create and push tag '$newTag'? (y/N)"
if ($confirm -ne 'y' -and $confirm -ne 'Y') {
    Write-Host "Aborted." -ForegroundColor Red
    exit 0
}

# ---- tag and push ----------------------------------------------------------

Write-Host ""
Write-Host "Creating tag $newTag ..." -ForegroundColor Cyan
git tag -a $newTag -m "Release $newTag"
if ($LASTEXITCODE -ne 0) { Write-Error "git tag failed"; exit 1 }

Write-Host "Pushing tag $newTag to origin ..." -ForegroundColor Cyan
git push origin $newTag
if ($LASTEXITCODE -ne 0) { Write-Error "git push failed"; exit 1 }

Write-Host ""
Write-Host "✔ Tag $newTag pushed!" -ForegroundColor Green
Write-Host "  GitHub Actions release pipeline is now running." -ForegroundColor Gray
Write-Host "  Monitor at: https://github.com/$((git remote get-url origin) -replace '.*github.com[:/](.+?)(.git)?$','$1')/actions" -ForegroundColor Gray
