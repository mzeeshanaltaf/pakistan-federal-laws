"""Phase 3 / Pass B step 2 — validate and load the summaries I authored into
pak_laws.documents / suggested_questions, and log a usage_events row per
document.

Reads ingest/out/summaries.jsonl, one JSON object per line:
    {"slug": ..., "summary": ..., "summary_short": ...,
     "key_topics": [...], "questions": [...]}

For each record: validates the schema, looks up the document by slug,
upserts summary/summary_short/key_topics, sets summary_author='claude',
summary_model, summarized_at=now(), ingest_status='summarized'; replaces
that document's scope='document' suggested_questions; and writes one
usage_events row (operation='summary', provider='anthropic',
is_estimated=true — tokens are counted from the extract file and the
written summary, not billed API usage, since this phase makes no API call).

Usage:
    python ingest/04b_load_summaries.py [--file PATH]
"""
import argparse
import json
from pathlib import Path

import tiktoken

from common import PROJECT_ROOT, get_conn

SUMMARIES_PATH = PROJECT_ROOT / "ingest" / "out" / "summaries.jsonl"
MANIFEST_PATH = PROJECT_ROOT / "ingest" / "out" / "manifest.jsonl"
EXTRACTS_DIR = PROJECT_ROOT / "ingest" / "out" / "extracts"

SUMMARY_MODEL = "claude-sonnet-5"

ENCODING = tiktoken.get_encoding("cl100k_base")

REQUIRED_STR_FIELDS = ["slug", "summary", "summary_short"]
REQUIRED_LIST_FIELDS = ["key_topics", "questions"]


def validate_record(rec):
    errors = []
    for field in REQUIRED_STR_FIELDS:
        if not isinstance(rec.get(field), str) or not rec[field].strip():
            errors.append(f"missing/empty string field: {field}")
    for field in REQUIRED_LIST_FIELDS:
        val = rec.get(field)
        if not isinstance(val, list) or not val or not all(isinstance(x, str) and x.strip() for x in val):
            errors.append(f"missing/empty list-of-string field: {field}")
    return errors


def load_manifest():
    manifest = {}
    if MANIFEST_PATH.exists():
        with open(MANIFEST_PATH, encoding="utf-8") as f:
            for line in f:
                line = line.strip()
                if not line:
                    continue
                rec = json.loads(line)
                manifest[rec["slug"]] = rec
    return manifest


def get_pricing_per_mtok(cur):
    cur.execute(
        """
        SELECT input_per_mtok, output_per_mtok FROM pak_laws.model_pricing
        WHERE provider = 'anthropic' AND model = %s AND effective_to IS NULL
        ORDER BY effective_from DESC LIMIT 1
        """,
        (SUMMARY_MODEL,),
    )
    row = cur.fetchone()
    return (row[0], row[1]) if row else (None, None)


def upsert_summary(cur, doc_id, rec):
    cur.execute(
        """
        UPDATE pak_laws.documents
        SET summary = %s, summary_short = %s, key_topics = %s,
            summary_author = 'claude', summary_model = %s, summarized_at = now(),
            ingest_status = 'summarized', ingest_error = NULL, updated_at = now()
        WHERE id = %s
        """,
        (rec["summary"], rec["summary_short"], rec["key_topics"], SUMMARY_MODEL, doc_id),
    )
    cur.execute(
        "DELETE FROM pak_laws.suggested_questions WHERE scope = 'document' AND document_id = %s",
        (doc_id,),
    )
    for i, question in enumerate(rec["questions"]):
        cur.execute(
            """
            INSERT INTO pak_laws.suggested_questions (scope, document_id, question, sort_order)
            VALUES ('document', %s, %s, %s)
            """,
            (doc_id, question, i),
        )


def log_usage_event(cur, doc_id, input_tokens, output_tokens, input_per_mtok, output_per_mtok):
    total_tokens = input_tokens + output_tokens
    cost = None
    if input_per_mtok is not None and output_per_mtok is not None:
        cost = round(
            input_tokens / 1_000_000 * float(input_per_mtok)
            + output_tokens / 1_000_000 * float(output_per_mtok),
            6,
        )
    cur.execute(
        """
        INSERT INTO pak_laws.usage_events
            (provider, model, operation, document_id, input_tokens, output_tokens, total_tokens, cost_usd, is_estimated)
        VALUES ('anthropic', %s, 'summary', %s, %s, %s, %s, %s, true)
        """,
        (SUMMARY_MODEL, doc_id, input_tokens, output_tokens, total_tokens, cost),
    )


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--file", default=str(SUMMARIES_PATH), help="path to summaries.jsonl")
    args = parser.parse_args()

    summaries_path = Path(args.file)
    if not summaries_path.is_absolute():
        summaries_path = PROJECT_ROOT / args.file

    if not summaries_path.exists():
        raise SystemExit(f"summaries file not found: {summaries_path}")

    manifest = load_manifest()

    conn = get_conn()
    with conn.cursor() as cur:
        input_per_mtok, output_per_mtok = get_pricing_per_mtok(cur)
    if input_per_mtok is None:
        print(f"WARNING: no model_pricing row for anthropic/{SUMMARY_MODEL}; usage_events cost will be recorded as NULL")

    ok, failed, skipped = 0, 0, 0
    with conn.cursor() as cur:
        with open(summaries_path, encoding="utf-8") as f:
            for line_no, line in enumerate(f, 1):
                line = line.strip()
                if not line:
                    continue
                try:
                    rec = json.loads(line)
                except json.JSONDecodeError as e:
                    print(f"FAIL line {line_no}: invalid JSON: {e}")
                    failed += 1
                    continue

                errors = validate_record(rec)
                if errors:
                    print(f"FAIL {rec.get('slug', '?')}: {'; '.join(errors)}")
                    failed += 1
                    continue

                slug = rec["slug"]
                cur.execute("SELECT id FROM pak_laws.documents WHERE slug = %s", (slug,))
                row = cur.fetchone()
                if not row:
                    print(f"SKIP {slug}: no matching document")
                    skipped += 1
                    continue
                doc_id = row[0]

                manifest_rec = manifest.get(slug)
                if manifest_rec:
                    input_tokens = manifest_rec["extract_tokens"]
                else:
                    extract_path = EXTRACTS_DIR / f"{slug}.txt"
                    input_tokens = len(ENCODING.encode(extract_path.read_text(encoding="utf-8"))) if extract_path.exists() else 0

                written = "\n".join([rec["summary"], rec["summary_short"], *rec["key_topics"], *rec["questions"]])
                output_tokens = len(ENCODING.encode(written))

                try:
                    with conn:
                        upsert_summary(cur, doc_id, rec)
                        log_usage_event(cur, doc_id, input_tokens, output_tokens, input_per_mtok, output_per_mtok)
                    ok += 1
                    print(f"OK   {slug}: {input_tokens} in / {output_tokens} out tokens")
                except Exception as e:
                    conn.rollback()
                    print(f"FAIL {slug}: {e}")
                    failed += 1

    print("---")
    print(f"Loaded: {ok} ok, {failed} failed, {skipped} skipped (no matching document)")
    conn.close()


if __name__ == "__main__":
    main()
