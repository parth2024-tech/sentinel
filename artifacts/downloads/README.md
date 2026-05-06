# Sentinel native download bundles

The API serves installers from this directory when GitHub Releases are unavailable.

| File | Tier | Slug |
|------|------|------|
| `SentinelSetup.msi` | Tier 1 — Agent installer | `setup` |
| `SentinelOneShot.exe` | Tier 2 — One-shot scan | `oneshot` |
| `SentinelAgent.exe` | Standalone agent binary | `agent` |

## Populate locally (Windows)

```powershell
.\build-native.ps1
Copy-Item artifacts\bin\SentinelOneShot\SentinelOneShot.exe artifacts\downloads\
Copy-Item artifacts\bin\SentinelAgent\SentinelAgent.exe artifacts\downloads\
# MSI from WiX build:
Copy-Item artifacts\bin\SentinelSetup.msi artifacts\downloads\
```

## Production

1. **Preferred:** Tag a release (`native.yml` publishes assets to GitHub Releases).
2. **Override:** Set `SENTINEL_DOWNLOAD_URL_SETUP`, `SENTINEL_DOWNLOAD_URL_ONESHOT`, or `SENTINEL_DOWNLOAD_URL_AGENT` on the API server.
3. **Fallback:** Copy signed binaries into this folder before deploying the API.
