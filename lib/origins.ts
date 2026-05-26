/**
 * Searchable origin airport list — derived from the full AIRPORTS dataset.
 * The OriginPicker shows a curated "popular" grid by default and fuzzy-filters
 * the full list as the user types.
 */

import { AIRPORTS, type Airport } from "./destinations";

export interface OriginOption {
  iata: string;
  city: string;
  country: string;
  label: string;
}

/** Hand-picked popular origins shown when the dropdown opens with no query. */
const POPULAR_IATAS = [
  "KHI", "LHE", "ISB",
  "DXB", "DOH", "AUH",
  "IST", "LHR", "CDG",
  "FRA", "AMS", "MAD",
  "JFK", "LAX", "SFO",
  "SIN", "HKG", "BKK",
  "NRT", "ICN", "SYD",
];

function toOption(a: Airport): OriginOption {
  return {
    iata: a.iata,
    city: a.city,
    country: a.country,
    label: `${a.city}, ${a.country}`,
  };
}

let _cache: OriginOption[] | null = null;

export function getOriginOptions(): OriginOption[] {
  if (!_cache) {
    _cache = Object.values(AIRPORTS)
      .map(toOption)
      .sort(
        (a, b) =>
          a.country.localeCompare(b.country) || a.city.localeCompare(b.city),
      );
  }
  return _cache;
}

export function getPopularOrigins(): OriginOption[] {
  const byIata = new Map(getOriginOptions().map((o) => [o.iata, o]));
  return POPULAR_IATAS.map((i) => byIata.get(i)).filter(Boolean) as OriginOption[];
}

/**
 * Substring search across city / country / IATA / label. Results are ranked:
 * exact IATA match first, then prefix matches, then substring matches.
 */
export function searchOrigins(query: string): OriginOption[] {
  const q = query.trim().toLowerCase();
  if (!q) return getOriginOptions();

  const matches: Array<{ o: OriginOption; score: number }> = [];
  for (const o of getOriginOptions()) {
    const iata = o.iata.toLowerCase();
    const city = o.city.toLowerCase();
    const country = o.country.toLowerCase();

    let score = -1;
    if (iata === q) score = 0;
    else if (city === q) score = 1;
    else if (city.startsWith(q)) score = 2;
    else if (country === q) score = 3;
    else if (country.startsWith(q)) score = 4;
    else if (iata.startsWith(q)) score = 5;
    else if (city.includes(q)) score = 6;
    else if (country.includes(q)) score = 7;
    if (score >= 0) matches.push({ o, score });
  }

  matches.sort(
    (a, b) =>
      a.score - b.score ||
      a.o.country.localeCompare(b.o.country) ||
      a.o.city.localeCompare(b.o.city),
  );
  return matches.map((m) => m.o);
}

export function groupOriginsByCountry(
  options: OriginOption[],
): Array<{ country: string; items: OriginOption[] }> {
  const map = new Map<string, OriginOption[]>();
  for (const o of options) {
    const arr = map.get(o.country) ?? [];
    arr.push(o);
    map.set(o.country, arr);
  }
  return [...map.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([country, items]) => ({ country, items }));
}

export function findOriginByIata(iata: string): OriginOption | null {
  const a = AIRPORTS[iata.toUpperCase()];
  return a ? toOption(a) : null;
}

export const DEFAULT_ORIGIN_IATA = "KHI";

export function getDefaultOrigin(): OriginOption {
  return findOriginByIata(DEFAULT_ORIGIN_IATA) ?? getOriginOptions()[0];
}
