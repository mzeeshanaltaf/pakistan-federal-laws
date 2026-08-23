# Phase 1 — Storage and schema

See [00-overview.md](00-overview.md) for full context and confirmed decisions.

**MinIO bucket** (`add-minio-storage-to-coolify`) — keep it private:
1. Bucket `laws` on the existing MinIO service; app-scoped access key.
2. Qanoon container joins the same Docker network, reaching `http://minio-<uuid>:9000` internally. `S3_FORCE_PATH_STYLE=true`, `S3_REGION=us-east-1`.
3. **One-time upload without exposing MinIO:** `scp` the 176 MB `docs/laws/` tree to the VPS, `mc mirror` into the bucket from a container on that network, delete the staged copy. A public `s3.` domain is not worth creating for a single upload.

**Schema `pak_laws`** — one idempotent `db/schema.sql`.

Core tables:
- `categories` — `id`, `slug` (`criminal-laws`), `name`, `catid`, `blurb`, `document_count`, `sort_order`
- `documents` — `id uuid`, `slug` unique, `title`, `category_id`, `source_url`, `origin_pdf_url`, `storage_key`, `file_size_bytes`, `num_pages`, `checksum` (sha256, for idempotent re-ingest), `enacted_year`, `instrument_type` (Act/Ordinance/Rules/Order), `summary`, `summary_short`, `key_topics text[]`, `summary_author` (`claude`), `summary_model`, `summarized_at`, `ingest_status`, `ingest_error`, timestamps
- `document_chunks` — `id bigserial`, `document_id`, `category_id` (denormalised for cheap filtering), `chunk_index`, `page_start`, `page_end`, `section_ref`, `content`, `token_count`, `embedding vector(1536)`, `tsv tsvector GENERATED ALWAYS AS (to_tsvector('english', content)) STORED`, `unique(document_id, chunk_index)`
- `suggested_questions` — `scope` check `('document','category')`, nullable `document_id` / `category_id`, `question`, `sort_order`
- `chat_sessions` — `id uuid`, `anon_id`, `title`, `scope_type` (`all|category|document`), `scope_id`, timestamps
- `chat_messages` — `session_id`, `role`, `content`, `citations jsonb`, `created_at`

Cost-tracking tables (new):
- **`model_pricing`** — `provider`, `model`, `input_per_mtok numeric`, `cached_input_per_mtok`, `output_per_mtok`, `effective_from`, `effective_to`. Prices as data, not constants, so a provider price change is an `INSERT` and history stays correct. Seed OpenAI rows from the pricing page and Claude rows via the **`claude-api`** skill.
- **`usage_events`** — `id bigserial`, `occurred_at`, `provider`, `model`, `operation` (`chat|query_embedding|ingest_embedding|summary|title`), `session_id` (nullable), `message_id` (nullable), `document_id` (nullable), `input_tokens`, `cached_input_tokens`, `output_tokens`, `reasoning_tokens`, `total_tokens`, `cost_usd numeric(12,6)`, `is_estimated bool`, `metadata jsonb`. Indexed on `occurred_at`, `operation`, `session_id`.
- **`usage_daily`** — materialised view rolling up cost and tokens by day / operation / model, for the later dashboard to read cheaply instead of scanning the ledger.

Indexes: HNSW on `embedding vector_cosine_ops (m=16, ef_construction=64)`, GIN on `tsv`, btrees on `category_id` / `document_id` / `chat_messages.session_id`.

> Build the HNSW index **after** the bulk insert — far faster than incremental. 1536 dims is well under pgvector's 2000-dim HNSW ceiling.

**Next:** [phase-2-ingest-pass-a.md](phase-2-ingest-pass-a.md)
