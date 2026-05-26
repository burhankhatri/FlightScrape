/**
 * Airports & resolver — backed by OpenFlights' ~6,000-airport dataset
 * (lib/airports.json), with curated overrides for natural-language aliases
 * (e.g. "kl" → KUL, "nyc" → JFK) and multi-airport fan-out per country.
 */

import airportsJson from "./airports.json";

export interface Airport {
  iata: string;
  city: string;
  country: string;
  /** Full airport name from OpenFlights (e.g., "John F Kennedy Intl"). */
  name: string;
  /** Wikipedia page title override (used for hero image lookups). */
  wikiCity?: string;
}

type RawAirport = {
  iata: string;
  city: string;
  country: string;
  name: string;
};

/**
 * Manual Wikipedia page-title overrides — only set where the airport's `city`
 * field doesn't match the actual Wikipedia article title.
 */
const WIKI_CITY_OVERRIDES: Record<string, string> = {
  LGK: "Langkawi",
  PEN: "George Town, Penang",
  CEB: "Cebu City",
  DPS: "Denpasar",
  JFK: "New York City",
  LGA: "New York City",
  EWR: "Newark, New Jersey",
};

/**
 * Natural-language aliases — common shortcuts or alternate spellings the
 * parser may emit. Lowercased on insert; resolved as a city → IATA.
 */
const CITY_ALIASES: Record<string, string> = {
  kl: "KUL",
  "k.l.": "KUL",
  nyc: "JFK",
  "new york": "JFK",
  "new york city": "JFK",
  bengaluru: "BLR",
  bombay: "BOM",
  "ho chi minh city": "SGN",
  saigon: "SGN",
  bali: "DPS",
  denpasar: "DPS",
  "new delhi": "DEL",
  peking: "PEK",
  "kuala lumpur": "KUL",
  langkawi: "LGK",
  "pulau langkawi": "LGK",
};

/**
 * Curated multi-airport fan-out for countries where multiple destinations are
 * worth searching when the user names just the country. Built from the
 * existing curated list (matches python-archive/lib/destinations.py).
 * For countries not in this map, resolve() falls back to scanning the full
 * airports dataset.
 */
const COUNTRY_OVERRIDES: Record<string, string[]> = {
  nepal: ["KTM"],
  malaysia: ["KUL", "PEN", "LGK"],
  thailand: ["BKK", "DMK", "HKT", "CNX"],
  philippines: ["MNL", "CEB"],
  indonesia: ["CGK", "DPS"],
  japan: ["NRT", "HND", "KIX"],
  singapore: ["SIN"],
  india: ["DEL", "BOM", "BLR"],
  uae: ["DXB", "AUH"],
  "united arab emirates": ["DXB", "AUH"],
  turkey: ["IST", "SAW"],
  uk: ["LHR", "LGW"],
  "united kingdom": ["LHR", "LGW"],
  britain: ["LHR", "LGW"],
  england: ["LHR", "LGW"],
  usa: ["JFK", "LAX", "ORD", "MIA", "SFO"],
  "united states": ["JFK", "LAX", "ORD", "MIA", "SFO"],
  america: ["JFK", "LAX", "ORD", "MIA", "SFO"],
  "saudi arabia": ["JED", "RUH"],
  qatar: ["DOH"],
  pakistan: ["KHI", "LHE", "ISB"],
  france: ["CDG", "ORY", "NCE"],
  germany: ["FRA", "MUC", "BER"],
  spain: ["MAD", "BCN"],
  italy: ["FCO", "MXP"],
  netherlands: ["AMS"],
  greece: ["ATH"],
  switzerland: ["ZRH", "GVA"],
  portugal: ["LIS"],
  ireland: ["DUB"],
  australia: ["SYD", "MEL", "BNE", "PER"],
  "new zealand": ["AKL", "CHC", "WLG"],
  china: ["PEK", "PVG", "CAN", "HKG"],
  "south korea": ["ICN", "GMP"],
  korea: ["ICN", "GMP"],
  taiwan: ["TPE"],
  vietnam: ["SGN", "HAN", "DAD"],
  cambodia: ["PNH", "REP"],
  laos: ["VTE", "LPQ"],
  myanmar: ["RGN"],
  burma: ["RGN"],
  "sri lanka": ["CMB"],
  bangladesh: ["DAC"],
  maldives: ["MLE"],
  bhutan: ["PBH"],
  egypt: ["CAI", "SSH", "HRG"],
  morocco: ["CMN", "RAK"],
  "south africa": ["JNB", "CPT", "DUR"],
  kenya: ["NBO"],
  tanzania: ["DAR", "JRO", "ZNZ"],
  ethiopia: ["ADD"],
  nigeria: ["LOS", "ABV"],
  jordan: ["AMM"],
  lebanon: ["BEY"],
  israel: ["TLV"],
  iran: ["IKA"],
  brazil: ["GRU", "GIG", "BSB"],
  argentina: ["EZE"],
  chile: ["SCL"],
  peru: ["LIM", "CUZ"],
  colombia: ["BOG", "MDE"],
  mexico: ["MEX", "CUN", "GDL"],
  canada: ["YYZ", "YUL", "YVR", "YYC"],
  russia: ["SVO", "LED"],
  poland: ["WAW"],
  "czech republic": ["PRG"],
  czechia: ["PRG"],
  hungary: ["BUD"],
  austria: ["VIE"],
  belgium: ["BRU"],
  denmark: ["CPH"],
  sweden: ["ARN"],
  norway: ["OSL"],
  finland: ["HEL"],
  iceland: ["KEF"],
  cuba: ["HAV"],
  jamaica: ["KIN", "MBJ"],
  "dominican republic": ["SDQ", "PUJ"],
  bahamas: ["NAS"],
  fiji: ["NAN"],
  mauritius: ["MRU"],
  seychelles: ["SEZ"],
};

// ----- Build runtime maps from the static JSON ----------------------------

const RAW: RawAirport[] = airportsJson as RawAirport[];

export const AIRPORTS: Record<string, Airport> = {};
const CITY_TO_IATAS: Record<string, string[]> = {};
const COUNTRY_TO_IATAS: Record<string, string[]> = {};

for (const a of RAW) {
  const wikiCity = WIKI_CITY_OVERRIDES[a.iata] ?? a.city;
  AIRPORTS[a.iata] = { ...a, wikiCity };

  const cityKey = a.city.toLowerCase();
  (CITY_TO_IATAS[cityKey] ??= []).push(a.iata);

  const countryKey = a.country.toLowerCase();
  (COUNTRY_TO_IATAS[countryKey] ??= []).push(a.iata);
}

// Apply manual aliases — pushed to front so they take precedence on collision.
for (const [alias, iata] of Object.entries(CITY_ALIASES)) {
  const list = CITY_TO_IATAS[alias.toLowerCase()] ?? [];
  CITY_TO_IATAS[alias.toLowerCase()] = [iata, ...list.filter((i) => i !== iata)];
}

// ----- Resolution ---------------------------------------------------------

/** Rank an IATA list to prefer the main international airport for a city. */
function preferMajor(iatas: string[]): string[] {
  const sorted = [...iatas].sort((a, b) => {
    const an = AIRPORTS[a]?.name ?? "";
    const bn = AIRPORTS[b]?.name ?? "";
    const aIntl = /\bIntl\b|\bInternational\b/i.test(an) ? 1 : 0;
    const bIntl = /\bIntl\b|\bInternational\b/i.test(bn) ? 1 : 0;
    return bIntl - aIntl;
  });
  return sorted;
}

/** Resolve a country/city/IATA → list of airport IATAs. */
export function resolve(name: string): string[] {
  const s = name.trim().toLowerCase();
  if (!s) return [];

  // IATA direct
  if (s.length === 3 && AIRPORTS[s.toUpperCase()]) return [s.toUpperCase()];

  // Curated country fan-out
  if (COUNTRY_OVERRIDES[s]) {
    return COUNTRY_OVERRIDES[s].filter((i) => AIRPORTS[i]);
  }

  // Auto country fan-out — prefer up to 5 "International" airports.
  if (COUNTRY_TO_IATAS[s]) {
    const list = preferMajor(COUNTRY_TO_IATAS[s]);
    return list.slice(0, 5);
  }

  // City → prefer major airport for that city name.
  if (CITY_TO_IATAS[s]) {
    return [preferMajor(CITY_TO_IATAS[s])[0]];
  }

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
