# Phase 0 — Scaffold

See [00-overview.md](00-overview.md) for full context and confirmed decisions.

`npx create-next-app@latest` in place (Next 16, App Router, TS strict, Tailwind v4, `src/`), then `npx shadcn@latest init` via the `shadcn` skill.

Dependencies: `ai` + `@ai-sdk/openai` + `@ai-sdk/react`, `pg`, `@aws-sdk/client-s3`, `react-pdf`, `react-markdown` + `remark-gfm`, `@upstash/ratelimit` + `@upstash/redis`, `next-themes`, `sonner`, `lucide-react`.

- `.gitignore`: `docs/laws/`, `__pycache__/`, `scrape_log.txt`, `.env*.local`, `ingest/.cache/`, `ingest/out/`.
- react-pdf/pdfjs setup (worker self-hosted in `public/`, the `canvas` alias needed for **both** turbopack and webpack) comes from the **`pdf-preview` skill**, not from copying DocGenie.
- `.env.local`: `DATABASE_URL`, `OPENAI_API_KEY`, `S3_*`, `UPSTASH_*`, plus `OPENAI_CHAT_MODEL=gpt-5.6-luna`, `OPENAI_EMBED_MODEL=text-embedding-3-small`.

> Verify `gpt-5.6-luna` against `GET https://api.openai.com/v1/models` on first run. The id lives in one env var so a correction is a one-line change.

**Next:** [phase-1-storage-schema.md](phase-1-storage-schema.md)
