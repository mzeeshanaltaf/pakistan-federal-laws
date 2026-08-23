-- Qanoon schema `pak_laws` on the shared VPS Postgres (postgresdb).
-- Idempotent: safe to run repeatedly against an existing database.
--
-- The HNSW index on document_chunks.embedding is intentionally NOT created
-- here — see db/create-vector-index.sql. Building it after Phase 2's bulk
-- embed is far faster than building it incrementally row-by-row now.

CREATE SCHEMA IF NOT EXISTS pak_laws;

CREATE EXTENSION IF NOT EXISTS vector;
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ============================================================
-- Core content tables
-- ============================================================

CREATE TABLE IF NOT EXISTS pak_laws.categories (
    id             serial PRIMARY KEY,
    slug           text NOT NULL UNIQUE,
    name           text NOT NULL,
    catid          integer,
    blurb          text,
    document_count integer NOT NULL DEFAULT 0,
    sort_order     integer NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS pak_laws.documents (
    id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    slug           text NOT NULL UNIQUE,
    title          text NOT NULL,
    category_id    integer REFERENCES pak_laws.categories (id),
    source_url     text,
    origin_pdf_url text,
    storage_key    text,
    file_size_bytes bigint,
    num_pages      integer,
    checksum       text,
    enacted_year   integer,
    instrument_type text CHECK (instrument_type IN ('Act', 'Ordinance', 'Rules', 'Order')),
    summary        text,
    summary_short  text,
    key_topics     text[],
    summary_author text,
    summary_model  text,
    summarized_at  timestamptz,
    ingest_status  text NOT NULL DEFAULT 'pending',
    ingest_error   text,
    created_at     timestamptz NOT NULL DEFAULT now(),
    updated_at     timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS pak_laws.document_chunks (
    id            bigserial PRIMARY KEY,
    document_id   uuid NOT NULL REFERENCES pak_laws.documents (id) ON DELETE CASCADE,
    category_id   integer REFERENCES pak_laws.categories (id),
    chunk_index   integer NOT NULL,
    page_start    integer,
    page_end      integer,
    section_ref   text,
    content       text NOT NULL,
    token_count   integer,
    embedding     vector(1536),
    tsv           tsvector GENERATED ALWAYS AS (to_tsvector('english', content)) STORED,
    UNIQUE (document_id, chunk_index)
);

CREATE TABLE IF NOT EXISTS pak_laws.suggested_questions (
    id          bigserial PRIMARY KEY,
    scope       text NOT NULL CHECK (scope IN ('document', 'category')),
    document_id uuid REFERENCES pak_laws.documents (id) ON DELETE CASCADE,
    category_id integer REFERENCES pak_laws.categories (id) ON DELETE CASCADE,
    question    text NOT NULL,
    sort_order  integer NOT NULL DEFAULT 0,
    CHECK (
        (scope = 'document' AND document_id IS NOT NULL AND category_id IS NULL) OR
        (scope = 'category' AND category_id IS NOT NULL AND document_id IS NULL)
    )
);

-- ============================================================
-- Chat tables
-- ============================================================

CREATE TABLE IF NOT EXISTS pak_laws.chat_sessions (
    id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    anon_id    text NOT NULL,
    title      text,
    scope_type text NOT NULL CHECK (scope_type IN ('all', 'category', 'document')),
    scope_id   text,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS pak_laws.chat_messages (
    id         bigserial PRIMARY KEY,
    session_id uuid NOT NULL REFERENCES pak_laws.chat_sessions (id) ON DELETE CASCADE,
    role       text NOT NULL CHECK (role IN ('user', 'assistant')),
    content    text NOT NULL,
    citations  jsonb,
    created_at timestamptz NOT NULL DEFAULT now()
);

-- ============================================================
-- Cost-tracking tables
-- ============================================================

CREATE TABLE IF NOT EXISTS pak_laws.model_pricing (
    id                    bigserial PRIMARY KEY,
    provider              text NOT NULL,
    model                 text NOT NULL,
    input_per_mtok        numeric(12, 6) NOT NULL,
    cached_input_per_mtok numeric(12, 6),
    output_per_mtok       numeric(12, 6),
    effective_from        timestamptz NOT NULL DEFAULT now(),
    effective_to          timestamptz,
    UNIQUE (provider, model, effective_from)
);

CREATE TABLE IF NOT EXISTS pak_laws.usage_events (
    id                  bigserial PRIMARY KEY,
    occurred_at         timestamptz NOT NULL DEFAULT now(),
    provider            text NOT NULL,
    model               text NOT NULL,
    operation           text NOT NULL CHECK (operation IN ('chat', 'query_embedding', 'ingest_embedding', 'summary', 'title')),
    session_id          uuid REFERENCES pak_laws.chat_sessions (id) ON DELETE SET NULL,
    message_id          bigint REFERENCES pak_laws.chat_messages (id) ON DELETE SET NULL,
    document_id         uuid REFERENCES pak_laws.documents (id) ON DELETE SET NULL,
    input_tokens        integer,
    cached_input_tokens integer,
    output_tokens       integer,
    reasoning_tokens    integer,
    total_tokens        integer,
    cost_usd            numeric(12, 6),
    is_estimated         boolean NOT NULL DEFAULT false,
    metadata            jsonb
);

CREATE MATERIALIZED VIEW IF NOT EXISTS pak_laws.usage_daily AS
SELECT
    date_trunc('day', occurred_at)::date AS day,
    provider,
    model,
    operation,
    count(*)                    AS event_count,
    sum(input_tokens)           AS input_tokens,
    sum(cached_input_tokens)    AS cached_input_tokens,
    sum(output_tokens)          AS output_tokens,
    sum(reasoning_tokens)       AS reasoning_tokens,
    sum(total_tokens)           AS total_tokens,
    sum(cost_usd)               AS cost_usd
FROM pak_laws.usage_events
GROUP BY 1, 2, 3, 4;

-- ============================================================
-- Indexes
-- ============================================================

CREATE INDEX IF NOT EXISTS document_chunks_tsv_idx ON pak_laws.document_chunks USING gin (tsv);
CREATE INDEX IF NOT EXISTS document_chunks_document_id_idx ON pak_laws.document_chunks (document_id);
CREATE INDEX IF NOT EXISTS document_chunks_category_id_idx ON pak_laws.document_chunks (category_id);
CREATE INDEX IF NOT EXISTS documents_category_id_idx ON pak_laws.documents (category_id);
CREATE INDEX IF NOT EXISTS chat_messages_session_id_idx ON pak_laws.chat_messages (session_id);
CREATE INDEX IF NOT EXISTS suggested_questions_document_id_idx ON pak_laws.suggested_questions (document_id);
CREATE INDEX IF NOT EXISTS suggested_questions_category_id_idx ON pak_laws.suggested_questions (category_id);
CREATE INDEX IF NOT EXISTS usage_events_occurred_at_idx ON pak_laws.usage_events (occurred_at);
CREATE INDEX IF NOT EXISTS usage_events_operation_idx ON pak_laws.usage_events (operation);
CREATE INDEX IF NOT EXISTS usage_events_session_id_idx ON pak_laws.usage_events (session_id);
CREATE UNIQUE INDEX IF NOT EXISTS usage_daily_unique_idx ON pak_laws.usage_daily (day, provider, model, operation);
