"""SQLite cache with TTL.

Two tables:
- search_cache: flight search results, keyed by (origin, dest, depart, return, cabin, pax)
- parse_cache: natural-language → parsed-JSON, keyed by raw query string

When a fresh lookup misses we keep the call site simple — return None. The
caller decides whether to also accept *stale* rows (older than TTL) as a
last-resort fallback when all upstream providers are down.
"""

from __future__ import annotations

import json
import sqlite3
import threading
import time
from pathlib import Path
from typing import Any

DB_PATH = Path(__file__).resolve().parent.parent / "data" / "cache.db"
DEFAULT_TTL_SEC = 6 * 60 * 60  # 6 hours
_lock = threading.Lock()


def _conn() -> sqlite3.Connection:
    DB_PATH.parent.mkdir(parents=True, exist_ok=True)
    c = sqlite3.connect(str(DB_PATH), check_same_thread=False)
    c.execute("PRAGMA journal_mode=WAL")
    return c


def _init() -> None:
    with _lock, _conn() as c:
        c.execute(
            """
            CREATE TABLE IF NOT EXISTS search_cache (
                key TEXT PRIMARY KEY,
                value TEXT NOT NULL,
                fetched_at INTEGER NOT NULL,
                source TEXT NOT NULL
            )
            """
        )
        c.execute(
            """
            CREATE TABLE IF NOT EXISTS parse_cache (
                query TEXT PRIMARY KEY,
                parsed TEXT NOT NULL,
                fetched_at INTEGER NOT NULL
            )
            """
        )


_init()


# ---------- search results -----------------------------------------------

def _search_key(origin: str, dest: str, depart: str, ret: str | None, cabin: str, pax: int) -> str:
    return f"{origin}|{dest}|{depart}|{ret or ''}|{cabin}|{pax}"


def get_search(
    origin: str,
    dest: str,
    depart: str,
    ret: str | None,
    cabin: str,
    pax: int,
    ttl_sec: int = DEFAULT_TTL_SEC,
    allow_stale: bool = False,
) -> dict[str, Any] | None:
    """Return cached results or None.

    If allow_stale is True we return any row, regardless of age, and tag it
    with `stale=True` so the UI can warn the user.
    """
    key = _search_key(origin, dest, depart, ret, cabin, pax)
    with _lock, _conn() as c:
        row = c.execute(
            "SELECT value, fetched_at, source FROM search_cache WHERE key = ?",
            (key,),
        ).fetchone()
    if not row:
        return None
    value, fetched_at, source = row
    age = time.time() - fetched_at
    if age > ttl_sec and not allow_stale:
        return None
    data = json.loads(value)
    data["_source"] = source
    data["_age_sec"] = int(age)
    data["_stale"] = age > ttl_sec
    return data


def set_search(
    origin: str,
    dest: str,
    depart: str,
    ret: str | None,
    cabin: str,
    pax: int,
    value: dict[str, Any],
    source: str,
) -> None:
    key = _search_key(origin, dest, depart, ret, cabin, pax)
    with _lock, _conn() as c:
        c.execute(
            "INSERT OR REPLACE INTO search_cache(key, value, fetched_at, source) VALUES (?, ?, ?, ?)",
            (key, json.dumps(value), int(time.time()), source),
        )


# ---------- parsed natural-language queries ------------------------------

def get_parse(query: str) -> dict[str, Any] | None:
    """Parse results never expire — same query always parses the same way."""
    with _lock, _conn() as c:
        row = c.execute(
            "SELECT parsed FROM parse_cache WHERE query = ?",
            (query.strip().lower(),),
        ).fetchone()
    return json.loads(row[0]) if row else None


def set_parse(query: str, parsed: dict[str, Any]) -> None:
    with _lock, _conn() as c:
        c.execute(
            "INSERT OR REPLACE INTO parse_cache(query, parsed, fetched_at) VALUES (?, ?, ?)",
            (query.strip().lower(), json.dumps(parsed), int(time.time())),
        )
