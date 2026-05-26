"""Build Google Flights URLs pre-filled with the user's search.

The ONLY URL format that reliably opens straight to results is the
`?tfs=<base64-protobuf>` format — the same one fast-flights uses to fetch
data. Google's `?q=<natural language>` URLs land on the homepage instead
of the search results. So we build the tfs blob ourselves via
`fast_flights.filter.create_filter`.
"""

from __future__ import annotations

import logging

log = logging.getLogger(__name__)


def booking_url(
    origin: str,
    dest: str,
    depart: str,
    ret: str | None = None,
    pax: int = 1,
    cabin: str = "economy",
) -> str:
    """Return a Google Flights URL that opens directly to search results."""
    try:
        from fast_flights import FlightData, Passengers
        from fast_flights.filter import create_filter
    except ImportError:
        log.warning("fast-flights not installed; falling back to homepage URL")
        return "https://www.google.com/travel/flights"

    flight_data = [FlightData(date=depart, from_airport=origin, to_airport=dest)]
    trip = "one-way"
    if ret:
        flight_data.append(FlightData(date=ret, from_airport=dest, to_airport=origin))
        trip = "round-trip"

    try:
        f = create_filter(
            flight_data=flight_data,
            trip=trip,
            seat=cabin,
            passengers=Passengers(
                adults=pax, children=0, infants_in_seat=0, infants_on_lap=0
            ),
        )
        tfs = f.as_b64().decode()
    except Exception as e:
        log.warning("Failed to build tfs URL: %s — falling back to homepage", e)
        return "https://www.google.com/travel/flights"

    return f"https://www.google.com/travel/flights?tfs={tfs}&hl=en&curr=USD"
