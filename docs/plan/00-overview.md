# Qanoon — Pakistan Federal Laws RAG Assistant

## Context

`docs/laws/` holds a scraped corpus of Pakistan's federal statutes from pakistancode.gov.pk: **525 PDFs, 6,487 pages, 21 populated categories, 176 MB**, catalogued in `docs/laws/metadata.json`. Right now it is an inert pile of files — answering "what notice period must a landlord give?" means already knowing which Act to open.

We are building **Qanoon**, a public web app that answers questions about these laws in plain language, grounded strictly in statute text, with clickable citations that open the exact page of the exact PDF. Users ask across the whole corpus, narrow to a category, or pin a single law. Answers stream. Per-document summaries and suggested questions are precomputed and stored, so "summarise this act" costs zero runtime tokens.

## Phase index

| Phase | Doc | What |
|---|---|---|
| 0 | [phase-0-scaffold.md](phase-0-scaffold.md) | Next.js scaffold, dependencies, env |
| 1 | [phase-1-storage-schema.md](phase-1-storage-schema.md) | MinIO bucket, Postgres schema `pak_laws` |
| 2 | [phase-2-ingest-pass-a.md](phase-2-ingest-pass-a.md) | Catalogue, chunk, embed (Python) |
| 3 | [phase-3-ingest-pass-b.md](phase-3-ingest-pass-b.md) | Summaries authored by Claude |
| 4 | [phase-4-retrieval-chat-ui.md](phase-4-retrieval-chat-ui.md) | Retrieval, chat API, UI |
| 5 | [phase-5-deploy.md](phase-5-deploy.md) | Coolify deploy |
| 6 | [phase-6-verification.md](phase-6-verification.md) | Verification queries and checks |

### Confirmed decisions

| | |
|---|---|
| Name | **Qanoon** (قانون) — "Every federal law of Pakistan, answerable." |
| Access | Fully public, no login. Anonymous per-browser session UUID for history. Upstash per-IP rate limit. |
| Vector DB | Existing VPS Postgres 17.7 + pgvector 0.8.1, DB `postgresdb`, schema **`pak_laws`** |
| Embeddings | OpenAI `text-embedding-3-small`, 1536-dim (~$0.10 for the corpus) |
| Answer model | `gpt-5.6-luna`, medium reasoning |
| Summaries | **Authored by Claude in-session**, not via any API. See Phase 3. |
| PDF storage | MinIO on the VPS, private bucket `laws`, proxied through Next.js |
| Ingest order | **Pass A** chunks + embeddings (chat works end-to-end), **Pass B** summaries + questions |
| Cost tracking | Full token + cost ledger in Postgres from day one; dashboard is a later stage |
| Answer policy | Strictly grounded — cite or decline. Persistent "not legal advice" disclaimer. |
| Location | This folder becomes the app root. `docs/laws/` stays, gitignored; `docs/plan/` (phase plans) is tracked. |
| Deploy | Coolify on `qanoon.zeeshanai.cloud`, GitHub Actions auto-deploy |

### Relationship to `../DocGenie`

**Deployment and platform operations: reuse.** Everything else: **build from scratch.**

Reuse — Dockerfile shape (`output: "standalone"`, must contain `curl` for Coolify's health check), `.github/workflows/deploy.yml`, the Coolify app/env conventions, and these recorded platform facts:
- **Never quote env values in Coolify.** It passes quotes through verbatim; dotenv strips them locally. This shipped a broken value once.
- `NEXT_PUBLIC_*` and `DATABASE_URL` must be **build-time** env in Coolify.

Build fresh, do not copy — design tokens and palette (no inherited emerald), all components, the PDF viewer, the rate limiter, the data layer, and the entire backend. **DocGenie routes its backend through n8n; Qanoon does not.** RAG lives in Next.js route handlers talking to pg and OpenAI directly.

### Skills to use

Load each at the phase where it applies rather than all up front.

| Phase | Skill | Why |
|---|---|---|
| 1 | `add-minio-storage-to-coolify` | Bucket, app-scoped key, shared Docker network, `lib/storage.ts` |
| 2, 4 | `ai-sdk` | AI SDK v5 — `streamText`, `embed`/`embedMany`, `useChat`, streaming data parts |
| 2 | `claude-api` | Authority on Claude model ids + pricing, to seed `model_pricing` |
| 4 | `nextjs-best-practices` | App Router, Server Components, data-fetching boundaries |
| 4 | `vercel-react-best-practices` | Render/bundle performance on the 525-page route set |
| 4 | `shadcn` | Component install and composition |
| 4 | `impeccable` | All design work — `teach` → `shape` → `craft` |
| 4 | `pdf-preview` | react-pdf citation preview. **Non-negotiable:** naive `iframe`/`embed`/`object` silently fail in Chrome |
| 4 | `shimmering-progress-dialog` | Optional — status text while retrieval runs across 525 laws |
| 5 | `add-app-to-coolify` | App creation, domain, SSL, auto-deploy |
| 5 | `umami-analytics` | Optional — Umami already runs on the VPS |
| 6 | `code-review`, `security-review` | Pre-deploy passes |
| 6 | `seo-audit` | After the 525 `/law/[slug]` pages exist |

### Verified environment facts

- **VPS** `zeeshanai.cloud` / `76.13.7.106`, KVM 2 (2 vCPU, 8 GB). Coolify 4.3.10 + Traefik v3.6, `postgres-pgvector` (pgvector/pgvector:pg17) with **5432 published**, two MinIO services, Umami, n8n.
- Postgres extensions present: `vector 0.8.1`, `pgcrypto`, `plpgsql`. Existing schemas (`document_genie`, `invoice_extract`, `resume_match`…) confirm the snake_case schema-per-app convention.
- **MinIO is not publicly exposed** — port 9000 `exposed`, not published; no `s3`/`minio` DNS record. Keep it that way (Phase 1).
- All 525 PDFs have **embedded text** (PyMuPDF: ~2,330 chars/page, clean). **No OCR needed.**
- Corpus structure is remarkably consistent: **98%** carry a `CONTENTS` section-heading block, **98%** carry a `Page N of M` running header (strip it), **85%** carry a `WHEREAS`/Preamble.
- Size distribution — pages median 6 / p90 27 / max 318; tokens median **3,302** / p75 7,698 / p90 15,992 / max 203,054.
- `metadata.json` (under `docs/laws/`) has 526 records: 1 has `status: "failed"`. Category names there use `/` (`Banking/Financial Laws`) while folders use `-` — **join on `local_path`, not `category`**. `Minorities Laws/` and `Tenancy Laws/` are empty directories; derive categories from documents actually ingested.
- `DATABASE_URL`, `OPENAI_API_KEY`, `UPSTASH_*`, `S3_*` patterns all exist in sibling projects — reuse the values, not the code.
- Local tooling ready: Python 3.12 with `pymupdf`, `psycopg2`, `tiktoken`, `openai 2.8.1`; Node 24.12 / npm 11.6.

## Open items to confirm during build

- `gpt-5.6-luna` model id, against the live models endpoint.
- Which of the two running MinIO services hosts the `laws` bucket.
- Current OpenAI and Claude prices when seeding `model_pricing`.
- The one `metadata.json` record with `status: "failed"` — skipped for now; worth re-scraping later with `scrape_laws.py`.
