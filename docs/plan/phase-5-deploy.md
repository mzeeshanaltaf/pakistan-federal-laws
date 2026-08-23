# Phase 5 — Deploy

See [00-overview.md](00-overview.md) for full context and confirmed decisions.

`add-app-to-coolify`. Dockerfile standalone **with `curl`**, port 3000. DNS: A record `qanoon` → `76.13.7.106` (matching every other subdomain on this zone). Coolify app + Let's Encrypt, app on the MinIO Docker network. GitHub Actions deploy on push to `main` (`COOLIFY_API_TOKEN` / `COOLIFY_APP_UUID`). Optionally wire Umami with the existing `NEXT_PUBLIC_UMAMI_*` values.

Re-check both platform pitfalls before the first deploy: unquoted env values, and `NEXT_PUBLIC_*` set as build-time.

**Next:** [phase-6-verification.md](phase-6-verification.md)
