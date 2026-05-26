# Flighthelper

A Google Flights-style multi-destination search built in plain Python. No paid flight APIs — uses [fast-flights](https://pypi.org/project/fast-flights/) (Google Flights via protobuf URL parameter) with Amadeus Self-Service free tier as fallback.

## Setup

```bash
cd /Users/burhankhatri/Documents/flighthelper

# Use Python 3.13 (3.14 may not have wheels for all deps yet).
python3.13 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt

cp .env.example .env
# Edit .env — at minimum, add ANTHROPIC_API_KEY.
# AMADEUS_* are optional but recommended (free 2000 calls/mo at https://developers.amadeus.com/).

# Install Playwright's Chromium — fast-flights uses it as a reliable fallback
# for routes where the direct HTTP fetch returns a blank Google page.
playwright install chromium
```

## Run

```bash
source .venv/bin/activate
streamlit run app.py
```

Opens at http://localhost:8501.

## How it works

1. **NL parsing** — Claude Haiku turns *"show me flights to nepal malaysia thailand philippines indonesia and japan going 25th july coming back 25th august"* into structured JSON.
2. **Destination resolution** — country names fan out across multiple airports (Japan → NRT/HND/KIX).
3. **Parallel search** — one `fast-flights` call per destination IATA, in a thread pool.
4. **Fallback chain** — fast-flights → Amadeus → stale cache → empty.
5. **Cards render with hero images** from Wikipedia. Clicking a card opens the search pre-filled on Google Flights for actual booking.

## Files

| Path | Purpose |
|---|---|
| `app.py` | Streamlit UI |
| `lib/parser.py` | NL → structured params (Claude) |
| `lib/destinations.py` | Country/city → IATA resolver |
| `lib/search.py` | fast-flights + Amadeus + cache pipeline |
| `lib/cache.py` | SQLite cache, 6hr TTL |
| `lib/images.py` | Wikipedia hero images |
| `lib/deeplink.py` | Google Flights booking URLs |
| `data/cache.db` | SQLite cache (gitignored) |

## Why this works without paid APIs

Google Flights accepts a base64-encoded protobuf in the URL that fully encodes a search. The response is server-rendered HTML — no Cloudflare challenge, no CAPTCHA, no JS execution required. `fast-flights` crafts that URL and parses the result. It still works in 2026.

## Maintenance

Expect ~2–3 days/year when Google changes the protobuf schema and `fast-flights` needs a fix. Amadeus + stale cache fallback keeps the app functional during those windows.

## If you ever go public

Swap `_fetch_fast_flights` for SerpAPI's Google Flights endpoint (~$25/mo for 1000 searches). Zero maintenance, same data quality.
