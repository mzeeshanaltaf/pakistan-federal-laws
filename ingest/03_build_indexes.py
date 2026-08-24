"""Phase 2 / Pass A step 3 — build the HNSW vector index, ANALYZE, and
refresh categories.document_count.

Run once after 02_chunk_embed.py finishes loading document_chunks — the
HNSW index builds far faster after the bulk insert than incrementally.

Usage: python ingest/03_build_indexes.py
"""
from common import PROJECT_ROOT, get_conn


def main():
    vector_index_sql = (PROJECT_ROOT / "db" / "create-vector-index.sql").read_text(encoding="utf-8")

    conn = get_conn()
    conn.autocommit = True
    with conn.cursor() as cur:
        print("Building HNSW index on document_chunks.embedding...")
        cur.execute(vector_index_sql)

        print("Re-asserting GIN index on document_chunks.tsv...")
        cur.execute(
            "CREATE INDEX IF NOT EXISTS document_chunks_tsv_idx ON pak_laws.document_chunks USING gin (tsv)"
        )

        print("ANALYZE document_chunks, documents...")
        cur.execute("ANALYZE pak_laws.document_chunks")
        cur.execute("ANALYZE pak_laws.documents")

        print("Refreshing categories.document_count...")
        cur.execute(
            """
            UPDATE pak_laws.categories c
            SET document_count = (
                SELECT count(*) FROM pak_laws.documents d
                WHERE d.category_id = c.id AND d.ingest_status IN ('chunked', 'summarized')
            )
            """
        )

        cur.execute("SELECT count(*) FROM pak_laws.document_chunks")
        chunk_count = cur.fetchone()[0]
        cur.execute("SELECT count(*) FROM pak_laws.documents WHERE ingest_status IN ('chunked', 'summarized')")
        doc_count = cur.fetchone()[0]

    print("---")
    print(f"document_chunks: {chunk_count}")
    print(f"documents chunked: {doc_count}")
    conn.close()


if __name__ == "__main__":
    main()
