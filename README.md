# Qanoon

Qanoon is a public RAG web app that answers questions about Pakistan's federal statutes in plain language, grounded strictly in statute text, with citations that open the exact page of the exact source PDF.

Live at **[qanoon.zeeshanai.cloud](https://qanoon.zeeshanai.cloud)**.

## What it does

- **Ask** questions about federal law — scoped to all laws, a category, or a single act — and get a streamed, cited answer. Citations render as numbered pills that open a reference panel with the exact PDF page.
- **Browse** the corpus by category, or open any act's page for a precomputed plain-language summary, key topics, and suggested questions.
- **Accounts**: email/password or Google sign-in, email verification and password reset (Better Auth + Resend), a per-user dashboard (conversation stats, "messages remaining," bookmarked answers), and an admin dashboard (platform totals, per-user table, per-user detail with full transcripts, ban/unban, credit adjustment, and in-app PDF ingestion).
- Chat requires sign-in to send a message; browsing, summaries, and suggested questions are public. Every signed-up user gets 10 message credits (admins are unlimited); every model call is logged to a cost ledger.

## Architecture

- **Next.js App Router**, TypeScript, Tailwind v4, shadcn/ui (`base-nova` preset, Base UI). RAG runs in route handlers talking directly to Postgres and OpenAI — no separate orchestration layer.
- **Retrieval**: pgvector cosine search fused with Postgres full-text search via Reciprocal Rank Fusion (RRF) — statute questions hinge on exact section/act names that pure vector search drifts on.
- **Storage**: Postgres + pgvector (schema `pak_laws`) on a VPS instance; source PDFs live in a private MinIO bucket, proxied through Next.js API routes (never exposed directly).
- **Auth**: [Better Auth](https://www.better-auth.com/) — email/password + Google OAuth, email OTP verification, password reset, admin plugin for roles/bans.
- **Cost ledger**: every OpenAI/Claude call (embeddings, chat completions, offline summarization) is logged to a `usage_events` table, priced from a `model_pricing` table.
- **Ingestion**: the original 525-document corpus was processed offline by Python scripts (`ingest/`); a parallel in-app TypeScript pipeline (`src/lib/ingest/`) lets an admin upload, chunk, embed, and summarize new PDFs directly from `/admin/documents`.

See [CLAUDE.md](CLAUDE.md) for the full architectural rationale and [docs/plan/00-overview.md](docs/plan/00-overview.md) for the original design. [docs/status.md](docs/status.md) tracks what's actually been built, phase by phase, including deviations from the plan.

## The corpus

525 PDFs (6,487 pages, ~176 MB) across 21 categories of Pakistani federal statutes, catalogued in `docs/laws/metadata.json`. All chunked (~23k chunks, 250 tokens/50-token overlap), embedded (`text-embedding-3-small`), and summarized (per-document summary, key topics, and suggested questions authored ahead of time and stored — so "summarise this act" is a DB read with zero runtime LLM cost). `docs/laws/` itself is gitignored; only `docs/plan/` is tracked.

## Getting started

```bash
npm install
npm run dev              # dev server (Turbopack), http://localhost:3000
npm run build             # production build
npx next build --webpack  # verify the webpack path too
npm run lint               # eslint
```

Copy `.env.example` to `.env.local` and fill in the required keys (Postgres connection string, OpenAI key, S3/MinIO credentials, Upstash Redis, Better Auth + Google OAuth + Resend, `ADMIN_EMAILS`). Note: the MinIO `S3_ENDPOINT` is only reachable from the VPS's internal Docker network, so PDF/avatar file serving can't be exercised from local dev — see `docs/status.md` for details.

The Python scraper that built the original corpus is runnable independently:

```bash
python scrape_laws.py   # requires requests, beautifulsoup4; resumable
```

Ingest pipeline scripts (`ingest/01_catalogue.py` through `ingest/05_category_questions.py`) reprocess or extend the corpus against the live database — see `docs/status.md` for what each does before running them.

## Tech stack

Next.js 16 · React 19 · TypeScript · Tailwind v4 · shadcn/ui (Base UI) · Vercel AI SDK · OpenAI (`gpt-5.6-luna`, `text-embedding-3-small`) · Postgres + pgvector · Better Auth · Resend · Upstash Redis (rate limiting) · MinIO (S3-compatible object storage) · Docker/Coolify (deployment).

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new). This project instead deploys via Docker to a self-hosted [Coolify](https://coolify.io/) instance — see `docs/status.md`'s Phase 5 notes for the full setup (Dockerfile, env vars, domain/SSL, GitHub Actions auto-deploy).
