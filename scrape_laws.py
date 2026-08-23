import json
import os
import re
import sys
import time
from datetime import datetime, timezone
from urllib.parse import urljoin

import requests
from bs4 import BeautifulSoup

BASE = "https://pakistancode.gov.pk/english/"
MAIN_URL = BASE + "LGu0xVD.php"
DOCS_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "docs")
METADATA_PATH = os.path.join(DOCS_DIR, "metadata.json")
LOG_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), "scrape_log.txt")

HEADERS = {"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)"}
TIMEOUT = 30
RETRIES = 3
SLEEP_BETWEEN = 0.3


def log(msg):
    ts = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    line = f"[{ts}] {msg}"
    print(line)
    with open(LOG_PATH, "a", encoding="utf-8") as f:
        f.write(line + "\n")


def fetch(url, binary=False):
    last_exc = None
    for attempt in range(1, RETRIES + 1):
        try:
            resp = requests.get(url, headers=HEADERS, timeout=TIMEOUT)
            resp.raise_for_status()
            return resp.content if binary else resp.text
        except Exception as e:
            last_exc = e
            log(f"  retry {attempt}/{RETRIES} for {url}: {e}")
            time.sleep(1.5 * attempt)
    raise last_exc


def sanitize_filename(name):
    name = name.strip()
    name = re.sub(r'[<>:"/\\|?*]', "-", name)
    name = re.sub(r"\s+", " ", name)
    name = name.rstrip(". ")
    return name[:180] if len(name) > 180 else name


def get_categories():
    html = fetch(MAIN_URL)
    soup = BeautifulSoup(html, "html.parser")
    cats = []
    seen = set()
    for a in soup.find_all("a", href=True):
        href = a["href"]
        m = re.search(r"catid=(\d+)", href)
        if m and href.startswith("LGu0xVD-"):
            catid = int(m.group(1))
            name = a.get_text(strip=True)
            if catid not in seen and name:
                seen.add(catid)
                cats.append({"catid": catid, "name": name, "url": urljoin(BASE, href)})
    cats.sort(key=lambda c: c["catid"])
    return cats


def get_law_links(category_url):
    html = fetch(category_url)
    soup = BeautifulSoup(html, "html.parser")
    laws = []
    seen = set()
    for a in soup.find_all("a", href=True):
        href = a["href"]
        if href.startswith("UY2FqaJw1-") and href.endswith("-sg-jjjjjjjjjjjjj"):
            title_guess = a.get_text(strip=True)
            full_url = urljoin(BASE, href)
            if full_url not in seen:
                seen.add(full_url)
                laws.append({"url": full_url, "title_guess": title_guess})
    return laws


def get_law_detail(law_url):
    html = fetch(law_url)
    soup = BeautifulSoup(html, "html.parser")
    title_tag = soup.find("title")
    title = title_tag.get_text(strip=True) if title_tag else None

    pdf_url = None
    for a in soup.find_all("a", href=True):
        href = a["href"]
        if "pdffiles/" in href and href.lower().endswith(".pdf"):
            pdf_url = href if href.startswith("http") else urljoin(BASE, href)
            break
    if not pdf_url:
        m = re.search(r'(https?://[^"\']*pdffiles/[^"\']+\.pdf)', html, re.IGNORECASE)
        if m:
            pdf_url = m.group(1)

    return title, pdf_url


def unique_path(directory, filename):
    base, ext = os.path.splitext(filename)
    candidate = filename
    i = 2
    while os.path.exists(os.path.join(directory, candidate)):
        candidate = f"{base} ({i}){ext}"
        i += 1
    return candidate


def main():
    os.makedirs(DOCS_DIR, exist_ok=True)

    metadata = []
    if os.path.exists(METADATA_PATH):
        with open(METADATA_PATH, "r", encoding="utf-8") as f:
            try:
                metadata = json.load(f)
            except json.JSONDecodeError:
                metadata = []
    done_urls = {m["source_url"] for m in metadata if m.get("status") == "ok"}

    log("Fetching category list...")
    categories = get_categories()
    log(f"Found {len(categories)} categories.")

    total_ok = 0
    total_fail = 0

    for cat in categories:
        cat_name = cat["name"]
        cat_dir = os.path.join(DOCS_DIR, sanitize_filename(cat_name))
        os.makedirs(cat_dir, exist_ok=True)
        log(f"=== Category: {cat_name} (catid={cat['catid']}) ===")

        try:
            laws = get_law_links(cat["url"])
        except Exception as e:
            log(f"  FAILED to load category page: {e}")
            continue

        log(f"  {len(laws)} law(s) found.")

        for law in laws:
            law_url = law["url"]
            if law_url in done_urls:
                continue

            try:
                title, pdf_url = get_law_detail(law_url)
                if not title:
                    title = law["title_guess"]
                if not pdf_url:
                    raise ValueError("No PDF link found on detail page")

                filename = sanitize_filename(title) + ".pdf"
                filename = unique_path(cat_dir, filename)
                local_path = os.path.join(cat_dir, filename)

                pdf_bytes = fetch(pdf_url, binary=True)
                with open(local_path, "wb") as f:
                    f.write(pdf_bytes)

                rel_path = os.path.relpath(local_path, os.path.dirname(DOCS_DIR))

                metadata.append({
                    "title": title,
                    "category": cat_name,
                    "catid": cat["catid"],
                    "source_url": law_url,
                    "pdf_url": pdf_url,
                    "local_path": rel_path.replace("\\", "/"),
                    "file_size_bytes": len(pdf_bytes),
                    "downloaded_at": datetime.now(timezone.utc).isoformat(),
                    "status": "ok",
                })
                total_ok += 1
                log(f"  OK: {title}")
            except Exception as e:
                metadata.append({
                    "title": law.get("title_guess"),
                    "category": cat_name,
                    "catid": cat["catid"],
                    "source_url": law_url,
                    "pdf_url": None,
                    "local_path": None,
                    "file_size_bytes": None,
                    "downloaded_at": datetime.now(timezone.utc).isoformat(),
                    "status": "failed",
                    "error": str(e),
                })
                total_fail += 1
                log(f"  FAIL: {law.get('title_guess')} -> {e}")

            with open(METADATA_PATH, "w", encoding="utf-8") as f:
                json.dump(metadata, f, indent=2, ensure_ascii=False)

            time.sleep(SLEEP_BETWEEN)

    log(f"=== DONE. Success: {total_ok}, Failed: {total_fail} ===")


if __name__ == "__main__":
    main()
