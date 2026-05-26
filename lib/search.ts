/**
 * Multi-destination flight search with optional streaming callbacks.
 */

import pLimit from "p-limit";
import { fetchAmadeus } from "./amadeus";
import { getCachedSearch, setCachedSearch } from "./cache";
import { bookingUrl } from "./deeplink";
import { resolve, getAirport } from "./destinations";
import { fetchGoogleFlights } from "./google-flights";
import { heroImage } from "./images";
import type { SearchCallbacks } from "./search-events";
import type { Cabin, Card, Filters, Offer, SearchStats } from "./types";

interface SearchArgs {
  originIata: string;
  destinationNames: string[];
  departDates: string[];
  returnDates: string[] | null;
  cabin?: Cabin;
  adults?: number;
  filters?: Filters;
  maxConcurrent?: number;
}

type Combo = { group: string; iata: string; depart: string; ret: string | null };

const comboKey = (c: Combo) => `${c.group}|${c.iata}|${c.depart}|${c.ret ?? ""}`;

export async function lookupPair(
  origin: string,
  dest: string,
  depart: string,
  ret: string | null,
  cabin: Cabin,
  adults: number,
  cachedOffer?: Offer | null,
): Promise<Offer | null> {
  if (cachedOffer) return { ...cachedOffer, source: "cache" };

  const cached = await getCachedSearch(origin, dest, depart, ret, cabin, adults);
  if (cached) return { ...cached, source: "cache" };

  let offer = await fetchGoogleFlights({ origin, dest, depart, return: ret, cabin, adults });
  if (offer) {
    await setCachedSearch(origin, dest, depart, ret, cabin, adults, offer);
    return offer;
  }

  offer = await fetchAmadeus({ origin, dest, depart, return: ret, cabin, adults });
  if (offer) {
    await setCachedSearch(origin, dest, depart, ret, cabin, adults, offer);
    return offer;
  }

  return null;
}

function passes(offer: Offer, filters: Filters): boolean {
  if (filters.maxStops !== null && offer.stops > filters.maxStops) return false;
  if (filters.maxPrice !== null && offer.price > filters.maxPrice) return false;
  if (filters.excludeAirlines.length > 0) {
    const airlineLc = offer.airline.toLowerCase();
    if (filters.excludeAirlines.some((x) => x && airlineLc.includes(x.toLowerCase()))) return false;
  }
  if (filters.maxDurationHours !== null) {
    const m = offer.duration.match(/(\d+)\s*hr(?:\s*(\d+)\s*min)?/);
    if (m) {
      const hrs = parseInt(m[1], 10) + (m[2] ? parseInt(m[2], 10) / 60 : 0);
      if (hrs > filters.maxDurationHours) return false;
    }
  }
  return true;
}

function buildCard(
  groupName: string,
  offers: Offer[],
  groupAttempts: number,
  adults: number,
  cabin: Cabin,
  imageUrl: string | null = null,
): Card | null {
  if (offers.length === 0) return null;
  const sorted = [...offers].sort((a, b) => a.price - b.price);
  const best = sorted[0];
  const airport = getAirport(best.destIata);
  const wikiTitle = airport?.wikiCity ?? best.destCity;
  const country = best.destCountry || groupName;
  const label =
    country && country.toLowerCase() !== best.destCity.toLowerCase()
      ? `${best.destCity}, ${country}`
      : best.destCity || groupName;

  const withBookingUrl = (o: Offer): Offer => ({
    ...o,
    bookingUrl: bookingUrl({
      origin: o.origin,
      dest: o.destIata,
      depart: o.departDate,
      return: o.returnDate,
      adults,
      cabin,
    }),
  });

  return {
    destLabel: label,
    destCountry: country,
    wikiTitle,
    imageUrl,
    best: withBookingUrl(best),
    alternates: sorted.slice(1, 9).map(withBookingUrl),
    combosTried: groupAttempts,
    combosSucceeded: sorted.length,
    priceMin: sorted[0].price,
    priceMax: sorted[sorted.length - 1].price,
    currency: best.currency,
  };
}

export async function search(
  args: SearchArgs,
  callbacks?: SearchCallbacks,
): Promise<{ cards: Card[]; stats: SearchStats }> {
  const cabin = args.cabin ?? "economy";
  const adults = args.adults ?? 1;
  const filters = args.filters ?? {
    maxStops: null,
    maxPrice: null,
    excludeAirlines: [],
    maxDurationHours: null,
  };
  const limit = pLimit(args.maxConcurrent ?? 10);

  const rawGroups: Array<{ name: string; iatas: Set<string> }> = [];
  for (const name of args.destinationNames) {
    const iatas = resolve(name);
    if (iatas.length > 0) rawGroups.push({ name, iatas: new Set(iatas) });
  }
  rawGroups.sort((a, b) => b.iatas.size - a.iatas.size);
  const groups: Array<{ name: string; iatas: string[] }> = [];
  const covered = new Set<string>();
  for (const g of rawGroups) {
    if ([...g.iatas].every((x) => covered.has(x))) continue;
    groups.push({ name: g.name, iatas: [...g.iatas].sort() });
    for (const x of g.iatas) covered.add(x);
  }
  if (groups.length === 0) return { cards: [], stats: emptyStats() };

  const datePairs: Array<[string, string | null]> = args.returnDates
    ? args.departDates.map((d, i) => [d, args.returnDates![i]])
    : args.departDates.map((d) => [d, null]);

  const allCombos: Combo[] = [];
  const groupComboKeys = new Map<string, string[]>();
  for (const g of groups) {
    const keys: string[] = [];
    for (const iata of g.iatas) {
      for (const [depart, ret] of datePairs) {
        const c: Combo = { group: g.name, iata, depart, ret };
        allCombos.push(c);
        keys.push(comboKey(c));
      }
    }
    groupComboKeys.set(g.name, keys);
  }

  callbacks?.onStatus?.("Checking cached fares…", "search");
  callbacks?.onProgress?.(0, allCombos.length, 0);

  // Cache-first batch — instant hits skip network calls.
  const cacheByKey = new Map<string, Offer | null>();
  await Promise.all(
    allCombos.map((c) =>
      limit(async () => {
        const key = comboKey(c);
        const hit = await getCachedSearch(
          args.originIata,
          c.iata,
          c.depart,
          c.ret,
          cabin,
          adults,
        );
        cacheByKey.set(key, hit);
      }),
    ),
  );

  const tStart = Date.now();
  const successful = new Set<string>();
  const comboAttempts = new Map<string, number>();
  const groupResults = new Map<string, Offer[]>();
  const groupAttempts = new Map<string, number>();
  const emittedGroups = new Set<string>();
  for (const g of groups) groupAttempts.set(g.name, 0);

  let checked = 0;

  const tryEmitGroup = async (groupName: string) => {
    if (emittedGroups.has(groupName)) return;
    const keys = groupComboKeys.get(groupName) ?? [];
    const finished = keys.every((k) => {
      const attempts = comboAttempts.get(k) ?? 0;
      return successful.has(k) || attempts >= 2;
    });
    if (!finished) return;

    emittedGroups.add(groupName);

    const offers = groupResults.get(groupName) ?? [];
    const card = buildCard(
      groupName,
      offers,
      groupAttempts.get(groupName) ?? keys.length,
      adults,
      cabin,
      null,
    );
    if (!card) return;

    callbacks?.onCard?.(card);

    heroImage(card.wikiTitle, card.best.destIata).then((url) => {
      if (url) callbacks?.onCardImage?.(card.destLabel, url);
    });
  };

  const recordResult = async (combo: Combo, offer: Offer | null) => {
    const key = comboKey(combo);
    checked += 1;
    callbacks?.onProgress?.(
      checked,
      allCombos.length,
      successful.size,
      `${combo.iata} · ${combo.depart}`,
    );

    if (offer) {
      successful.add(key);
      if (passes(offer, filters)) {
        const arr = groupResults.get(combo.group) ?? [];
        const filtered = arr.filter(
          (o) =>
            !(
              o.destIata === combo.iata &&
              o.departDate === combo.depart &&
              (o.returnDate ?? "") === (combo.ret ?? "")
            ),
        );
        filtered.push(offer);
        groupResults.set(combo.group, filtered);
      }
    }

    await tryEmitGroup(combo.group);
  };

  const runCombo = async (c: Combo, pass: number) => {
    const key = comboKey(c);
    comboAttempts.set(key, (comboAttempts.get(key) ?? 0) + 1);
    if (pass === 0) {
      groupAttempts.set(c.group, (groupAttempts.get(c.group) ?? 0) + 1);
    }

    const cached = pass === 0 ? cacheByKey.get(key) ?? null : null;
    const offer = await lookupPair(
      args.originIata,
      c.iata,
      c.depart,
      c.ret,
      cabin,
      adults,
      cached,
    );
    await recordResult(c, offer);
  };

  // Sort: cache hits first for faster early results.
  const sortedCombos = [...allCombos].sort((a, b) => {
    const aHit = cacheByKey.get(comboKey(a)) ? 0 : 1;
    const bHit = cacheByKey.get(comboKey(b)) ? 0 : 1;
    return aHit - bHit;
  });

  callbacks?.onStatus?.(
    `Searching ${allCombos.length} date & route combinations…`,
    "search",
  );

  for (let pass = 0; pass < 2; pass++) {
    const todo =
      pass === 0
        ? sortedCombos
        : sortedCombos.filter((c) => !successful.has(comboKey(c)));
    if (todo.length === 0) break;

    if (pass === 1) {
      callbacks?.onStatus?.("Retrying routes that timed out…", "search");
    }

    await Promise.all(todo.map((c) => limit(() => runCombo(c, pass))));
  }

  // Emit any groups that had no offers (skip) or weren't emitted yet.
  for (const g of groups) {
    await tryEmitGroup(g.name);
  }

  const elapsedSec = (Date.now() - tStart) / 1000;
  const totalAttempts = [...groupAttempts.values()].reduce((a, b) => a + b, 0);
  const totalSucceeded = successful.size;

  callbacks?.onStatus?.("Polishing results…", "images");

  const cards: Card[] = [];
  const imageEntries = [...groupResults.entries()];

  const built = await Promise.all(
    imageEntries.map(async ([groupName, offers]) => {
      if (offers.length === 0) return null;
      const sorted = [...offers].sort((a, b) => a.price - b.price);
      const best = sorted[0];
      const airport = getAirport(best.destIata);
      const wikiTitle = airport?.wikiCity ?? best.destCity;
      const imageUrl = await heroImage(wikiTitle, best.destIata);
      return buildCard(
        groupName,
        offers,
        groupAttempts.get(groupName) ?? offers.length,
        adults,
        cabin,
        imageUrl,
      );
    }),
  );

  for (const card of built) {
    if (!card) continue;
    cards.push(card);
    // Stream polish-phase images — early async lookups may have timed out.
    if (card.imageUrl) {
      callbacks?.onCardImage?.(card.destLabel, card.imageUrl);
    }
  }
  cards.sort((a, b) => a.best.price - b.best.price);

  return {
    cards,
    stats: {
      totalAttempts,
      totalSucceeded,
      durationSec: elapsedSec,
      dateCombos: datePairs.length,
    },
  };
}

function emptyStats(): SearchStats {
  return { totalAttempts: 0, totalSucceeded: 0, durationSec: 0, dateCombos: 0 };
}
