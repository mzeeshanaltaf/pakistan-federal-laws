"""Phase 2 / Pass A step 1 — catalogue the corpus into pak_laws.categories
and pak_laws.documents.

Reads docs/laws/metadata.json, resolves each `local_path` against disk,
derives category from the folder, slugifies titles, parses enacted_year and
instrument_type from the title, computes sha256 + page_count, and upserts.

Usage: python ingest/01_catalogue.py
"""
import hashlib
import json
import re

import fitz

from common import METADATA_PATH, get_conn, resolve_local_path, slugify, storage_key_for

INSTRUMENT_RE = re.compile(r"\b(Act|Ordinance|Rules|Order)\b", re.IGNORECASE)
YEAR_RE = re.compile(r"\b(1[7-9]\d{2}|20[0-4]\d)\b")


def parse_instrument_type(title: str):
    m = INSTRUMENT_RE.search(title)
    return m.group(1).capitalize() if m else None


def parse_enacted_year(title: str):
    years = YEAR_RE.findall(title)
    return int(years[-1]) if years else None


def upsert_category(cur, cache, folder_name: str, display_name: str, catid):
    slug = slugify(folder_name)
    if slug in cache:
        return cache[slug]
    cur.execute(
        """
        INSERT INTO pak_laws.categories (slug, name, catid)
        VALUES (%s, %s, %s)
        ON CONFLICT (slug) DO UPDATE SET name = EXCLUDED.name, catid = EXCLUDED.catid
        RETURNING id
        """,
        (slug, display_name, catid),
    )
    category_id = cur.fetchone()[0]
    cache[slug] = category_id
    return category_id


def upsert_document(cur, fields):
    cur.execute(
        """
        INSERT INTO pak_laws.documents (
            slug, title, category_id, source_url, origin_pdf_url, storage_key,
            file_size_bytes, num_pages, checksum, enacted_year, instrument_type,
            ingest_status, updated_at
        )
        VALUES (
            %(slug)s, %(title)s, %(category_id)s, %(source_url)s, %(origin_pdf_url)s,
            %(storage_key)s, %(file_size_bytes)s, %(num_pages)s, %(checksum)s,
            %(enacted_year)s, %(instrument_type)s, 'pending', now()
        )
        ON CONFLICT (slug) DO UPDATE SET
            title = EXCLUDED.title,
            category_id = EXCLUDED.category_id,
            source_url = EXCLUDED.source_url,
            origin_pdf_url = EXCLUDED.origin_pdf_url,
            storage_key = EXCLUDED.storage_key,
            file_size_bytes = EXCLUDED.file_size_bytes,
            num_pages = EXCLUDED.num_pages,
            checksum = EXCLUDED.checksum,
            enacted_year = EXCLUDED.enacted_year,
            instrument_type = EXCLUDED.instrument_type,
            ingest_status = CASE
                WHEN pak_laws.documents.checksum IS DISTINCT FROM EXCLUDED.checksum THEN 'pending'
                ELSE pak_laws.documents.ingest_status
            END,
            ingest_error = CASE
                WHEN pak_laws.documents.checksum IS DISTINCT FROM EXCLUDED.checksum THEN NULL
                ELSE pak_laws.documents.ingest_error
            END,
            updated_at = now()
        """,
        fields,
    )


def main():
    with open(METADATA_PATH, encoding="utf-8") as f:
        records = json.load(f)

    conn = get_conn()
    conn.autocommit = True
    category_cache = {}

    ok_count = 0
    skipped = 0
    missing = 0

    with conn.cursor() as cur:
        for record in records:
            if record.get("status") != "ok":
                skipped += 1
                continue

            abs_path = resolve_local_path(record["local_path"])
            if not abs_path.exists():
                print(f"MISSING on disk, skipping: {abs_path}")
                missing += 1
                continue

            category_folder = abs_path.parent.name
            category_id = upsert_category(cur, category_cache, category_folder, record["category"], record.get("catid"))

            title = record["title"]
            checksum = hashlib.sha256(abs_path.read_bytes()).hexdigest()
            page_count = fitz.open(abs_path).page_count

            fields = {
                "slug": slugify(title),
                "title": title,
                "category_id": category_id,
                "source_url": record.get("source_url"),
                "origin_pdf_url": record.get("pdf_url"),
                "storage_key": storage_key_for(record["local_path"]),
                "file_size_bytes": abs_path.stat().st_size,
                "num_pages": page_count,
                "checksum": checksum,
                "enacted_year": parse_enacted_year(title),
                "instrument_type": parse_instrument_type(title),
            }
            upsert_document(cur, fields)
            ok_count += 1
            print(f"[{ok_count}] {title} ({category_folder}, {page_count}p)")

    print("---")
    print(f"Catalogued: {ok_count}")
    print(f"Skipped (failed/non-ok records): {skipped}")
    print(f"Missing on disk: {missing}")
    print(f"Categories: {len(category_cache)}")
    conn.close()


if __name__ == "__main__":
    main()
