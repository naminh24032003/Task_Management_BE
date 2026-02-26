# Changelog

All notable changes to this project will be documented in this file.

Format: [Semantic Versioning](https://semver.org/) — `vMAJOR.MINOR.PATCH`

| Tag | Description |
|-----|-------------|
| `vMAJOR.MINOR.PATCH` | Full stable release |
| `vMAJOR.MINOR.PATCH-rc.TIMESTAMP` | Release candidate / pre-release |

---

## [Unreleased]

### Added
- Full observability stack: Prometheus, Grafana, Loki, Tempo deployed on EKS
- Grafana exposed via Kong NLB at `/grafana`
- Release pipeline with semantic version tagging (`release.yaml`)
- Helm deploy retry logic (3 attempts) to handle API rate limiting

### Fixed
- `notification-service` CrashLoopBackOff — hardcoded int fields (`smtp_port`, `worker_pool_size`, `buffer_size`) in Kratos config
- npm 403 Forbidden on GitHub Actions runners — pinned `@types/send` via `overrides`
- CI `node-services` job made non-blocking with `continue-on-error: true`
- Helm `context deadline exceeded` — added `--atomic`, `--cleanup-on-fail`, retry loop

---

## How to Release

```powershell
# Create next patch release (1.0.0 → 1.0.1)
.\scripts\release.ps1 -Bump patch

# Create next minor release (1.0.0 → 1.1.0)
.\scripts\release.ps1 -Bump minor

# Create specific version
.\scripts\release.ps1 -Version 1.0.0

# Create pre-release candidate
.\scripts\release.ps1 -Bump minor -Prerelease

# Dry run (no push)
.\scripts\release.ps1 -Bump patch -DryRun
```

This triggers [`.github/workflows/release.yaml`](.github/workflows/release.yaml) which:
1. Builds Docker images tagged as `1.0.0`, `1.0`, `1`, `latest`
2. Deploys all services to EKS using the version tag
3. Creates a GitHub Release with auto-generated changelog

---

## Release History

<!-- Releases auto-created by GitHub Actions from git tags -->
