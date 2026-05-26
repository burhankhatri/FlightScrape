"""Hero image lookup via Wikipedia REST API.

Wikipedia exposes a 'summary' endpoint that includes a `thumbnail` and an
`originalimage` field for most city articles. Free, no auth, no rate
limits worth worrying about for personal use, and the photos are usually
decent landmark shots.

We cache the resulting image URL (not the bytes — Streamlit will fetch
them itself, and we don't want to deal with serving binary). The cache
table lives alongside the SQLite cache.
"""

from __future__ import annotations

import sqlite3
import threading
from pathlib import Path
from urllib.parse import quote

import requests

DB_PATH = Path(__file__).resolve().parent.parent / "data" / "cache.db"
_lock = threading.Lock()
WIKI_API = "https://en.wikipedia.org/api/rest_v1/page/summary/"
USER_AGENT = "flighthelper/0.1 (personal travel tool)"

# Manual fallbacks for cases where Wikipedia returns a disambiguation page
# or a misleading thumbnail (e.g. "Bali" → the painting, not the island).
MANUAL_OVERRIDES: dict[str, str] = {
    "Tokyo": "Tokyo",
    "Bangkok": "Bangkok",
    "Bali": "Bali",
    "Denpasar": "Denpasar",
    "Manila": "Manila",
    "Kuala Lumpur": "Kuala Lumpur",
    "Kathmandu": "Kathmandu",
}


def _init() -> None:
    with _lock, sqlite3.connect(str(DB_PATH)) as c:
        c.execute(
            """
            CREATE TABLE IF NOT EXISTS image_cache (
                wiki_title TEXT PRIMARY KEY,
                image_url TEXT
            )
            """
        )


_init()


def _cache_get(title: str) -> str | None:
    with _lock, sqlite3.connect(str(DB_PATH)) as c:
        row = c.execute(
            "SELECT image_url FROM image_cache WHERE wiki_title = ?", (title,)
        ).fetchone()
    return row[0] if row else None


def _cache_set(title: str, url: str | None) -> None:
    with _lock, sqlite3.connect(str(DB_PATH)) as c:
        c.execute(
            "INSERT OR REPLACE INTO image_cache(wiki_title, image_url) VALUES (?, ?)",
            (title, url),
        )


def hero_image(wiki_title: str) -> str | None:
    """Return a hero image URL for a place, or None if Wikipedia has none.

    Cached forever — city landmark photos don't change.
    """
    cached = _cache_get(wiki_title)
    if cached is not None:
        # Empty string means we previously confirmed there's no image.
        return cached or None

    url: str | None = None
    try:
        resp = requests.get(
            WIKI_API + quote(wiki_title.replace(" ", "_")),
            headers={"User-Agent": USER_AGENT, "Accept": "application/json"},
            timeout=5,
        )
        if resp.status_code == 200:
            data = resp.json()
            # Prefer the larger originalimage; fall back to thumbnail.
            url = (data.get("originalimage") or {}).get("source")
            if not url:
                url = (data.get("thumbnail") or {}).get("source")
    except requests.RequestException:
        url = None

    _cache_set(wiki_title, url or "")
    return url
