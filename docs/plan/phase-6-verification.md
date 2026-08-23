# Phase 6 — Verification

See [00-overview.md](00-overview.md) for full context and confirmed decisions.

**Ingest**
```sql
select count(*) from pak_laws.documents;                                  -- 525
select count(*) from pak_laws.document_chunks;                            -- ~5-6k
select sum(num_pages) from pak_laws.documents;                            -- 6487
select count(*) from pak_laws.document_chunks where embedding is null;    -- 0
select count(*) from pak_laws.documents where summary is null;            -- 0 after Phase 3
select count(*) from pak_laws.suggested_questions where scope='document'; -- ~1575
```
Spot-check that a chunk's `page_start` really matches the PDF page holding that text.

**Cost ledger**
```sql
select operation, provider, sum(total_tokens), round(sum(cost_usd),4)
from pak_laws.usage_events group by 1,2 order by 4 desc;
```
Ingest embeddings should land near **$0.10**. Then ask one question and confirm exactly two new rows (`query_embedding` + `chat`) with non-zero `cost_usd`.

**Retrieval** — before any UI, a `scripts/query.ts` harness over a fixed question set:
- *"Punishment for carrying an unlicensed firearm?"* → must cite the Arms Act, 1878.
- *"How much notice must a landlord give before eviction?"* → Rent Laws.
- *"Grounds for khula?"* → Family Laws.
- A deliberately out-of-corpus question (a provincial or traffic matter) → must **decline**, not improvise.
Confirm category- and document-scoped runs never return a chunk from outside the scope.

**App** — `npm run dev`, then: ask unscoped → tokens stream; click `[1]` → panel opens the right PDF at the right page; scope to a category → suggestions change and citations stay inside it; scope to one law and ask "summarise this" → instant, badged as stored, and **zero new `usage_events` rows**; refresh → history restores from the anon session; hammer the endpoint → rate limit trips.

**Build** — `npx tsc --noEmit`, `npm run build`, `code-review` + `security-review` passes, then confirm the deployed `qanoon.zeeshanai.cloud` serves a PDF through the MinIO proxy over HTTPS.

## Open items to confirm during build

- `gpt-5.6-luna` model id, against the live models endpoint.
- Which of the two running MinIO services hosts the `laws` bucket.
- Current OpenAI and Claude prices when seeding `model_pricing`.
- The one `metadata.json` record with `status: "failed"` — skipped for now; worth re-scraping later with `scrape_laws.py`.
