"""Phase 3 / Pass B step 3 — validate and load category-level content I
(Claude) authored from each category's document titles and summary_short
set: a blurb and 3 suggested questions per category.

Reads ingest/out/category_questions.jsonl, one JSON object per line:
    {"slug": ..., "blurb": ..., "questions": [...]}

For each record: validates the schema, looks up the category by slug,
upserts categories.blurb, and replaces that category's scope='category'
suggested_questions.

Usage:
    python ingest/05_category_questions.py [--file PATH]
"""
import argparse
import json
from pathlib import Path

from common import PROJECT_ROOT, get_conn

CATEGORY_QUESTIONS_PATH = PROJECT_ROOT / "ingest" / "out" / "category_questions.jsonl"


def validate_record(rec):
    errors = []
    if not isinstance(rec.get("slug"), str) or not rec["slug"].strip():
        errors.append("missing/empty string field: slug")
    if not isinstance(rec.get("blurb"), str) or not rec["blurb"].strip():
        errors.append("missing/empty string field: blurb")
    questions = rec.get("questions")
    if not isinstance(questions, list) or not questions or not all(isinstance(q, str) and q.strip() for q in questions):
        errors.append("missing/empty list-of-string field: questions")
    return errors


def upsert_category(cur, category_id, rec):
    cur.execute("UPDATE pak_laws.categories SET blurb = %s WHERE id = %s", (rec["blurb"], category_id))
    cur.execute(
        "DELETE FROM pak_laws.suggested_questions WHERE scope = 'category' AND category_id = %s",
        (category_id,),
    )
    for i, question in enumerate(rec["questions"]):
        cur.execute(
            """
            INSERT INTO pak_laws.suggested_questions (scope, category_id, question, sort_order)
            VALUES ('category', %s, %s, %s)
            """,
            (category_id, question, i),
        )


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--file", default=str(CATEGORY_QUESTIONS_PATH), help="path to category_questions.jsonl")
    args = parser.parse_args()

    path = Path(args.file)
    if not path.is_absolute():
        path = PROJECT_ROOT / args.file
    if not path.exists():
        raise SystemExit(f"category questions file not found: {path}")

    conn = get_conn()
    ok, failed, skipped = 0, 0, 0
    with conn.cursor() as cur:
        with open(path, encoding="utf-8") as f:
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
                cur.execute("SELECT id FROM pak_laws.categories WHERE slug = %s", (slug,))
                row = cur.fetchone()
                if not row:
                    print(f"SKIP {slug}: no matching category")
                    skipped += 1
                    continue
                category_id = row[0]

                try:
                    with conn:
                        upsert_category(cur, category_id, rec)
                    ok += 1
                    print(f"OK   {slug}")
                except Exception as e:
                    conn.rollback()
                    print(f"FAIL {slug}: {e}")
                    failed += 1

    print("---")
    print(f"Loaded: {ok} ok, {failed} failed, {skipped} skipped (no matching category)")
    conn.close()


if __name__ == "__main__":
    main()
