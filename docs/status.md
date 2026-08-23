# Project Status

Tracks what has actually been built, phase by phase, against the design in `docs/plan/`. This file — not `CLAUDE.md` — is the source of truth for current state, since each phase is implemented in a new session with no memory of prior ones.

## Phase checklist

| Phase | Doc | Status |
|---|---|---|
| 0 | [phase-0-scaffold.md](plan/phase-0-scaffold.md) | ✅ Done |
| 1 | [phase-1-storage-schema.md](plan/phase-1-storage-schema.md) | ✅ Done |
| 2 | [phase-2-ingest-pass-a.md](plan/phase-2-ingest-pass-a.md) | ⬜ Not started |
| 3 | [phase-3-ingest-pass-b.md](plan/phase-3-ingest-pass-b.md) | ⬜ Not started |
| 4 | [phase-4-retrieval-chat-ui.md](plan/phase-4-retrieval-chat-ui.md) | ⬜ Not started |
| 5 | [phase-5-deploy.md](plan/phase-5-deploy.md) | ⬜ Not started |
| 6 | [phase-6-verification.md](plan/phase-6-verification.md) | ⬜ Not started |

## Repo

[github.com/mzeeshanaltaf/pakistan-federal-laws](https://github.com/mzeeshanaltaf/pakistan-federal-laws), `main` branch.

## Environment

`.env.local` is gitignored and populated locally; `.env.example` documents the required keys for a machine that doesn't have it.

- `DATABASE_URL` — set, points at the existing VPS Postgres.
- `OPENAI_API_KEY` — set. `gpt-5.6-luna` verified live against `GET /v1/models`.
- `UPSTASH_REDIS_REST_URL` / `UPSTASH_REDIS_REST_TOKEN` — set.
- `S3_*` — set (Phase 1). `S3_ENDPOINT` is an **internal-only** hostname (`http://minio-<uuid>:9000`) reachable solely from containers on the VPS's shared `coolify` Docker network — it will NOT resolve from a local dev machine. Local `npm run dev` cannot fetch PDFs from MinIO until Qanoon itself is deployed onto that network in Phase 5. `S3_FORCE_PATH_STYLE=true` is required (MinIO serves buckets path-style).
- `COOLIFY_API_TOKEN_ROOT` — a short-lived (7-day), root-scoped Coolify token the user added for one-time Phase 1 provisioning. Not read by the app; safe to delete once expired. `COOLIFY_API_TOKEN` (deploy-scoped) is reserved for Phase 5's GitHub Actions auto-deploy — the two were originally saved under the same key name in `.env.local` and have been disambiguated.

## Phase 0 — Scaffold (done)

- Next.js 16 App Router app (TS strict, Tailwind v4, `src/`), shadcn/ui initialized (`base-nova` preset, `components.json`).
- Dependencies installed: `ai`, `@ai-sdk/openai`, `@ai-sdk/react`, `pg`, `@aws-sdk/client-s3`, `react-pdf`, `react-markdown`+`remark-gfm`, `@upstash/ratelimit`+`@upstash/redis`, `next-themes`, `sonner`, `lucide-react`.
- pdfjs wired for **both** Turbopack and webpack: `canvas-stub.js`, `next.config.ts` `turbopack.resolveAlias`/`webpack` blocks, worker self-hosted at `public/pdf.worker.min.mjs` (excluded from ESLint — it's a minified vendor file). No `PdfViewer` component yet; that's Phase 4 (`pdf-preview` skill).
- `next.config.ts` sets `output: "standalone"` early (needed for the Phase 5 Coolify Dockerfile — harmless one-line addition now, saves a Phase 5 edit).
- Git initialized, pushed to the repo above.
- **Deviation from the plan doc:** `create-next-app` rejects `package.json` names with spaces/capitals, so it couldn't run directly in this directory. Scaffolded into a temp dir named `qanoon`, then moved the generated files in (excluding its own generated `CLAUDE.md`, which would have clobbered this repo's). Package name is `qanoon`.

Not built yet: Postgres schema (`pak_laws`), MinIO bucket, Python ingest pipeline, retrieval/chat routes, UI beyond the `create-next-app` default page. These land in Phases 1–4.

## Phase 1 — Storage and schema (done)

**Schema** — `db/schema.sql` (idempotent — safe to re-run), applied directly to the live VPS Postgres via a one-off Node/`pg` script (no local `psql` client). All 8 tables from the plan doc created (`categories`, `documents`, `document_chunks`, `suggested_questions`, `chat_sessions`, `chat_messages`, `model_pricing`, `usage_events`) plus the `usage_daily` materialized view, GIN/btree indexes, and `pgcrypto`/`vector` extensions.

- `db/create-vector-index.sql` is a **separate** file, deliberately not run by `schema.sql` — the HNSW index must be built *after* Phase 2's bulk embed insert (far faster than incremental). Run it once Phase 2 finishes loading `document_chunks`.
- `db/seed-model-pricing.sql` seeds `model_pricing`: OpenAI `gpt-5.6-luna` ($0.20/$0.02 cached/$1.20 per MTok, post the 2026-07-30 80% price cut) and `text-embedding-3-small` ($0.02/MTok, no output), from web search against OpenAI's current pricing (the pricing page itself 403'd WebFetch — used WebSearch aggregation instead, cross-checked across multiple sources). Anthropic `claude-sonnet-5` seeded at its intro rate ($2/$10 per MTok, active through 2026-08-31) via the `claude-api` skill's cached table — this is the model authoring Phase 3 summaries in-session, so it's seeded for cost-estimation completeness even though that path bills nothing.
- `categories.catid` and `documents.origin_pdf_url` map directly to `metadata.json`'s `catid` and `pdf_url` fields — confirmed by reading a sample of `docs/laws/metadata.json`.

**MinIO** — Plan doc said "the existing MinIO service," but the VPS actually runs two, each already dedicated to an unrelated app (`greetify`, `SolarQuote`) — not a shared/general-purpose instance. Asked the user; chose to provision a **third, dedicated** MinIO service for Qanoon rather than mix storage with another app, matching the existing one-MinIO-per-app pattern on this box.

- New Coolify project **"Qanoon"** created (`project_uuid vuidfopxpavav3aznifqvhrd`), MinIO service deployed into it (`service_uuid mtbcqizandqzfpxcs6pv46jm`), joined to the shared `coolify` Docker network, private bucket `laws` created. Internal endpoint: `http://minio-mtbcqizandqzfpxcs6pv46jm:9000`. Root creds double as the app-scoped key since this MinIO instance serves only Qanoon.
- **Deviation from the `add-minio-storage-to-coolify` skill's script:** this VPS runs Coolify 4.3.10, where `GET /api/v1/deploy` has been replaced by `POST /api/v1/deploy` — the bundled `provision-minio.sh` still uses GET and its deploy step silently no-ops (service created but container never started). Worked around by triggering deploy manually with POST; the script itself hasn't been patched.
- Corpus uploaded per the plan's "one-time upload without exposing MinIO": `scp`'d local `docs/laws/` (176 MB, 525 PDFs) to a VPS staging dir, `mc mirror`'d into `m/laws` from a throwaway container on the `coolify` network (526 objects — the 525 PDFs plus `metadata.json`, which rode along since it lives inside `docs/laws/`), then deleted the staged copy. Bucket key convention matches `metadata.json`'s `local_path` minus the `docs/` prefix, e.g. `Banking-Financial Laws/Bankers' Books Evidence Act, 1891.pdf`.
- `.env.local` `S3_*` populated with the real values (see Environment section above) — **but the endpoint only resolves on the VPS's Docker network**, not from this local dev machine. PDF-serving routes can't be exercised locally until Phase 5 deploys the app onto that network; local dev work through Phase 4 should treat MinIO reads as untestable until then (or use an SSH tunnel as a manual workaround, not set up here).
- **MinIO admin console publicly exposed**, one subdomain per app, each served at its own root — added after Phase 1 for the user to browse buckets in a browser, since the S3 data endpoint isn't reachable off-VPS and Coolify's dashboard has no bucket browser:
  - Qanoon: `https://minio-qanoon.zeeshanai.cloud`
  - Greetify: `https://minio-greetify.zeeshanai.cloud`
  - SolarQuote: `https://minio-solarquote.zeeshanai.cloud`

  This is a deviation from the plan's "keep it private" intent for the S3 *data* endpoint (port 9000, still internal-only) — only the admin *console* (port 9001) is public, gated by each instance's root MinIO login (Qanoon's creds in `.env.local`; Greetify/SolarQuote creds are their own `MINIO_ROOT_USER`/`_PASSWORD`, unchanged).

  **First attempt was path-based routing** (`minio.zeeshanai.cloud/qanoon` etc.) at the user's request, to unify all three under one domain — this **does not work with stock MinIO** and was reverted. Cause, confirmed by downloading and grepping the console's JS bundle: MinIO's console hardcodes `this.baseUrl="/api/v1"` — all its `fetch()` calls use an absolute root path that ignores the HTML `<base href>` (base href only affects relative asset/link resolution, not JS-initiated absolute-path requests). So the SPA shell and static assets loaded fine behind a stripped path prefix, but every API call 503'd against a domain-root path no Traefik router matched, and the console hung on its loading spinner with a blank screen. There's no clean fix short of rewriting `/api/v1` references in the JS bundle on every request (fragile, breaks on every MinIO version bump) — reverted to per-app subdomains instead, each at domain root where MinIO's console actually works. Verified via `GET /api/v1/session` returning `403` (reached MinIO, correctly unauthenticated) rather than `503` (no matching route).
  - Router/middleware/service names in the Traefik labels are suffixed per app (`-qanoon`/`-greetify`/`-solarquote`) — Traefik's Docker provider treats these names as global, so reusing generic names across the three containers would collide.
  - DNS: `minio-qanoon`, `minio-greetify`, `minio-solarquote` A records → `76.13.7.106` (current/working). Two earlier orphaned attempts (`qanoon-minio`, `minio`) have been deleted by the user.
  - Reasonable to fully remove later (drop each service's console Traefik labels, redeploy, delete the three `minio-*` DNS records) once no longer needed for manual inspection.

## Session handoff

Each phase is implemented in a new session with no memory of prior sessions. Before ending a phase:

1. Update the phase checklist above and add or edit that phase's section with what was actually built and any deviations from its plan doc.
2. Leave the changes uncommitted for the user to review. **Do not commit or push automatically** — the user reviews the diff and explicitly asks for commit/push when ready.

A new session starting a phase should: read `CLAUDE.md` (auto-loaded), read this file, read `docs/plan/00-overview.md` and that phase's `docs/plan/phase-N-*.md`, then run `git log --oneline` and `git status` first — uncommitted changes may mean the previous phase's work is still awaiting review, not that it doesn't exist.
