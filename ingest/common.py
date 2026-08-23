"""Shared helpers for the Qanoon ingest scripts (Phase 2)."""
import os
import re
import sys
from pathlib import Path

import psycopg2
from dotenv import load_dotenv

if sys.stdout.encoding is None or sys.stdout.encoding.lower() != "utf-8":
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    sys.stderr.reconfigure(encoding="utf-8", errors="replace")

PROJECT_ROOT = Path(__file__).resolve().parent.parent
LAWS_DIR = PROJECT_ROOT / "docs" / "laws"
METADATA_PATH = LAWS_DIR / "metadata.json"

load_dotenv(PROJECT_ROOT / ".env.local")

DATABASE_URL = os.environ.get("DATABASE_URL")
OPENAI_API_KEY = os.environ.get("OPENAI_API_KEY")
OPENAI_EMBED_MODEL = os.environ.get("OPENAI_EMBED_MODEL", "text-embedding-3-small")


def get_conn():
    if not DATABASE_URL:
        raise RuntimeError("DATABASE_URL is not set (check .env.local)")
    conn = psycopg2.connect(DATABASE_URL)
    with conn.cursor() as cur:
        cur.execute("SET search_path TO pak_laws, public")
    conn.commit()
    return conn


_SLUG_RE = re.compile(r"[^a-z0-9]+")


def slugify(text: str) -> str:
    slug = text.lower()
    slug = _SLUG_RE.sub("-", slug)
    return slug.strip("-")


def resolve_local_path(record_local_path: str) -> Path:
    """metadata.json's local_path is `docs/<Category>/<Title>.pdf`, but the
    corpus was moved to `docs/laws/` after scraping — strip the `docs/`
    prefix and resolve against LAWS_DIR instead."""
    rel = Path(record_local_path)
    parts = rel.parts
    if parts and parts[0] == "docs":
        parts = parts[1:]
    return LAWS_DIR.joinpath(*parts)


def storage_key_for(record_local_path: str) -> str:
    rel = Path(record_local_path)
    parts = rel.parts
    if parts and parts[0] == "docs":
        parts = parts[1:]
    return "/".join(parts)
