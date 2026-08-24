"""Phase 3 / Pass B step 1 — export one extract file per document for me
(Claude) to read and summarize directly.

Document <=6000 tokens -> full cleaned text (covers ~69% of the corpus).
Otherwise -> CONTENTS block + preamble + sections 1-3 (short title, extent,
definitions) + first ~2500 tokens of body + last ~800 tokens (repeals and
schedules), capped at ~6000 tokens total. Region-finding is heuristic
(regex over the corpus's consistent CONTENTS/WHEREAS/numbered-section
conventions) — good enough for authoring aid, not meant to be exact.

Writes ingest/out/extracts/<slug>.txt (one per document) and
ingest/out/manifest.jsonl (slug, title, category, num_pages, extract_tokens,
truncated).

Idempotent: only selects documents with ingest_status='chunked' (ready for
summarizing, not yet summarized) unless --force also allows 'summarized'.

Usage:
    python ingest/04a_export_extracts.py [--category SLUG] [--only SLUG[,SLUG...]] [--limit N] [--force]
"""
import argparse
import json
import re

import fitz
import tiktoken

from common import LAWS_DIR, PROJECT_ROOT, get_conn

OUT_DIR = PROJECT_ROOT / "ingest" / "out" / "extracts"
MANIFEST_PATH = PROJECT_ROOT / "ingest" / "out" / "manifest.jsonl"

FULL_TEXT_BUDGET = 6000
CONTENTS_BUDGET = 2000
PREAMBLE_BUDGET = 500
SECTIONS_1_3_BUDGET = 800
BODY_HEAD_BUDGET = 2500
BODY_TAIL_BUDGET = 800
TOTAL_BUDGET = 6000

HEADER_RE = re.compile(r"^\s*Page\s+\d+\s+of\s+\d+\s*$", re.IGNORECASE | re.MULTILINE)
CONTENTS_RE = re.compile(r"^\s*(CONTENTS|TABLE OF CONTENTS)\s*$", re.IGNORECASE | re.MULTILINE)
ACT_START_RE = re.compile(r"^\s*(WHEREAS|AN ACT|BE it enacted)\b", re.IGNORECASE | re.MULTILINE)
PREAMBLE_START_RE = re.compile(r"^\s*WHEREAS\b", re.IGNORECASE | re.MULTILINE)
SECTION_RE = re.compile(r"^\s*(\d+)[A-Z]?\.\s+[A-Z]", re.MULTILINE)

ENCODING = tiktoken.get_encoding("cl100k_base")


def n_tokens(text):
    return len(ENCODING.encode(text))


def truncate_tokens(text, max_tokens):
    tokens = ENCODING.encode(text)
    if len(tokens) <= max_tokens:
        return text
    return ENCODING.decode(tokens[:max_tokens])


def tail_tokens(text, max_tokens):
    tokens = ENCODING.encode(text)
    if len(tokens) <= max_tokens:
        return text
    return ENCODING.decode(tokens[-max_tokens:])


def extract_full_text(pdf_path):
    doc = fitz.open(pdf_path)
    try:
        pages = []
        for page_index in range(doc.page_count):
            raw = doc[page_index].get_text()
            text = HEADER_RE.sub("", raw)
            text = re.sub(r"[ \t]+", " ", text)
            text = re.sub(r"\n{3,}", "\n\n", text).strip()
            if text:
                pages.append(text)
    finally:
        doc.close()
    return "\n\n".join(pages)


def find_contents_block(text):
    m = CONTENTS_RE.search(text)
    if not m:
        return None
    stop_m = ACT_START_RE.search(text, m.end())
    end = stop_m.start() if stop_m else min(len(text), m.end() + 4000)
    block = text[m.start():end].strip()
    return truncate_tokens(block, CONTENTS_BUDGET) if block else None


def find_preamble(text):
    m = PREAMBLE_START_RE.search(text)
    if not m:
        return None
    end_m = SECTION_RE.search(text, m.end())
    end = end_m.start() if end_m else min(len(text), m.end() + 3000)
    block = text[m.start():end].strip()
    return truncate_tokens(block, PREAMBLE_BUDGET) if block else None


def find_sections_1_3(text):
    """Returns (truncated_text, region_end_offset) or None."""
    matches = list(SECTION_RE.finditer(text))
    if not matches:
        return None
    nums = [int(re.match(r"\d+", m.group(1)).group()) for m in matches]
    start_i = nums.index(1) if 1 in nums else 0
    start = matches[start_i].start()
    end = None
    for i in range(start_i, len(matches)):
        if nums[i] > 3:
            end = matches[i].start()
            break
    if end is None:
        end = min(len(text), start + 4000)
    block = text[start:end].strip()
    if not block:
        return None
    return truncate_tokens(block, SECTIONS_1_3_BUDGET), end


def build_extract(full_text):
    total = n_tokens(full_text)
    if total <= FULL_TEXT_BUDGET:
        return full_text, total, False

    parts = []
    contents = find_contents_block(full_text)
    if contents:
        parts.append(("CONTENTS", contents))

    preamble = find_preamble(full_text)
    if preamble:
        parts.append(("PREAMBLE", preamble))

    body_start = 0
    sections_result = find_sections_1_3(full_text)
    if sections_result:
        sections_text, region_end = sections_result
        parts.append(("SECTIONS 1-3", sections_text))
        body_start = region_end
    elif preamble:
        body_start = full_text.find(preamble) + len(preamble)

    body_head = truncate_tokens(full_text[body_start:], BODY_HEAD_BUDGET)
    if body_head:
        parts.append(("BODY (excerpt, from after definitions)", body_head))

    body_tail = tail_tokens(full_text, BODY_TAIL_BUDGET)
    if body_tail:
        parts.append(("TAIL (excerpt, repeals/schedules)", body_tail))

    assembled = "\n\n".join(f"[{label}]\n{block}" for label, block in parts)
    assembled = truncate_tokens(assembled, TOTAL_BUDGET)
    return assembled, n_tokens(assembled), True


def select_documents(cur, category, only, force, limit):
    conditions = ["d.storage_key IS NOT NULL"]
    params = []
    if category:
        conditions.append("c.slug = %s")
        params.append(category)
    if only:
        conditions.append("d.slug = ANY(%s)")
        params.append(only)
    if force:
        conditions.append("d.ingest_status IN ('chunked', 'summarized')")
    else:
        conditions.append("d.ingest_status = 'chunked'")
    where = " AND ".join(conditions)
    limit_sql = " LIMIT %s" if limit else ""
    if limit:
        params.append(limit)
    cur.execute(
        f"""
        SELECT d.id, d.slug, d.title, c.name, d.storage_key
        FROM pak_laws.documents d
        JOIN pak_laws.categories c ON c.id = d.category_id
        WHERE {where}
        ORDER BY c.slug, d.title
        {limit_sql}
        """,
        params,
    )
    return cur.fetchall()


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--category", help="only export documents in this category slug")
    parser.add_argument("--only", help="comma-separated document slugs to export")
    parser.add_argument("--limit", type=int, help="export at most N documents")
    parser.add_argument("--force", action="store_true", help="also allow already-summarized documents")
    args = parser.parse_args()

    only = args.only.split(",") if args.only else None

    OUT_DIR.mkdir(parents=True, exist_ok=True)

    conn = get_conn()
    with conn.cursor() as cur:
        documents = select_documents(cur, args.category, only, args.force, args.limit)
    conn.close()

    print(f"{len(documents)} document(s) to export")

    manifest_records = []
    for doc_id, slug, title, category_name, storage_key in documents:
        pdf_path = LAWS_DIR / storage_key
        if not pdf_path.exists():
            print(f"MISSING on disk, skipping: {pdf_path}")
            continue

        full_text = extract_full_text(pdf_path)
        extract_text, extract_tokens, truncated = build_extract(full_text)

        out_path = OUT_DIR / f"{slug}.txt"
        header = f"TITLE: {title}\nCATEGORY: {category_name}\nSLUG: {slug}\n\n"
        out_path.write_text(header + extract_text, encoding="utf-8")

        manifest_records.append({
            "slug": slug,
            "title": title,
            "category": category_name,
            "extract_tokens": extract_tokens,
            "truncated": truncated,
        })
        print(f"{'TRUNC' if truncated else 'FULL '} {slug}: {extract_tokens} tokens")

    with open(MANIFEST_PATH, "w", encoding="utf-8") as f:
        for rec in manifest_records:
            f.write(json.dumps(rec, ensure_ascii=False) + "\n")

    total_tokens = sum(r["extract_tokens"] for r in manifest_records)
    print("---")
    print(f"Exported: {len(manifest_records)}")
    print(f"Total extract tokens: {total_tokens}")


if __name__ == "__main__":
    main()
