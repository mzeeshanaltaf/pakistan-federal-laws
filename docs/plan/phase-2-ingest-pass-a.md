# Phase 2 — Ingest Pass A: catalogue, chunk, embed (Python, `ingest/`)

See [00-overview.md](00-overview.md) for full context and confirmed decisions.

Python rather than TS: PyMuPDF is the right extractor and is already installed. One-time offline job. Source corpus lives at `docs/laws/` (PDFs + `metadata.json`).

- `01_catalogue.py` — read `docs/laws/metadata.json`, skip the `failed` record, resolve each `local_path` against disk (relative to `docs/laws/`), derive `category` from the **folder**, slugify titles, parse `enacted_year` and `instrument_type` from the title, compute sha256 + `page_count`, upsert `categories` and `documents`.
- `02_chunk_embed.py` —
  - Extract **per page** so `page_start`/`page_end` are exact; strip the `Page N of M` running header (present in 98%); collapse whitespace runs.
  - Chunk on `tiktoken` counts: **~900 tokens, 150 overlap**, splitting on paragraph boundaries, never merging across a gap larger than one page. Capture `section_ref` when a chunk opens on a `^\s*\d+[A-Z]?\.\s+[A-Z]` heading.
  - Batch 100 inputs per embeddings request, exponential backoff on 429/5xx, `execute_values` insert.
  - **Write a `usage_events` row per embedding batch** (`operation='ingest_embedding'`), costed from `model_pricing`.
  - Idempotent: skip documents whose `checksum` is unchanged and `ingest_status='chunked'`. Flags: `--category`, `--only <slug>`, `--resume`, `--force`.
- `03_build_indexes.py` — create HNSW + GIN, `ANALYZE`, refresh `categories.document_count`.

Expect **~5–6k chunks**, ~3.8M tokens, roughly $0.10, 20–40 minutes.

**Next:** [phase-3-ingest-pass-b.md](phase-3-ingest-pass-b.md)
