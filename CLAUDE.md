# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project state

**Phase 0 (scaffold) is done.** Repo: [github.com/mzeeshanaltaf/pakistan-federal-laws](https://github.com/mzeeshanaltaf/pakistan-federal-laws), pushed to `main`.

What exists:
- Next.js 16 App Router app (TS strict, Tailwind v4, `src/`), shadcn/ui initialized (`base-nova` preset, `components.json`).
- Dependencies installed: `ai`, `@ai-sdk/openai`, `@ai-sdk/react`, `pg`, `@aws-sdk/client-s3`, `react-pdf`, `react-markdown`+`remark-gfm`, `@upstash/ratelimit`+`@upstash/redis`, `next-themes`, `sonner`, `lucide-react`.
- pdfjs wired for **both** Turbopack and webpack: `canvas-stub.js`, `next.config.ts` `turbopack.resolveAlias`/`webpack` blocks, worker self-hosted at `public/pdf.worker.min.mjs` (excluded from ESLint — it's a minified vendor file). No `PdfViewer` component yet; that's Phase 4 (`pdf-preview` skill).
- `next.config.ts` already sets `output: "standalone"` (needed for the Phase 5 Coolify Dockerfile — added early since it's a one-line, zero-risk addition).
- `.env.local` is populated locally with real `DATABASE_URL`, `OPENAI_API_KEY` (verified `gpt-5.6-luna` exists via `GET /v1/models`), and `UPSTASH_*`. `S3_*` is still blank — it's provisioned in Phase 1 (MinIO bucket + app-scoped key), **not skippable**: MinIO is accessed via the S3 API, so `@aws-sdk/client-s3` and `S3_*` are required regardless of where MinIO is hosted. `.env.local` is gitignored; `.env.example` documents the required keys for a machine that doesn't have it.
- `scrape_laws.py` and `docs/laws/` (gitignored corpus) are unchanged from before the scaffold.

Not built yet: Postgres schema (`pak_laws`), MinIO bucket, Python ingest pipeline, retrieval/chat routes, UI beyond the `create-next-app` default page. These land in Phases 1–4.

**Session handoff:** each phase is implemented in a separate session with no memory of this conversation. Before ending a phase, this file's Project state and Commands sections must be updated to match what was actually built, and the phase's plan doc (`docs/plan/phase-N-*.md`) should be corrected if the implementation deviated from it. A new session should: read this file (auto-loaded), read `docs/plan/00-overview.md` and that phase's plan doc, then `git log --oneline` and `git status` to confirm the state this file describes still holds before writing code.

## What this becomes

**Qanoon** is a public RAG web app that answers questions about Pakistan's federal statutes in plain language, grounded strictly in statute text, with citations that open the exact page of the exact source PDF. Key architectural decisions (full detail in `docs/plan/00-overview.md`):

- Next.js App Router app; RAG runs in route handlers talking directly to Postgres and OpenAI (no n8n, unlike the sibling `../DocGenie` project).
- Vector store: Postgres + pgvector, schema `pak_laws`, on the existing VPS instance — not a new database.
- Retrieval is **hybrid**: pgvector cosine search fused with Postgres full-text search via Reciprocal Rank Fusion, because statute questions hinge on exact section/act names that pure vector search drifts on.
- Per-document summaries and suggested questions are precomputed once (authored by Claude reading the statute text directly, not via an API call) and stored, so "summarise this act" is a DB read with zero runtime LLM cost.
- Every model call (OpenAI or Claude) is expected to be logged through a `usage_events` cost ledger — this is a first-class requirement, not an afterthought.
- Source PDFs are served from a private MinIO bucket, proxied through Next.js — never exposed directly.

## The corpus (`docs/laws/`)

- 525 PDFs, 6,487 pages, 21 populated categories, ~176 MB, catalogued in `docs/laws/metadata.json` (526 records; 1 marked `"status": "failed"`).
- All PDFs have embedded text (verified via PyMuPDF) — no OCR needed.
- `metadata.json`'s `category` field uses `/` (e.g. `Banking/Financial Laws`) while the on-disk folder names use `-` — join on `local_path`, never on `category` string equality.
- 98% of documents carry a `CONTENTS` heading block and a `Page N of M` running header (strip the header when extracting text); 85% carry a `WHEREAS`/preamble.
- `docs/laws/` is gitignored. `docs/plan/` is tracked.

**Known gotcha:** `scrape_laws.py` still hardcodes its output to `docs/` (line 14: `DOCS_DIR = ...docs`), but the corpus was moved to `docs/laws/` after scraping. Do not rerun the scraper as-is — either update `DOCS_DIR` first or treat any future ingest/catalogue script as reading from `docs/laws/`, not `docs/`.

## Commands

```bash
npm run dev                  # dev server (Turbopack)
npm run build                # production build
npx next build --webpack     # verify the webpack path too — the canvas alias must work on both
npm run lint                 # eslint
```

The scraper remains runnable independently:

```bash
python scrape_laws.py
```

Requires `requests` and `beautifulsoup4` on the active Python (3.12 confirmed locally); it is resumable — it skips URLs already marked `"status": "ok"` in `docs/laws/metadata.json`, so re-running only fetches what previously failed or is new. Do not run it against the current `docs/laws/metadata.json` without first fixing the `DOCS_DIR` mismatch above, or it will re-scrape everything into a new `docs/` directory instead of continuing `docs/laws/`.

No Python ingest tooling exists yet. Once Phase 2 (`docs/plan/phase-2-ingest-pass-a.md`) lands, this section should gain its invocation commands (`ingest/01_catalogue.py`, `02_chunk_embed.py`, etc.) and any `requirements.txt` install step.
