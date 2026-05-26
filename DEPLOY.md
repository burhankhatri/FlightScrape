# Deploying Flighthelper v2 to Vercel

## Pre-deploy checklist

### 1. Required environment variables

In Vercel → Project → Settings → Environment Variables:

| Variable | Required | Purpose | Where to get |
|---|---|---|---|
| `ANTHROPIC_API_KEY` | **Yes** | Natural-language parser | https://console.anthropic.com/settings/keys |
| `AMADEUS_CLIENT_ID` | Strongly recommended | Fallback flight provider | https://developers.amadeus.com/ (free 2000/mo) |
| `AMADEUS_CLIENT_SECRET` | Strongly recommended | Same as above | Same |
| `UPSTASH_REDIS_REST_URL` | Recommended | Cross-invocation cache | https://upstash.com/ (free 10k/day) |
| `UPSTASH_REDIS_REST_TOKEN` | Recommended | Same as above | Same |

**Why Amadeus matters:** Google Flights' direct-fetch path returns empty HTML
for some routes from Vercel's egress IPs (notably KUL, occasionally PEN, MNL,
DPS — the cheaper SE Asian leisure routes). Amadeus has lower coverage of
LCCs (no AirAsia, Cebu Pacific) but handles the major carriers reliably and
fills these gaps. Without Amadeus, ~30% of routes will return 0 results.

**Why Upstash matters:** Vercel serverless instances are ephemeral — each
invocation starts cold. Without Redis, every search re-fetches every route
from scratch. With Redis, repeat searches hit cache instantly (6h TTL).

### 2. Verify locally

```bash
npm install
cp .env.example .env.local
# fill in the keys above
npm run typecheck       # should pass with zero errors
npm run dev             # boot at http://localhost:3000
```

Test queries that should work:
- `flights to nepal from karachi 25 july to 8 august` — direct Google fetch works
- `flights to japan from karachi 25 july to 8 august` — direct Google fetch works
- `cheapest to KL from karachi in july for 2 weeks` — needs Amadeus (10-14 dates, KUL flaky)

### 3. Build check

```bash
npm run build
```

Should complete in ~30-60s with zero errors. Output goes to `.next/`.

## Deploy

### One-click via Vercel CLI

```bash
npm i -g vercel
vercel login
vercel link   # accept defaults
vercel --prod
```

Vercel auto-detects Next.js 15, picks Node 20 runtime, uses the `vercel.json`
in this repo (which extends `/api/search` to a 5-min max duration — the
default 10s isn't enough for flex searches).

### Or via GitHub

1. Push this repo to GitHub
2. `vercel.com → New Project → Import` your repo
3. Add env vars in the Vercel UI before clicking Deploy

## Post-deploy verification

After the URL is live (e.g. `flighthelper-yourname.vercel.app`):

1. Page loads with glass UI + liquid metal button
2. Search bar accepts queries; entrance animation runs
3. Try `flights to japan from karachi 25 july to 8 august` — should return
   Tokyo/Osaka cards within ~10-20s
4. Click a card → opens Google Flights with the same search filled in
5. Try a flex query (`in july for 2 weeks`) — takes 60-90s, returns 5-10 date
   options per destination, picks the cheapest

If you see "No flight data came back" — Amadeus probably isn't set up. Follow
the prompt in the error message.

## Architecture diagram

```
Browser ──HTTPS──> Vercel Edge
                   │
                   ▼
              app/api/search/route.ts
                   │
       ┌───────────┼─────────────┬──────────────┐
       ▼           ▼             ▼              ▼
   Anthropic   Google Flights  Amadeus     Upstash
   (parser)    (HTTP fetch +   (REST       (Redis
               cheerio parse)  fallback)   cache)
```

## Costs at typical usage

- Anthropic Haiku 4.5: ~$0.001 per query (parsing cached forever)
- Amadeus: free up to 2000 searches/month
- Upstash: free up to 10k Redis requests/day
- Vercel: free for personal hobby projects
- Wikipedia images: free
- Google Flights HTTP fetch: free (just be polite — the cache prevents abuse)

Total: **$0/month** for personal use under ~100 queries/day.

## What if Google's HTTP path stops working entirely?

It's flaky now; it could get worse. Two upgrade paths:

1. **Add SerpAPI** (~$25/mo for 1000 searches) — drop-in replacement for the
   Google Flights call. Add a `lib/serpapi.ts` provider that calls
   `serpapi.com/search?engine=google_flights`. Slot it into the fallback
   chain in `lib/search.ts` before Amadeus.

2. **Move the Google fetch back to Python sidecar** — keep all the Python code
   in `python-archive/` and host it on Railway/Fly.io. Modify
   `lib/google-flights.ts` to call your sidecar URL instead of Google directly.
   This gets the Playwright fallback back, restoring KUL coverage.

## What's in `python-archive/`

The original Streamlit version — Python implementation of all the same logic
that powers v2. Kept for:
- Reference (e.g. the parser prompt, the destinations table)
- Fallback if the TS version has issues
- Future Railway sidecar if Google's HTTP path dies
