"""Country/city → IATA code resolver.

Hand-curated focus on routes a Karachi-based traveler is likely to search.
For country queries we return multiple major airports so the search fans
out (e.g. Japan → NRT, HND, KIX). For city queries we return a single
primary airport plus alternates where they materially change pricing
(Bangkok BKK + DMK, Tokyo NRT + HND, Jakarta CGK).
"""

from __future__ import annotations

from dataclasses import dataclass


@dataclass(frozen=True)
class Airport:
    iata: str
    city: str        # display name, e.g. "Bangkok"
    country: str     # display name, e.g. "Thailand"
    wiki_city: str   # disambiguated name for Wikipedia lookups, e.g. "Bangkok"


# Primary airport per city, including LCC alternates where relevant.
AIRPORTS: dict[str, Airport] = {
    # Pakistan (origins)
    "KHI": Airport("KHI", "Karachi", "Pakistan", "Karachi"),
    "LHE": Airport("LHE", "Lahore", "Pakistan", "Lahore"),
    "ISB": Airport("ISB", "Islamabad", "Pakistan", "Islamabad"),
    # Nepal
    "KTM": Airport("KTM", "Kathmandu", "Nepal", "Kathmandu"),
    # Malaysia
    "KUL": Airport("KUL", "Kuala Lumpur", "Malaysia", "Kuala Lumpur"),
    "PEN": Airport("PEN", "Penang", "Malaysia", "George Town, Penang"),
    # Thailand
    "BKK": Airport("BKK", "Bangkok", "Thailand", "Bangkok"),
    "DMK": Airport("DMK", "Bangkok", "Thailand", "Bangkok"),
    "HKT": Airport("HKT", "Phuket", "Thailand", "Phuket"),
    "CNX": Airport("CNX", "Chiang Mai", "Thailand", "Chiang Mai"),
    # Philippines
    "MNL": Airport("MNL", "Manila", "Philippines", "Manila"),
    "CEB": Airport("CEB", "Cebu", "Philippines", "Cebu City"),
    # Indonesia
    "CGK": Airport("CGK", "Jakarta", "Indonesia", "Jakarta"),
    "DPS": Airport("DPS", "Bali (Denpasar)", "Indonesia", "Denpasar"),
    # Japan
    "NRT": Airport("NRT", "Tokyo", "Japan", "Tokyo"),
    "HND": Airport("HND", "Tokyo", "Japan", "Tokyo"),
    "KIX": Airport("KIX", "Osaka", "Japan", "Osaka"),
    # Singapore
    "SIN": Airport("SIN", "Singapore", "Singapore", "Singapore"),
    # India
    "DEL": Airport("DEL", "Delhi", "India", "Delhi"),
    "BOM": Airport("BOM", "Mumbai", "India", "Mumbai"),
    "BLR": Airport("BLR", "Bangalore", "India", "Bangalore"),
    # UAE
    "DXB": Airport("DXB", "Dubai", "UAE", "Dubai"),
    "AUH": Airport("AUH", "Abu Dhabi", "UAE", "Abu Dhabi"),
    # Turkey
    "IST": Airport("IST", "Istanbul", "Turkey", "Istanbul"),
    # UK
    "LHR": Airport("LHR", "London", "United Kingdom", "London"),
    "LGW": Airport("LGW", "London", "United Kingdom", "London"),
    # US
    "JFK": Airport("JFK", "New York", "USA", "New York City"),
    "LAX": Airport("LAX", "Los Angeles", "USA", "Los Angeles"),
    # Saudi Arabia
    "JED": Airport("JED", "Jeddah", "Saudi Arabia", "Jeddah"),
    "RUH": Airport("RUH", "Riyadh", "Saudi Arabia", "Riyadh"),
    # Qatar
    "DOH": Airport("DOH", "Doha", "Qatar", "Doha"),
}


# Country/region → list of airport IATAs to fan out across.
# Order matters: we'll keep the cheapest result, so listing the most
# common/cheapest airport first is just a slight bias.
COUNTRIES: dict[str, list[str]] = {
    "nepal": ["KTM"],
    "malaysia": ["KUL", "PEN"],
    "thailand": ["BKK", "DMK", "HKT", "CNX"],
    "philippines": ["MNL", "CEB"],
    "indonesia": ["CGK", "DPS"],
    "japan": ["NRT", "HND", "KIX"],
    "singapore": ["SIN"],
    "india": ["DEL", "BOM", "BLR"],
    "uae": ["DXB", "AUH"],
    "united arab emirates": ["DXB", "AUH"],
    "turkey": ["IST"],
    "uk": ["LHR", "LGW"],
    "united kingdom": ["LHR", "LGW"],
    "usa": ["JFK", "LAX"],
    "united states": ["JFK", "LAX"],
    "saudi arabia": ["JED", "RUH"],
    "qatar": ["DOH"],
    "pakistan": ["KHI", "LHE", "ISB"],
}


# City aliases → primary IATA. Multi-airport cities are handled via the
# COUNTRIES list when the user specifies a country; if they ask for a
# specific city we just return its main airport.
CITIES: dict[str, str] = {
    "karachi": "KHI",
    "lahore": "LHE",
    "islamabad": "ISB",
    "kathmandu": "KTM",
    "kuala lumpur": "KUL",
    "kl": "KUL",
    "k.l.": "KUL",
    "penang": "PEN",
    "bangkok": "BKK",
    "phuket": "HKT",
    "chiang mai": "CNX",
    "manila": "MNL",
    "cebu": "CEB",
    "jakarta": "CGK",
    "bali": "DPS",
    "denpasar": "DPS",
    "tokyo": "HND",
    "osaka": "KIX",
    "singapore": "SIN",
    "delhi": "DEL",
    "new delhi": "DEL",
    "mumbai": "BOM",
    "bangalore": "BLR",
    "bengaluru": "BLR",
    "dubai": "DXB",
    "abu dhabi": "AUH",
    "istanbul": "IST",
    "london": "LHR",
    "new york": "JFK",
    "new york city": "JFK",
    "nyc": "JFK",
    "los angeles": "LAX",
    "jeddah": "JED",
    "riyadh": "RUH",
    "doha": "DOH",
}


def resolve(name: str) -> list[str]:
    """Resolve a country, city, or IATA code to a list of airport IATAs.

    >>> resolve("Japan")
    ['NRT', 'HND', 'KIX']
    >>> resolve("KHI")
    ['KHI']
    >>> resolve("bangkok")
    ['BKK']
    """
    s = name.strip().lower()
    # Direct IATA?
    if len(s) == 3 and s.upper() in AIRPORTS:
        return [s.upper()]
    if s in COUNTRIES:
        return list(COUNTRIES[s])
    if s in CITIES:
        return [CITIES[s]]
    return []


def airport(iata: str) -> Airport | None:
    """Look up an Airport by IATA code."""
    return AIRPORTS.get(iata.upper())
