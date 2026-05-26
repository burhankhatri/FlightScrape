"""Natural-language query → structured search params via Claude Haiku (tool_use).

Why tool_use instead of asking for JSON in the prompt: the Anthropic API
enforces the tool's input_schema, so the model literally cannot return
malformed JSON. No code fences, no prose, no missing fields, no surprises.

Output schema (validated by Anthropic):
    {
        "origin": "Karachi" | null,
        "destinations": ["Nepal", "Japan"],
        "depart_dates": ["2026-07-25"],            # 1+ ISO dates to try
        "return_dates": ["2026-08-25"] | null,     # parallel array OR null for one-way
        "pax": 1,
        "cabin": "economy",
        "trip_type": "round-trip"
    }

For flexible queries ("cheapest to Malaysia in July for 2 weeks"), the
parser is instructed to produce multiple candidate date pairs so the
search engine can pick the cheapest combination across all of them.
"""

from __future__ import annotations

import logging
import os
from datetime import date
from typing import Any

from anthropic import Anthropic

from . import cache

log = logging.getLogger(__name__)
MODEL = "claude-haiku-4-5"


TOOL_DEFINITION = {
    "name": "submit_flight_search",
    "description": (
        "Submit the parsed parameters of a flight search. Always call this tool "
        "to return your answer — do not write prose."
    ),
    "input_schema": {
        "type": "object",
        "properties": {
            "origin": {
                "type": ["string", "null"],
                "description": (
                    "The departure place name as the user stated it (country, city, "
                    "or IATA code). Null if the user did not specify."
                ),
            },
            "destinations": {
                "type": "array",
                "items": {"type": "string"},
                "minItems": 1,
                "description": (
                    "One or more destinations the user mentioned, each a country/"
                    "city/IATA. Preserve country names when the user said a country, "
                    "city names when they said a city."
                ),
            },
            "depart_dates": {
                "type": "array",
                "items": {"type": "string", "pattern": "^\\d{4}-\\d{2}-\\d{2}$"},
                "minItems": 1,
                "maxItems": 14,
                "description": (
                    "Departure dates to try, in YYYY-MM-DD. Goal: find the ACTUAL "
                    "cheapest, which often hides between coarse samples.\n"
                    "  • Specific date ('25th July') → 1 date\n"
                    "  • A specific month or named window ('in July', 'mid August')"
                    " → 14 dates, EVERY OTHER DAY across the window (e.g. for "
                    "July: Jul 1, 3, 5, 7, 9, 11, 13, 15, 17, 19, 21, 23, 25, 27). "
                    "Using stride 2 (not 3) matters — a Karachi→KL probe showed "
                    "stride 3 missed the 22%-cheaper deal sitting on Jul 23.\n"
                    "  • Multi-month or vague ('summer', 'next 3 months') → 12-14"
                    " dates spread roughly evenly\n"
                    "  • Half-month ('first two weeks of July') → ~8 dates every"
                    " day or every other day across that window\n"
                    "Use 14 samples whenever the user gives ANY flexibility. "
                    "Failed/timed-out queries are common, so dense sampling is "
                    "redundancy not waste."
                ),
            },
            "return_dates": {
                "type": ["array", "null"],
                "items": {"type": "string", "pattern": "^\\d{4}-\\d{2}-\\d{2}$"},
                "description": (
                    "Return dates parallel to depart_dates (same length).\n"
                    "  • '2 weeks' / 'for 14 days' (strict) → return = depart + 14\n"
                    "  • 'around 2 weeks' / 'roughly' / 'not strict' / 'minimum 2 "
                    "weeks' / 'about a fortnight' → vary the duration explicitly: "
                    "split the entries across +13, +14, and +15 days. For 14 "
                    "departs, do 5x+14, 5x+13, 4x+15 (or similar). NEVER return "
                    "all the same duration when the user signaled flexibility.\n"
                    "  • For 'minimum N days' bias toward N and N+1 (not N-1)\n"
                    "  • Specific return ('returning Aug 25') with one depart → "
                    "exactly that date\n"
                    "  • Specific return with multiple flex departs → repeat the "
                    "same return for every entry"
                ),
            },
            "pax": {
                "type": "integer",
                "minimum": 1,
                "maximum": 9,
                "description": "Number of adult passengers. Default 1.",
            },
            "cabin": {
                "type": "string",
                "enum": ["economy", "premium-economy", "business", "first"],
                "description": "Cabin class. Default 'economy'.",
            },
            "trip_type": {
                "type": "string",
                "enum": ["round-trip", "one-way"],
                "description": (
                    "round-trip if user mentioned returning, coming back, or gave "
                    "two dates / a duration. one-way otherwise."
                ),
            },
        },
        "required": [
            "origin",
            "destinations",
            "depart_dates",
            "return_dates",
            "pax",
            "cabin",
            "trip_type",
        ],
    },
}


SYSTEM_PROMPT = """You parse flight search queries.

Always respond by calling the submit_flight_search tool. Never write prose.

Be tolerant of typos: "philliiphense"→"Philippines", "thialand"→"Thailand", "kualal umpur"→"Kuala Lumpur".

Date handling:
- "25th July" with today's year — use this year if the date is still in the future, else next year.
- "next month" — pick mid-month of the next calendar month (e.g. 15th).
- "in July" / "during July" — produce 4 evenly-spaced depart dates across that month (1st, 8th, 15th, 22nd).
- "for 2 weeks" / "10-day trip" — return_dates = depart_dates + the duration.
- "returning Aug 25" with multiple depart options — set every return_date to Aug 25 (filter out impossible combos later if needed).
- If no return language and no duration is given, set trip_type="one-way" and return_dates=null.

Origin handling:
- If the user said "from X" or "leaving from X", set origin to X.
- Otherwise origin=null. The caller will fill in a default.

Destinations:
- Keep the granularity the user used. "Japan" stays "Japan" (country), "Tokyo" stays "Tokyo" (city).
- Always include every destination the user mentioned, in order."""


def _parse_with_claude(query: str) -> dict[str, Any]:
    client = Anthropic(api_key=os.environ.get("ANTHROPIC_API_KEY"))
    today = date.today().isoformat()
    user_msg = f"Today is {today}.\n\nQuery: {query}"
    resp = client.messages.create(
        model=MODEL,
        max_tokens=1024,
        system=SYSTEM_PROMPT,
        tools=[TOOL_DEFINITION],
        tool_choice={"type": "tool", "name": "submit_flight_search"},
        messages=[{"role": "user", "content": user_msg}],
    )
    for block in resp.content:
        if block.type == "tool_use" and block.name == "submit_flight_search":
            return dict(block.input)
    raise RuntimeError(f"Claude did not call the tool. Got: {resp.content!r}")


def parse_query(query: str, default_origin: str | None = None) -> dict[str, Any]:
    """Parse natural-language query into structured search params.

    Cached forever by raw query string. If the user did not specify an
    origin, we fill in `default_origin` (typically from the UI sidebar).
    """
    cached = cache.get_parse(query)
    if cached is None:
        parsed = _parse_with_claude(query)
        cache.set_parse(query, parsed)
    else:
        parsed = cached

    # Fill in default origin if the model returned null.
    if not parsed.get("origin") and default_origin:
        parsed = {**parsed, "origin": default_origin}

    # Validate parallel arrays — Claude is usually right but defend anyway.
    rdates = parsed.get("return_dates")
    if rdates and len(rdates) != len(parsed["depart_dates"]):
        log.warning(
            "Parallel array mismatch: %d depart vs %d return. Truncating.",
            len(parsed["depart_dates"]),
            len(rdates),
        )
        n = min(len(parsed["depart_dates"]), len(rdates))
        parsed = {**parsed, "depart_dates": parsed["depart_dates"][:n], "return_dates": rdates[:n]}

    return parsed
