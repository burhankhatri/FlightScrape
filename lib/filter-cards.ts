/**
 * Client-side filters applied on top of the search results. Each Card carries
 * its full offer pool (`best` + `alternates` — up to 9 offers), so we can
 * re-rank without re-querying: pick the cheapest offer that passes, expose the
 * rest as alternates, and hide cards whose entire pool is filtered out.
 */

import type { Card, Filters, Offer } from "./types";

export const DEFAULT_FILTERS: Filters = {
  maxStops: null,
  maxPrice: null,
  excludeAirlines: [],
  maxDurationHours: null,
};

function parseHours(duration: string): number | null {
  const m = duration.match(/(\d+)\s*hr(?:\s*(\d+)\s*min)?/);
  if (!m) return null;
  return parseInt(m[1], 10) + (m[2] ? parseInt(m[2], 10) / 60 : 0);
}

function offerPasses(offer: Offer, filters: Filters): boolean {
  if (filters.maxStops !== null && offer.stops > filters.maxStops) return false;
  if (filters.maxPrice !== null && offer.price > filters.maxPrice) return false;
  if (filters.excludeAirlines.length > 0) {
    const airlineLc = offer.airline.toLowerCase();
    if (
      filters.excludeAirlines.some(
        (x) => x && airlineLc.includes(x.toLowerCase()),
      )
    ) {
      return false;
    }
  }
  if (filters.maxDurationHours !== null) {
    const hrs = parseHours(offer.duration);
    if (hrs !== null && hrs > filters.maxDurationHours) return false;
  }
  return true;
}

/** Apply filters across each card's full offer pool. */
export function filterCards(cards: Card[], filters: Filters): Card[] {
  const result: Card[] = [];
  for (const card of cards) {
    const pool = [card.best, ...card.alternates].filter((o) =>
      offerPasses(o, filters),
    );
    if (pool.length === 0) continue;
    const sorted = [...pool].sort((a, b) => a.price - b.price);
    result.push({
      ...card,
      best: sorted[0],
      alternates: sorted.slice(1, 9),
      combosSucceeded: pool.length,
      priceMin: sorted[0].price,
      priceMax: sorted[sorted.length - 1].price,
    });
  }
  result.sort((a, b) => a.best.price - b.best.price);
  return result;
}

/** Pull the unique airlines + price/duration bounds from a card list. */
export function deriveFilterBounds(cards: Card[]) {
  const airlines = new Set<string>();
  let maxPrice = 0;
  let minPrice = Infinity;
  let maxDuration = 0;
  let maxStops = 0;

  for (const card of cards) {
    for (const o of [card.best, ...card.alternates]) {
      if (o.airline) airlines.add(o.airline);
      maxPrice = Math.max(maxPrice, o.price);
      minPrice = Math.min(minPrice, o.price);
      maxStops = Math.max(maxStops, o.stops);
      const hrs = parseHours(o.duration);
      if (hrs !== null) maxDuration = Math.max(maxDuration, hrs);
    }
  }

  return {
    airlines: [...airlines].sort((a, b) => a.localeCompare(b)),
    minPrice: minPrice === Infinity ? 0 : Math.floor(minPrice),
    maxPrice: Math.ceil(maxPrice),
    maxDuration: Math.ceil(maxDuration),
    maxStops,
  };
}

export function isFiltersActive(f: Filters): boolean {
  return (
    f.maxStops !== null ||
    f.maxPrice !== null ||
    f.maxDurationHours !== null ||
    f.excludeAirlines.length > 0
  );
}

export function activeFilterCount(f: Filters): number {
  return (
    (f.maxStops !== null ? 1 : 0) +
    (f.maxPrice !== null ? 1 : 0) +
    (f.maxDurationHours !== null ? 1 : 0) +
    f.excludeAirlines.length
  );
}
