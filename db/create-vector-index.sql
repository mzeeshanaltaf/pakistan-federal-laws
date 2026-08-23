-- Run once, after Phase 2's bulk chunk+embed insert completes — building the
-- HNSW index after the bulk load is far faster than incremental per-row builds.
-- 1536 dims is well under pgvector's 2000-dim HNSW ceiling.

CREATE INDEX IF NOT EXISTS document_chunks_embedding_hnsw_idx
    ON pak_laws.document_chunks
    USING hnsw (embedding vector_cosine_ops)
    WITH (m = 16, ef_construction = 64);
