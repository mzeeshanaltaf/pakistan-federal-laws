"""Phase 2 / Pass A step 2 — extract, chunk, and embed the corpus into
pak_laws.document_chunks.

Extracts text per page (so page_start/page_end are exact), strips the
"Page N of M" running header, chunks on ~250 tiktoken tokens with 50-token
(20%) overlap (splitting on paragraph boundaries, never merging across a page
gap larger than one page), embeds in batches of 100 with exponential backoff,
and logs one usage_events row per embedding batch.

Idempotent: skips documents whose ingest_status is already 'chunked' unless
--force is passed (a changed checksum is reset to 'pending' by
01_catalogue.py, so it is picked up automatically).

Usage:
    python ingest/02_chunk_embed.py [--category SLUG] [--only SLUG] [--force] [--resume]
"""
import argparse
import json
import re
import time

import fitz
import tiktoken
from openai import (
    APIConnectionError,
    APITimeoutError,
    InternalServerError,
    OpenAI,
    RateLimitError,
)
from psycopg2.extras import execute_values

from common import LAWS_DIR, OPENAI_API_KEY, OPENAI_EMBED_MODEL, get_conn

BATCH_SIZE = 100
CHUNK_TARGET_TOKENS = 250
CHUNK_OVERLAP_TOKENS = 50
MAX_RETRIES = 6

HEADER_RE = re.compile(r"^\s*Page\s+\d+\s+of\s+\d+\s*$", re.IGNORECASE | re.MULTILINE)
SECTION_HEADING_RE = re.compile(r"^\s*(\d+[A-Z]?)\.\s+[A-Z]")
SENTENCE_SPLIT_RE = re.compile(r"(?<=[.;])\s+(?=[A-Z(0-9])")

ENCODING = tiktoken.get_encoding("cl100k_base")

INSERT_CHUNKS_SQL = """
    INSERT INTO pak_laws.document_chunks
        (document_id, category_id, chunk_index, page_start, page_end, section_ref, content, token_count, embedding)
    VALUES %s
"""
INSERT_USAGE_EVENT_SQL = """
    INSERT INTO pak_laws.usage_events
        (provider, model, operation, document_id, input_tokens, total_tokens, cost_usd, is_estimated, metadata)
    VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)
"""


def split_oversized_paragraph(para, limit=CHUNK_TARGET_TOKENS):
    """Legal-text PDFs don't always have blank-line gaps between clauses, so
    a single paragraph block can occasionally span most of a page. Fall back
    to sentence-boundary splitting only for those oversized blocks, so the
    chunker's atomic units stay close to the token target."""
    if para["tokens"] <= limit:
        return [para]
    pieces, cur, cur_tokens = [], [], 0
    for sentence in SENTENCE_SPLIT_RE.split(para["text"]):
        t = len(ENCODING.encode(sentence))
        if cur and cur_tokens + t > limit:
            pieces.append(" ".join(cur))
            cur, cur_tokens = [], 0
        cur.append(sentence)
        cur_tokens += t
    if cur:
        pieces.append(" ".join(cur))
    return [{"page": para["page"], "text": p, "tokens": len(ENCODING.encode(p))} for p in pieces]


def extract_paragraphs(pdf_path):
    doc = fitz.open(pdf_path)
    paras = []
    try:
        for page_index in range(doc.page_count):
            page_num = page_index + 1
            raw = doc[page_index].get_text()
            text = HEADER_RE.sub("", raw)
            for block in re.split(r"\n\s*\n", text):
                cleaned = re.sub(r"\s+", " ", block).strip()
                if not cleaned:
                    continue
                para = {
                    "page": page_num,
                    "text": cleaned,
                    "tokens": len(ENCODING.encode(cleaned)),
                }
                paras.extend(split_oversized_paragraph(para))
    finally:
        doc.close()
    return paras


def segment_paragraphs(paras):
    segments = []
    current = []
    prev_page = None
    for p in paras:
        if current and p["page"] - prev_page > 1:
            segments.append(current)
            current = []
        current.append(p)
        prev_page = p["page"]
    if current:
        segments.append(current)
    return segments


def chunk_segment(paras, target=CHUNK_TARGET_TOKENS, overlap=CHUNK_OVERLAP_TOKENS):
    n = len(paras)
    result = []
    i = 0
    carry = []
    while i < n:
        cur = list(carry)
        cur_tokens = sum(p["tokens"] for p in cur)
        base_len = len(cur)
        while i < n:
            p = paras[i]
            if len(cur) > base_len and cur_tokens + p["tokens"] > target:
                break
            cur.append(p)
            cur_tokens += p["tokens"]
            i += 1
        result.append(cur)
        if i >= n:
            break
        tail = []
        tail_tokens = 0
        for p in reversed(cur):
            if tail_tokens >= overlap:
                break
            tail.insert(0, p)
            tail_tokens += p["tokens"]
        carry = tail
    return result


def build_chunk_records(pdf_path):
    paras = extract_paragraphs(pdf_path)
    groups = []
    for segment in segment_paragraphs(paras):
        groups.extend(chunk_segment(segment))

    records = []
    for idx, group in enumerate(groups):
        content = "\n\n".join(p["text"] for p in group)
        m = SECTION_HEADING_RE.match(content)
        records.append({
            "chunk_index": idx,
            "page_start": min(p["page"] for p in group),
            "page_end": max(p["page"] for p in group),
            "section_ref": m.group(1) if m else None,
            "content": content,
            "token_count": len(ENCODING.encode(content)),
        })
    return records


def vector_literal(embedding):
    return "[" + ",".join(str(x) for x in embedding) + "]"


def embed_batch(client, texts):
    delay = 1.0
    for attempt in range(1, MAX_RETRIES + 1):
        try:
            return client.embeddings.create(model=OPENAI_EMBED_MODEL, input=texts)
        except (RateLimitError, InternalServerError, APIConnectionError, APITimeoutError) as e:
            if attempt == MAX_RETRIES:
                raise
            print(f"  embedding batch failed (attempt {attempt}/{MAX_RETRIES}): {e}; retrying in {delay:.0f}s")
            time.sleep(delay)
            delay *= 2


def get_pricing_per_mtok(cur):
    cur.execute(
        """
        SELECT input_per_mtok FROM pak_laws.model_pricing
        WHERE provider = 'openai' AND model = %s AND effective_to IS NULL
        ORDER BY effective_from DESC LIMIT 1
        """,
        (OPENAI_EMBED_MODEL,),
    )
    row = cur.fetchone()
    return row[0] if row else None


def process_document(conn, client, pricing_per_mtok, doc_id, category_id, storage_key):
    pdf_path = LAWS_DIR / storage_key
    if not pdf_path.exists():
        raise FileNotFoundError(str(pdf_path))

    chunk_records = build_chunk_records(pdf_path)
    if not chunk_records:
        raise ValueError("no extractable text")

    total_tokens = 0
    with conn:
        with conn.cursor() as cur:
            cur.execute("DELETE FROM pak_laws.document_chunks WHERE document_id = %s", (doc_id,))
            for batch_start in range(0, len(chunk_records), BATCH_SIZE):
                batch = chunk_records[batch_start:batch_start + BATCH_SIZE]
                resp = embed_batch(client, [c["content"] for c in batch])
                rows = [
                    (
                        doc_id, category_id, c["chunk_index"], c["page_start"], c["page_end"],
                        c["section_ref"], c["content"], c["token_count"],
                        vector_literal(item.embedding),
                    )
                    for c, item in zip(batch, resp.data)
                ]
                execute_values(cur, INSERT_CHUNKS_SQL, rows, template="(%s,%s,%s,%s,%s,%s,%s,%s,%s::vector)")

                batch_tokens = resp.usage.total_tokens if resp.usage else sum(c["token_count"] for c in batch)
                total_tokens += batch_tokens
                cost = round(batch_tokens / 1_000_000 * float(pricing_per_mtok), 6) if pricing_per_mtok is not None else None
                cur.execute(INSERT_USAGE_EVENT_SQL, (
                    "openai", OPENAI_EMBED_MODEL, "ingest_embedding", doc_id,
                    batch_tokens, batch_tokens, cost, pricing_per_mtok is None,
                    json.dumps({"chunk_count": len(batch), "batch_start": batch_start}),
                ))

            cur.execute(
                "UPDATE pak_laws.documents SET ingest_status = 'chunked', ingest_error = NULL, updated_at = now() WHERE id = %s",
                (doc_id,),
            )
    return len(chunk_records), total_tokens


def select_documents(cur, category, only, force):
    conditions = ["d.storage_key IS NOT NULL"]
    params = []
    if category:
        conditions.append("c.slug = %s")
        params.append(category)
    if only:
        conditions.append("d.slug = %s")
        params.append(only)
    if not force:
        conditions.append("d.ingest_status != 'chunked'")
    where = " AND ".join(conditions)
    cur.execute(
        f"""
        SELECT d.id, d.slug, d.title, d.category_id, d.storage_key
        FROM pak_laws.documents d
        JOIN pak_laws.categories c ON c.id = d.category_id
        WHERE {where}
        ORDER BY c.slug, d.title
        """,
        params,
    )
    return cur.fetchall()


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--category", help="only process documents in this category slug")
    parser.add_argument("--only", help="only process the document with this slug")
    parser.add_argument("--force", action="store_true", help="reprocess even if already chunked")
    parser.add_argument("--resume", action="store_true", help="skip already-chunked documents (default behavior)")
    args = parser.parse_args()

    if not OPENAI_API_KEY:
        raise RuntimeError("OPENAI_API_KEY is not set (check .env.local)")

    conn = get_conn()
    client = OpenAI(api_key=OPENAI_API_KEY)

    with conn.cursor() as cur:
        pricing_per_mtok = get_pricing_per_mtok(cur)
        documents = select_documents(cur, args.category, args.only, args.force)

    if pricing_per_mtok is None:
        print(f"WARNING: no model_pricing row for openai/{OPENAI_EMBED_MODEL}; usage_events cost will be recorded as NULL/estimated")

    print(f"{len(documents)} document(s) to process")

    ok, failed, total_chunks, total_tokens = 0, 0, 0, 0
    for doc_id, slug, title, category_id, storage_key in documents:
        try:
            n_chunks, n_tokens = process_document(conn, client, pricing_per_mtok, doc_id, category_id, storage_key)
            total_chunks += n_chunks
            total_tokens += n_tokens
            ok += 1
            print(f"OK   {slug}: {n_chunks} chunks, {n_tokens} tokens")
        except Exception as e:
            conn.rollback()
            with conn:
                with conn.cursor() as cur:
                    cur.execute(
                        "UPDATE pak_laws.documents SET ingest_status = 'failed', ingest_error = %s, updated_at = now() WHERE id = %s",
                        (str(e)[:2000], doc_id),
                    )
            failed += 1
            print(f"FAIL {slug}: {e}")

    print("---")
    print(f"Processed: {ok} ok, {failed} failed")
    print(f"Total chunks: {total_chunks}")
    print(f"Total tokens: {total_tokens}")
    if pricing_per_mtok is not None:
        print(f"Estimated cost: ${total_tokens / 1_000_000 * float(pricing_per_mtok):.4f}")
    conn.close()


if __name__ == "__main__":
    main()
