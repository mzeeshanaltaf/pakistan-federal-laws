# Project Status

Tracks what has actually been built, phase by phase, against the design in `docs/plan/`. This file — not `CLAUDE.md` — is the source of truth for current state, since each phase is implemented in a new session with no memory of prior ones.

## Phase checklist

| Phase | Doc | Status |
|---|---|---|
| 0 | [phase-0-scaffold.md](plan/phase-0-scaffold.md) | ✅ Done |
| 1 | [phase-1-storage-schema.md](plan/phase-1-storage-schema.md) | ⬜ Not started |
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
- `S3_*` — blank. Provisioned in Phase 1 (MinIO bucket + app-scoped key). Not skippable: MinIO is reached via the S3 API regardless of where it's hosted, so `@aws-sdk/client-s3` and `S3_*` are required.

## Phase 0 — Scaffold (done)

- Next.js 16 App Router app (TS strict, Tailwind v4, `src/`), shadcn/ui initialized (`base-nova` preset, `components.json`).
- Dependencies installed: `ai`, `@ai-sdk/openai`, `@ai-sdk/react`, `pg`, `@aws-sdk/client-s3`, `react-pdf`, `react-markdown`+`remark-gfm`, `@upstash/ratelimit`+`@upstash/redis`, `next-themes`, `sonner`, `lucide-react`.
- pdfjs wired for **both** Turbopack and webpack: `canvas-stub.js`, `next.config.ts` `turbopack.resolveAlias`/`webpack` blocks, worker self-hosted at `public/pdf.worker.min.mjs` (excluded from ESLint — it's a minified vendor file). No `PdfViewer` component yet; that's Phase 4 (`pdf-preview` skill).
- `next.config.ts` sets `output: "standalone"` early (needed for the Phase 5 Coolify Dockerfile — harmless one-line addition now, saves a Phase 5 edit).
- Git initialized, pushed to the repo above.
- **Deviation from the plan doc:** `create-next-app` rejects `package.json` names with spaces/capitals, so it couldn't run directly in this directory. Scaffolded into a temp dir named `qanoon`, then moved the generated files in (excluding its own generated `CLAUDE.md`, which would have clobbered this repo's). Package name is `qanoon`.

Not built yet: Postgres schema (`pak_laws`), MinIO bucket, Python ingest pipeline, retrieval/chat routes, UI beyond the `create-next-app` default page. These land in Phases 1–4.

## Session handoff

Each phase is implemented in a new session with no memory of prior sessions. Before ending a phase:

1. Update the phase checklist above and add or edit that phase's section with what was actually built and any deviations from its plan doc.
2. Leave the changes uncommitted for the user to review. **Do not commit or push automatically** — the user reviews the diff and explicitly asks for commit/push when ready.

A new session starting a phase should: read `CLAUDE.md` (auto-loaded), read this file, read `docs/plan/00-overview.md` and that phase's `docs/plan/phase-N-*.md`, then run `git log --oneline` and `git status` first — uncommitted changes may mean the previous phase's work is still awaiting review, not that it doesn't exist.
