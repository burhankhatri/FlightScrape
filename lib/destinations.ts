/**
 * Country/city → IATA code resolver — direct port of python-archive/lib/destinations.py.
 *
 * Country queries return multiple airports for parallel fan-out
 * (Japan → NRT, HND, KIX). City queries return one primary airport
 * plus LCC alternates where they materially change pricing.
 */

export interface Airport {
  iata: string;
  city: string;        // "Bangkok"
  country: string;     // "Thailand"
  wikiCity: string;    // for Wikipedia lookups
}

export const AIRPORTS: Record<string, Airport> = {
  // Pakistan (origins)
  KHI: { iata: "KHI", city: "Karachi", country: "Pakistan", wikiCity: "Karachi" },
  LHE: { iata: "LHE", city: "Lahore", country: "Pakistan", wikiCity: "Lahore" },
  ISB: { iata: "ISB", city: "Islamabad", country: "Pakistan", wikiCity: "Islamabad" },
  // Nepal
  KTM: { iata: "KTM", city: "Kathmandu", country: "Nepal", wikiCity: "Kathmandu" },
  // Malaysia
  KUL: { iata: "KUL", city: "Kuala Lumpur", country: "Malaysia", wikiCity: "Kuala Lumpur" },
  PEN: { iata: "PEN", city: "Penang", country: "Malaysia", wikiCity: "George Town, Penang" },
  // Thailand
  BKK: { iata: "BKK", city: "Bangkok", country: "Thailand", wikiCity: "Bangkok" },
  DMK: { iata: "DMK", city: "Bangkok", country: "Thailand", wikiCity: "Bangkok" },
  HKT: { iata: "HKT", city: "Phuket", country: "Thailand", wikiCity: "Phuket" },
  CNX: { iata: "CNX", city: "Chiang Mai", country: "Thailand", wikiCity: "Chiang Mai" },
  // Philippines
  MNL: { iata: "MNL", city: "Manila", country: "Philippines", wikiCity: "Manila" },
  CEB: { iata: "CEB", city: "Cebu", country: "Philippines", wikiCity: "Cebu City" },
  // Indonesia
  CGK: { iata: "CGK", city: "Jakarta", country: "Indonesia", wikiCity: "Jakarta" },
  DPS: { iata: "DPS", city: "Bali (Denpasar)", country: "Indonesia", wikiCity: "Denpasar" },
  // Japan
  NRT: { iata: "NRT", city: "Tokyo", country: "Japan", wikiCity: "Tokyo" },
  HND: { iata: "HND", city: "Tokyo", country: "Japan", wikiCity: "Tokyo" },
  KIX: { iata: "KIX", city: "Osaka", country: "Japan", wikiCity: "Osaka" },
  // Singapore
  SIN: { iata: "SIN", city: "Singapore", country: "Singapore", wikiCity: "Singapore" },
  // India
  DEL: { iata: "DEL", city: "Delhi", country: "India", wikiCity: "Delhi" },
  BOM: { iata: "BOM", city: "Mumbai", country: "India", wikiCity: "Mumbai" },
  BLR: { iata: "BLR", city: "Bangalore", country: "India", wikiCity: "Bangalore" },
  // UAE
  DXB: { iata: "DXB", city: "Dubai", country: "UAE", wikiCity: "Dubai" },
  AUH: { iata: "AUH", city: "Abu Dhabi", country: "UAE", wikiCity: "Abu Dhabi" },
  // Turkey
  IST: { iata: "IST", city: "Istanbul", country: "Turkey", wikiCity: "Istanbul" },
  // UK
  LHR: { iata: "LHR", city: "London", country: "United Kingdom", wikiCity: "London" },
  LGW: { iata: "LGW", city: "London", country: "United Kingdom", wikiCity: "London" },
  // US
  JFK: { iata: "JFK", city: "New York", country: "USA", wikiCity: "New York City" },
  LAX: { iata: "LAX", city: "Los Angeles", country: "USA", wikiCity: "Los Angeles" },
  // Saudi Arabia
  JED: { iata: "JED", city: "Jeddah", country: "Saudi Arabia", wikiCity: "Jeddah" },
  RUH: { iata: "RUH", city: "Riyadh", country: "Saudi Arabia", wikiCity: "Riyadh" },
  // Qatar
  DOH: { iata: "DOH", city: "Doha", country: "Qatar", wikiCity: "Doha" },
};

export const COUNTRIES: Record<string, string[]> = {
  nepal: ["KTM"],
  malaysia: ["KUL", "PEN"],
  thailand: ["BKK", "DMK", "HKT", "CNX"],
  philippines: ["MNL", "CEB"],
  indonesia: ["CGK", "DPS"],
  japan: ["NRT", "HND", "KIX"],
  singapore: ["SIN"],
  india: ["DEL", "BOM", "BLR"],
  uae: ["DXB", "AUH"],
  "united arab emirates": ["DXB", "AUH"],
  turkey: ["IST"],
  uk: ["LHR", "LGW"],
  "united kingdom": ["LHR", "LGW"],
  usa: ["JFK", "LAX"],
  "united states": ["JFK", "LAX"],
  "saudi arabia": ["JED", "RUH"],
  qatar: ["DOH"],
  pakistan: ["KHI", "LHE", "ISB"],
};

export const CITIES: Record<string, string> = {
  karachi: "KHI",
  lahore: "LHE",
  islamabad: "ISB",
  kathmandu: "KTM",
  "kuala lumpur": "KUL",
  kl: "KUL",
  "k.l.": "KUL",
  penang: "PEN",
  bangkok: "BKK",
  phuket: "HKT",
  "chiang mai": "CNX",
  manila: "MNL",
  cebu: "CEB",
  jakarta: "CGK",
  bali: "DPS",
  denpasar: "DPS",
  tokyo: "HND",
  osaka: "KIX",
  singapore: "SIN",
  delhi: "DEL",
  "new delhi": "DEL",
  mumbai: "BOM",
  bangalore: "BLR",
  bengaluru: "BLR",
  dubai: "DXB",
  "abu dhabi": "AUH",
  istanbul: "IST",
  london: "LHR",
  "new york": "JFK",
  "new york city": "JFK",
  nyc: "JFK",
  "los angeles": "LAX",
  jeddah: "JED",
  riyadh: "RUH",
  doha: "DOH",
};

/** Resolve a country/city/IATA → list of airport IATAs. */
export function resolve(name: string): string[] {
  const s = name.trim().toLowerCase();
  if (s.length === 3 && AIRPORTS[s.toUpperCase()]) return [s.toUpperCase()];
  if (COUNTRIES[s]) return [...COUNTRIES[s]];
  if (CITIES[s]) return [CITIES[s]];
  return [];
}

export function getAirport(iata: string): Airport | null {
  return AIRPORTS[iata.toUpperCase()] ?? null;
}

/** Resolve an origin name to a single IATA (first match). */
export function resolveOrigin(name: string | null | undefined): string | null {
  if (!name) return null;
  const iatas = resolve(name);
  return iatas[0] ?? null;
}
