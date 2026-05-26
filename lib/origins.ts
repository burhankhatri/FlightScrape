/**
 * Searchable origin airport list derived from AIRPORTS.
 */

import { AIRPORTS, type Airport } from "./destinations";

export interface OriginOption {
  iata: string;
  city: string;
  country: string;
  label: string;
}

const POPULAR_IATAS = ["KHI", "LHE", "ISB", "DXB", "IST", "LHR", "JFK", "SIN"];

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

export function searchOrigins(query: string): OriginOption[] {
  const q = query.trim().toLowerCase();
  if (!q) return getOriginOptions();
  return getOriginOptions().filter(
    (o) =>
      o.city.toLowerCase().includes(q) ||
      o.country.toLowerCase().includes(q) ||
      o.iata.toLowerCase().includes(q) ||
      o.label.toLowerCase().includes(q),
  );
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
