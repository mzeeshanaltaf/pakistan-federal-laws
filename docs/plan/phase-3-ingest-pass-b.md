# Phase 3 — Ingest Pass B: summaries authored by Claude

See [00-overview.md](00-overview.md) for full context and confirmed decisions.

Summaries and suggested questions are written by **me**, reading the statute text directly. No OpenAI call in this phase. Three scripts bracket the authoring work:

**`04a_export_extracts.py`** — build one extract file per document under `ingest/out/extracts/`, sized so I can read them at scale:
- Document is **≤6,000 tokens → full cleaned text** (covers 69% of the corpus; median doc is only 3,302 tokens).
- Otherwise → `CONTENTS` block (present in 98%, and it lists every section heading, which compresses a long act extremely well) + preamble + sections 1–3 (short title, extent, definitions) + first ~2,500 tokens of body + last ~800 tokens (repeals and schedules), capped at ~6,000.
- Emits a manifest with slug, title, category, page count, and extract token count.

Total across all 525: **~1.9M input tokens**, comfortably within budget.

**Authoring loop** — I read extracts in **budget-packed batches of ~50k tokens** (~12–20 documents each, ~35–40 batches) and append one JSON object per document to `ingest/out/summaries.jsonl`:
```json
{ "slug": "arms-act-1878", "summary": "…3-6 paragraphs…", "summary_short": "…1-2 sentences…",
  "key_topics": ["licensing", "prohibited bore", "penalties"],
  "questions": ["…", "…", "…"] }
```
Resumable: each batch is chosen by querying for `ingest_status='chunked'`, so an interrupted run simply continues. Style rules for the summaries: plain language, no legalese restatement, name the sections that matter, flag when an Act is old and likely amended, never assert a penalty or period not in the text.

**`04b_load_summaries.py`** — validate each record against the schema, upsert into `documents.summary*` / `key_topics` / `suggested_questions(scope='document')`, set `summary_author='claude'`, `summary_model`, `summarized_at`, `ingest_status='summarized'`. Also writes one `usage_events` row per document (`operation='summary'`, `provider='anthropic'`, `is_estimated=true`, tokens counted from the extract and the written summary) so the ledger reflects total corpus cost, not just OpenAI spend.

**`05_category_questions.py`** — I likewise author each category's `blurb` and 3 category-level questions from that category's `summary_short` set; the script loads them.

**Next:** [phase-4-retrieval-chat-ui.md](phase-4-retrieval-chat-ui.md)
