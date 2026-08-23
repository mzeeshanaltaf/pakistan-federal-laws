# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project state

This repository is **pre-implementation**. It currently contains only:
- `scrape_laws.py` — the one-time scraper that built the corpus.
- `docs/laws/` — the scraped corpus (gitignored; not committed).
- `docs/plan/` — the phased build plan for **Qanoon**, the app this repo will become.

No Next.js app, Python ingest pipeline, or database schema exists yet — they are specified in the plan but not built. Before writing app code, read `docs/plan/00-overview.md` and the relevant `docs/plan/phase-N-*.md` file; they are the authoritative design and should be kept in sync with whatever is actually implemented as phases land.

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

There is no build, lint, or test tooling yet (no `package.json`, no `requirements.txt`). The only runnable code today is the scraper:

```bash
python scrape_laws.py
```

Requires `requests` and `beautifulsoup4` on the active Python (3.12 confirmed locally); it is resumable — it skips URLs already marked `"status": "ok"` in `docs/laws/metadata.json`, so re-running only fetches what previously failed or is new. Do not run it against the current `docs/laws/metadata.json` without first fixing the `DOCS_DIR` mismatch above, or it will re-scrape everything into a new `docs/` directory instead of continuing `docs/laws/`.

Once Phase 0 (`docs/plan/phase-0-scaffold.md`) lands, this file should be updated with the real `npm run dev` / `build` / `lint` / test commands and the Python ingest scripts' invocation (`ingest/01_catalogue.py`, `02_chunk_embed.py`, etc.).
