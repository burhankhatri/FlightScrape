"""Flight search engine.

Pipeline per (origin, dest_iata):
  1. Cache lookup (6hr TTL).
  2. fast-flights (primary).
  3. Amadeus Self-Service (fallback, if creds present).
  4. Stale cache (any age) with stale=True flag.
  5. Give up — surface the error to the caller.

Multi-destination is parallelized with a thread pool. Per-destination
fan-out across multiple airports (e.g. "Japan" → NRT/HND/KIX) keeps only
the cheapest result.
"""

from __future__ import annotations

import logging
import os
import re
from concurrent.futures import ThreadPoolExecutor
from dataclasses import asdict, dataclass, field
from typing import Any

from . import cache, destinations

log = logging.getLogger(__name__)


@dataclass
class Filters:
    """Post-fetch filters applied to results."""
    max_stops: int | None = None        # 0 = nonstop only, 1 = ≤1, None = any
    max_price: float | None = None      # in the result currency (no conversion)
    exclude_airlines: list[str] = field(default_factory=list)  # case-insensitive substring match
    max_duration_hours: float | None = None

    def passes(self, offer: "Offer") -> bool:
        if self.max_stops is not None and offer.stops > self.max_stops:
            return False
        if self.max_price is not None and offer.price > self.max_price:
            return False
        if self.exclude_airlines:
            airline_lc = offer.airline.lower()
            if any(x.lower() in airline_lc for x in self.exclude_airlines if x):
                return False
        if self.max_duration_hours is not None:
            hrs = _duration_to_hours(offer.duration)
            if hrs and hrs > self.max_duration_hours:
                return False
        return True


_DUR_RE = re.compile(r"(\d+)\s*hr(?:\s*(\d+)\s*min)?")


def _duration_to_hours(s: str) -> float | None:
    """'16 hr 45 min' → 16.75. Returns None if unparseable."""
    if not s:
        return None
    m = _DUR_RE.search(s)
    if not m:
        return None
    h = int(m.group(1))
    mi = int(m.group(2) or 0)
    return h + mi / 60


@dataclass
class Offer:
    """One bookable result for one (origin, dest_iata) pair."""
    origin: str
    dest_iata: str
    dest_city: str
    dest_country: str
    depart_date: str
    return_date: str | None
    price: float            # numeric, USD-ish (fast-flights returns whatever currency Google shows)
    price_display: str      # e.g. "$611"
    currency: str           # e.g. "USD"
    airline: str
    stops: int
    duration: str           # e.g. "16 hr 45 min"
    source: str             # "fast-flights" | "amadeus" | "cache" | "cache-stale"
    stale: bool = False


@dataclass
class Card:
    """One destination card in the results grid.

    For a country query like "Japan" we may have searched NRT, HND, KIX
    in parallel — the card collapses those down to the cheapest, but
    `alternates` keeps the others so the UI can show "also: HND $812".
    """
    dest_label: str         # "Bangkok, Thailand"
    dest_country: str
    wiki_title: str         # for image lookup
    best: Offer
    alternates: list[Offer]
    combos_tried: int = 0       # total (depart,return,airport) combos searched
    combos_succeeded: int = 0   # how many returned a price
    price_min: float = 0        # numeric min price found
    price_max: float = 0        # numeric max price found
    currency: str = ""          # currency of the prices


@dataclass
class SearchStats:
    """End-to-end stats so the UI can show 'we checked N, range X-Y'."""
    total_attempts: int = 0
    total_succeeded: int = 0
    duration_sec: float = 0.0
    date_combos: int = 0    # distinct (depart, return) pairs tried per airport


# ---------- price parsing -----------------------------------------------

# Matches either a currency symbol or a 3-letter ISO code, then a number.
# Examples: "$1,234.56", "PKR 257507", "€450", "1234 USD"
_PRICE_RE = re.compile(
    r"(?:([\$£€₹¥])|\b([A-Z]{3})\b)?\s*([\d,]+(?:\.\d+)?)(?:\s+([A-Z]{3}))?"
)
_SYMBOL_TO_ISO = {"$": "USD", "£": "GBP", "€": "EUR", "₹": "INR", "¥": "JPY"}


def _parse_price(s: str) -> tuple[float, str]:
    """Parse a price string → (value, ISO currency). Returns (inf, '') on failure.

    >>> _parse_price("$1,234.56")
    (1234.56, 'USD')
    >>> _parse_price("PKR 257507")
    (257507.0, 'PKR')
    >>> _parse_price("€450")
    (450.0, 'EUR')
    """
    if not s:
        return float("inf"), ""
    m = _PRICE_RE.search(s)
    if not m:
        return float("inf"), ""
    symbol, iso_prefix, num, iso_suffix = m.groups()
    try:
        value = float(num.replace(",", ""))
    except ValueError:
        return float("inf"), ""
    currency = (
        _SYMBOL_TO_ISO.get(symbol) if symbol
        else (iso_prefix or iso_suffix or "USD")
    )
    return value, currency


# ---------- providers ---------------------------------------------------

def _build_offer_from_result(
    result, origin: str, dest: str, depart: str, ret: str | None, source: str
) -> Offer | None:
    """Pick the best Flight from a fast-flights Result and wrap it as an Offer."""
    flights = getattr(result, "flights", None) or []
    if not flights:
        return None

    # Prefer flights tagged is_best by Google. Among those (or all if none),
    # take the cheapest. This matches what Google highlights as "best deal".
    candidates = [f for f in flights if getattr(f, "is_best", False)] or flights
    priced = []
    for f in candidates:
        price, currency = _parse_price(getattr(f, "price", "") or "")
        priced.append((price, currency, f))
    priced.sort(key=lambda t: t[0])
    price, currency, best = priced[0]
    if price == float("inf"):
        return None

    airport_info = destinations.airport(dest)
    return Offer(
        origin=origin,
        dest_iata=dest,
        dest_city=airport_info.city if airport_info else dest,
        dest_country=airport_info.country if airport_info else "",
        depart_date=depart,
        return_date=ret,
        price=price,
        price_display=getattr(best, "price", "") or f"{currency} {price:.0f}",
        currency=currency,
        airline=getattr(best, "name", "") or "",
        stops=int(getattr(best, "stops", 0) or 0),
        duration=getattr(best, "duration", "") or "",
        source=source,
    )


def _fetch_fast_flights(
    origin: str, dest: str, depart: str, ret: str | None, cabin: str, pax: int
) -> Offer | None:
    """Try fast-flights with a cascade of fetch modes, always requesting USD.

    Order:
      1. `common` — direct HTTP fetch via primp. Fastest, works for most routes
         but Google sometimes returns blank pages with no flight selectors.
      2. `local` — headless Chromium via Playwright. Slower but more reliable.
      3. `local` retry — KUL and a few other routes are flaky on the first try.

    The remote-Playwright `fallback` mode is intentionally NOT tried — it now
    requires a paid token (as of late 2025) and returns 401 without one.

    We call get_flights_from_filter directly (not the top-level get_flights)
    so we can pass currency='USD'. Without this, Google returns prices in the
    currency it geo-detects for the caller IP, e.g. PKR from Pakistan.
    """
    try:
        from fast_flights import FlightData, Passengers
        from fast_flights.core import get_flights_from_filter
        from fast_flights.filter import TFSData
    except ImportError:
        log.warning("fast-flights not installed")
        return None

    flight_data = [FlightData(date=depart, from_airport=origin, to_airport=dest)]
    trip = "one-way"
    if ret:
        flight_data.append(FlightData(date=ret, from_airport=dest, to_airport=origin))
        trip = "round-trip"

    passengers = Passengers(adults=pax, children=0, infants_in_seat=0, infants_on_lap=0)
    tfs = TFSData.from_interface(
        flight_data=flight_data,
        trip=trip,
        passengers=passengers,
        seat=cabin,
        max_stops=None,
    )

    import time

    def try_mode(mode: str) -> Offer | None:
        try:
            result = get_flights_from_filter(tfs, currency="USD", mode=mode)
        except Exception as e:
            log.debug("fast-flights %s mode failed for %s→%s: %s", mode, origin, dest, str(e)[:100])
            return None
        return _build_offer_from_result(result, origin, dest, depart, ret, "fast-flights")

    # 1. Common (fastest direct HTTP).
    offer = try_mode("common")
    if offer:
        return offer

    # 2-4. Local Playwright with 2 retries. Probing showed ~47% first-try
    # failure for some routes (KUL, PEN, MNL), mostly due to Google occasionally
    # serving an empty layout where the expected CSS selector never appears.
    # A short wait between attempts almost always resolves it.
    for attempt in range(3):
        if attempt > 0:
            time.sleep(2 + attempt)  # 3s, then 5s
        offer = try_mode("local")
        if offer:
            return offer

    log.warning("fast-flights exhausted all modes for %s→%s on %s", origin, dest, depart)
    return None


def _fetch_amadeus(
    origin: str, dest: str, depart: str, ret: str | None, cabin: str, pax: int
) -> Offer | None:
    client_id = os.environ.get("AMADEUS_CLIENT_ID")
    client_secret = os.environ.get("AMADEUS_CLIENT_SECRET")
    if not (client_id and client_secret):
        return None
    try:
        from amadeus import Client, ResponseError
    except ImportError:
        log.warning("amadeus SDK not installed")
        return None

    am = Client(client_id=client_id, client_secret=client_secret)
    params: dict[str, Any] = {
        "originLocationCode": origin,
        "destinationLocationCode": dest,
        "departureDate": depart,
        "adults": pax,
        "max": 5,
        "currencyCode": "USD",
        "travelClass": {
            "economy": "ECONOMY",
            "premium-economy": "PREMIUM_ECONOMY",
            "business": "BUSINESS",
            "first": "FIRST",
        }.get(cabin, "ECONOMY"),
    }
    if ret:
        params["returnDate"] = ret

    try:
        resp = am.shopping.flight_offers_search.get(**params)
    except ResponseError as e:
        log.warning("amadeus failed for %s→%s: %s", origin, dest, e)
        return None
    except Exception as e:
        log.warning("amadeus error for %s→%s: %s", origin, dest, e)
        return None

    offers = resp.data or []
    if not offers:
        return None

    offers.sort(key=lambda o: float(o["price"]["total"]))
    best = offers[0]
    price = float(best["price"]["total"])
    currency = best["price"].get("currency", "USD")
    itin = best["itineraries"][0]
    duration_iso = itin.get("duration", "")  # e.g. "PT16H45M"
    duration = duration_iso.replace("PT", "").replace("H", " hr ").replace("M", " min").strip()
    segments = itin.get("segments", [])
    airline = segments[0]["carrierCode"] if segments else ""
    stops = max(0, len(segments) - 1)

    airport_info = destinations.airport(dest)
    return Offer(
        origin=origin,
        dest_iata=dest,
        dest_city=airport_info.city if airport_info else dest,
        dest_country=airport_info.country if airport_info else "",
        depart_date=depart,
        return_date=ret,
        price=price,
        price_display=f"${price:.0f}",
        currency=currency,
        airline=airline,
        stops=stops,
        duration=duration,
        source="amadeus",
    )


# ---------- single pair lookup with fallback chain -----------------------

def _lookup_pair(
    origin: str, dest: str, depart: str, ret: str | None, cabin: str, pax: int
) -> Offer | None:
    # 1. Fresh cache.
    cached = cache.get_search(origin, dest, depart, ret, cabin, pax)
    if cached and "offer" in cached:
        offer = Offer(**cached["offer"])
        offer.source = "cache"
        return offer

    # 2. fast-flights.
    offer = _fetch_fast_flights(origin, dest, depart, ret, cabin, pax)
    if offer:
        cache.set_search(origin, dest, depart, ret, cabin, pax, {"offer": asdict(offer)}, "fast-flights")
        return offer

    # 3. Amadeus.
    offer = _fetch_amadeus(origin, dest, depart, ret, cabin, pax)
    if offer:
        cache.set_search(origin, dest, depart, ret, cabin, pax, {"offer": asdict(offer)}, "amadeus")
        return offer

    # 4. Stale cache as last resort.
    cached = cache.get_search(origin, dest, depart, ret, cabin, pax, allow_stale=True)
    if cached and "offer" in cached:
        offer = Offer(**cached["offer"])
        offer.source = "cache-stale"
        offer.stale = True
        return offer

    return None


# ---------- top-level search --------------------------------------------

def search(
    origin_iata: str,
    destination_names: list[str],
    depart_dates: list[str],
    return_dates: list[str] | None,
    cabin: str = "economy",
    pax: int = 1,
    filters: Filters | None = None,
    max_workers: int = 6,  # capped because each task may spawn a Playwright Chromium
) -> tuple[list[Card], SearchStats]:
    """Search across multiple destinations × multiple date pairs in parallel.

    `depart_dates` and `return_dates` are parallel arrays:
        depart_dates = ["2026-07-01", "2026-07-08", "2026-07-15"]
        return_dates = ["2026-07-15", "2026-07-22", "2026-07-29"]
    means "try three different date pairs for each destination, keep cheapest".

    For one-way searches pass return_dates=None.

    Within a destination group (e.g. Japan = NRT/HND/KIX) we keep the
    cheapest offer across all airports AND all date pairs. The runner-up
    offers go into card.alternates so the UI can show "also: HND on 8th
    for $812".
    """
    import time as _t

    filters = filters or Filters()

    # Build the work list: destination_name → list of IATAs.
    # Then dedupe: if two destination names resolve to overlapping airport sets
    # (e.g. user said both "Malaysia" and "KL"), keep only the broader group.
    # This prevents duplicate cards and saves redundant API calls.
    raw_groups: list[tuple[str, set[str]]] = []
    for name in destination_names:
        iatas = destinations.resolve(name)
        if iatas:
            raw_groups.append((name, set(iatas)))

    # Sort by IATA-set size descending; drop any group fully covered by an earlier one.
    raw_groups.sort(key=lambda g: -len(g[1]))
    kept: list[tuple[str, list[str]]] = []
    covered: set[str] = set()
    for name, iata_set in raw_groups:
        if iata_set.issubset(covered):
            log.info("Skipping duplicate destination '%s' (covered by earlier group)", name)
            continue
        kept.append((name, sorted(iata_set)))
        covered |= iata_set
    groups = kept

    if not groups:
        return [], SearchStats()

    # Build the parallel arrays of (depart, return) pairs.
    if return_dates is None:
        date_pairs: list[tuple[str, str | None]] = [(d, None) for d in depart_dates]
    else:
        date_pairs = list(zip(depart_dates, return_dates))

    # Build the full combo list once so we can do retry passes.
    all_combos: list[tuple[str, str, str, str | None]] = []
    for group_name, iatas in groups:
        for iata in iatas:
            for depart, ret in date_pairs:
                all_combos.append((group_name, iata, depart, ret))

    group_attempts: dict[str, int] = {g: 0 for g, _ in groups}
    group_results: dict[str, list[Offer]] = {}
    successful: set[tuple[str, str, str, str | None]] = set()
    t_start = _t.time()

    # Pass 1: try every combo once.
    # Pass 2: retry only the ones that failed. Probing showed ~50% transient
    # failure rate; a second pass typically recovers another 60-70% of those.
    # Two passes lifts effective success rate from ~50% to ~85%.
    NUM_PASSES = 2
    for pass_idx in range(NUM_PASSES):
        if pass_idx == 0:
            todo = list(all_combos)
        else:
            todo = [c for c in all_combos if c not in successful]
            if not todo:
                break
            log.info("pass %d: retrying %d failed combos", pass_idx + 1, len(todo))

        with ThreadPoolExecutor(max_workers=max_workers) as ex:
            futs = {
                ex.submit(_lookup_pair, origin_iata, c[1], c[2], c[3], cabin, pax): c
                for c in todo
            }
            for fut in futs:
                combo = futs[fut]
                group_name = combo[0]
                if pass_idx == 0:
                    group_attempts[group_name] = group_attempts.get(group_name, 0) + 1
                try:
                    offer = fut.result()
                except Exception as e:
                    log.warning("lookup failed for %s→%s: %s", origin_iata, combo[1], e)
                    offer = None
                if offer:
                    successful.add(combo)
                    if filters.passes(offer):
                        # Keep cheapest if we already have a result for this combo
                        # (a previous pass may have returned a different price).
                        existing = group_results.get(group_name, [])
                        # Replace any existing offer for the same exact combo
                        existing = [
                            o for o in existing
                            if not (o.dest_iata == combo[1]
                                    and o.depart_date == combo[2]
                                    and (o.return_date or "") == (combo[3] or ""))
                        ]
                        existing.append(offer)
                        group_results[group_name] = existing

    total_attempts = sum(group_attempts.values())
    total_succeeded = len(successful)
    elapsed = _t.time() - t_start

    # Build cards — cheapest offer per destination group, with stats.
    cards: list[Card] = []
    for group_name, offers in group_results.items():
        offers.sort(key=lambda o: o.price)
        best = offers[0]
        airport_info = destinations.airport(best.dest_iata)
        wiki = airport_info.wiki_city if airport_info else best.dest_city
        country = best.dest_country or group_name
        label = best.dest_city or group_name
        if country and country.lower() != best.dest_city.lower():
            label = f"{best.dest_city}, {country}"
        cards.append(
            Card(
                dest_label=label,
                dest_country=country,
                wiki_title=wiki,
                best=best,
                alternates=offers[1:8],  # cap to keep UI tidy
                combos_tried=group_attempts.get(group_name, len(offers)),
                combos_succeeded=len(offers),
                price_min=offers[0].price,
                price_max=offers[-1].price,
                currency=best.currency,
            )
        )

    cards.sort(key=lambda c: c.best.price)
    stats = SearchStats(
        total_attempts=total_attempts,
        total_succeeded=total_succeeded,
        duration_sec=elapsed,
        date_combos=len(date_pairs),
    )
    return cards, stats


def resolve_origin(name: str | None) -> str | None:
    """Resolve an origin name to a single IATA (first match). None passes through."""
    if not name:
        return None
    iatas = destinations.resolve(name)
    return iatas[0] if iatas else None
