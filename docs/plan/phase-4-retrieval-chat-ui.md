# Phase 4 — Retrieval, chat API, UI

See [00-overview.md](00-overview.md) for full context and confirmed decisions.

## Data and retrieval (`src/lib/`)

- **`db.ts`** — pg `Pool` with `search_path=pak_laws`.
- **`storage.ts`** — S3 client, `getDocumentStream(storageKey)` (from the MinIO skill).
- **`usage.ts`** — `recordUsage({provider, model, operation, tokens, …})`; resolves the live price from `model_pricing` and writes `usage_events`. **Every** OpenAI call in the app goes through it.
- **`retrieval.ts`** — **hybrid search**, which matters here because statute questions hinge on exact names ("Section 13 of the Arms Act") where pure vector search drifts:
  - Vector arm: top 40 by `embedding <=> $1` under the scope filter.
  - Lexical arm: top 40 by `ts_rank_cd` on `tsv @@ websearch_to_tsquery('english', $q)`.
  - Fuse with **Reciprocal Rank Fusion** (k=60), keep top 10, cap context at ~6k tokens.
  - Scope filter: none / `category_id = $x` / `document_id = $y`.
- **`intent.ts`** — the token-saving shortcut. Scope is a single document **and** the question matches summary intent (`/\b(summar|overview|gist|tl;?dr|key points|what.*(is|does).*(this|the) (act|law|ordinance).*about)\b/i`) → return the stored summary. No embedding, no retrieval, no LLM, no `usage_events` row.
- **`rag-prompt.ts`** — strict grounding: answer only from the numbered context blocks, cite as `[1]`/`[2]`, say plainly when the retrieved statutes do not cover the question, never invent section numbers, note when a law is old and may have been amended.

## `src/app/api/chat/route.ts` (`ai-sdk` skill)

AI SDK v5 `createUIMessageStream`:
1. Rate-limit by IP (fresh Upstash limiter, fails open when unset).
2. Intent check → stored summary streams straight from the DB, badged `source: "stored-summary"`, return.
3. Embed the question (`recordUsage` → `query_embedding`), hybrid-retrieve, write a `data-citations` part **before** the text so the reference rail renders while tokens stream.
4. `streamText` with `gpt-5.6-luna`, medium reasoning. `onFinish` persists the message + `citations` jsonb **and** calls `recordUsage` with the real usage object (including cached and reasoning tokens).

Other routes: `api/catalog`, `api/suggestions?scope=`, `api/documents/[slug]/summary`, `api/documents/[slug]/file` (streams from MinIO, long cache — the corpus is immutable), `api/chat/history`.

## UI (`impeccable`, plus `nextjs-best-practices` / `vercel-react-best-practices`)

The impeccable skill has hard gates. Run in order, do not skip:

1. **`$impeccable teach`** → author `PRODUCT.md` (register: landing is *brand*, the ask surface is *product*) and `DESIGN.md`. Anti-reference to carry in: **"legal → navy and gold" is exactly the category reflex the skill bans.** Qanoon is a public-good reference tool for ordinary Pakistanis, journalists, students, and paralegals — not a Big Law brochure. Nothing is inherited from DocGenie.
2. **`$impeccable shape`** for the landing page and the ask surface. **Wait for explicit confirmation of the shape brief** before writing any component. Palette, theme, and type are deliberately undecided in this plan.
3. **`$impeccable craft`** each surface.

Surfaces:
- **`/`** — landing. What it is, what it answers, the 21 categories, a live example exchange with a real citation, the disclaimer.
- **`/ask`** — the chat. Scope selector (All laws / category / one law, searchable over 525 titles), streaming answer, suggested-question chips that change with scope, inline `[n]` citation pills.
- **Reference preview** — clicking `[n]` opens a **side panel, not a modal** (impeccable bans modal-as-first-thought, and a reader needs the answer and the statute side by side): title, category, page, PDF via react-pdf **jumped to `page_start`**, page nav, link to the original on pakistancode.gov.pk.
- **`/browse`**, **`/browse/[category]`** — the corpus, browsable.
- **`/law/[slug]`** — per-document: stored summary, key topics, its 3 questions, embedded preview, "Ask about this law" → `/ask` pre-scoped. **525 pages — the SEO surface of this app.**
- `sitemap.ts` (525 + 21 routes), `robots.ts`, `opengraph-image.tsx`.

Client-only state (the `crypto.randomUUID()` session id) sits under a `next/dynamic` `{ ssr: false }` boundary, per the global hydration rule.

**Next:** [phase-5-deploy.md](phase-5-deploy.md)
