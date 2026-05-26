/**
 * Google Flights scraper using their internal FlightsFrontendService RPC.
 *
 * Google removed flight data from the initial HTML response in 2025 — it's now
 * fetched client-side via a POST to /_/FlightsFrontendUi/data/.../GetShoppingResults.
 * Direct HTML scraping (the old fast-flights "common" mode) returns empty
 * placeholders regardless of TLS fingerprint. We replicate the XHR call.
 *
 * Flow:
 *   1. GET https://www.google.com/travel/flights once to harvest the NID cookie
 *      plus two embedded values: `FdrFJe` (session id) and `cfb2h` (build label).
 *      Cached for ~20 minutes per process.
 *   2. POST GetShoppingResults with an `f.req` payload containing the route
 *      (origin/dest IATA), dates, passengers, cabin. Body is a doubly-encoded
 *      JSON string per Google's batchexecute convention.
 *   3. Parse the streaming JSON response, walk to the flight list, extract
 *      cheapest offer with airline / stops / duration.
 */

import { bookingUrl } from "./deeplink";
import { getAirport } from "./destinations";
import type { Cabin, Offer } from "./types";

interface FetchArgs {
  origin: string;
  dest: string;
  depart: string;
  return: string | null;
  cabin: Cabin;
  adults: number;
}

const USER_AGENT =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 " +
  "(KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";

const BASE_HEADERS: Record<string, string> = {
  "user-agent": USER_AGENT,
  "accept-language": "en-US,en;q=0.9",
};

const SESSION_TTL_MS = 20 * 60_000;

interface Session {
  sid: string;
  bl: string;
  cookieHeader: string;
  pageUrl: string;
  fetchedAt: number;
}

let sessionCache: Session | null = null;
let sessionPromise: Promise<Session> | null = null;

async function getSession(): Promise<Session> {
  const now = Date.now();
  if (sessionCache && now - sessionCache.fetchedAt < SESSION_TTL_MS) {
    return sessionCache;
  }
  if (sessionPromise) return sessionPromise;
  sessionPromise = (async () => {
    const pageUrl = "https://www.google.com/travel/flights?hl=en&curr=USD";
    const res = await fetch(pageUrl, {
      headers: { ...BASE_HEADERS, accept: "text/html" },
      redirect: "manual",
    });
    if (res.status !== 200) {
      throw new Error(`google-flights session: page status ${res.status}`);
    }
    const setCookies = res.headers.getSetCookie?.() ?? [];
    const cookieHeader = setCookies.map((s) => s.split(";")[0]).join("; ");
    const html = await res.text();
    const sid = html.match(/"FdrFJe":"(-?\d+)"/)?.[1];
    const bl = html.match(/"cfb2h":"(boq_travel[^"]+)"/)?.[1];
    if (!sid || !bl) {
      throw new Error("google-flights session: missing sid/bl in page HTML");
    }
    sessionCache = { sid, bl, cookieHeader, pageUrl, fetchedAt: now };
    return sessionCache;
  })();
  try {
    return await sessionPromise;
  } finally {
    sessionPromise = null;
  }
}

const CABIN_TO_SEAT: Record<Cabin, number> = {
  economy: 1,
  "premium-economy": 2,
  business: 3,
  first: 4,
};

/**
 * Build the `f.req` body. Format mirrors what Google's own JS sends — the
 * indices and nesting were reverse-engineered from a Playwright capture.
 * Changing field order / nesting will silently break the response.
 */
function buildFReq(args: FetchArgs): string {
  const { origin, dest, depart, adults } = args;
  const ret = args.return;
  const seat = CABIN_TO_SEAT[args.cabin];

  const legs: unknown[] = [
    [
      [[[origin, 0]]], [[[dest, 0]]], null, 0, null, null,
      depart, null, null, null, null, null, null, null, 3,
    ],
  ];
  if (ret) {
    legs.push([
      [[[dest, 0]]], [[[origin, 0]]], null, 0, null, null,
      ret, null, null, null, null, null, null, null, 3,
    ]);
  }

  const inner = [
    [null, null, null, ""],
    [
      null, null, seat, null, [], 1, [adults, 0, 0, 0],
      null, null, null, null, null, null,
      legs,
      null, null, null, 1,
    ],
    0, 1, 0, 1,
  ];

  return JSON.stringify([null, JSON.stringify(inner)]);
}

interface RawOffer {
  price: number;
  airline: string;
  stops: number;
  durationMin: number | null;
}

function parseShoppingResults(raw: string): RawOffer[] {
  const offers: RawOffer[] = [];
  // Each wrb.fr entry holds a JSON-encoded string containing the actual response.
  const matches = raw.matchAll(/"wrb\.fr",null,"((?:\\.|[^"\\])*)"/g);
  for (const m of matches) {
    let outer: unknown;
    try {
      const escaped = m[1];
      outer = JSON.parse(JSON.parse(`"${escaped}"`));
    } catch {
      continue;
    }
    if (!Array.isArray(outer)) continue;

    // outer[2] = "best" flights array, outer[3] = "other" flights array.
    // Both have shape: [[flight1, flight2, ...], ...other-stuff].
    for (const idx of [2, 3] as const) {
      const section = (outer as unknown[])[idx];
      if (!Array.isArray(section)) continue;
      const flightList = (section as unknown[])[0];
      if (!Array.isArray(flightList)) continue;
      for (const f of flightList as unknown[]) {
        if (!Array.isArray(f) || f.length < 2) continue;
        const meta = f[0];
        const priceTuple = f[1];
        if (!Array.isArray(meta) || !Array.isArray(priceTuple)) continue;
        const priceCell = priceTuple[0];
        const price = Array.isArray(priceCell) ? priceCell[1] : undefined;
        if (typeof price !== "number") continue;

        const airlineCode = typeof meta[0] === "string" ? (meta[0] as string) : "";
        const airlineNames = meta[1];
        const airline =
          Array.isArray(airlineNames) && typeof airlineNames[0] === "string"
            ? (airlineNames[0] as string)
            : airlineCode;
        const segments = meta[2];
        const stops = Array.isArray(segments) ? Math.max(0, segments.length - 1) : 0;
        const durationMin = typeof meta[9] === "number" ? (meta[9] as number) : null;

        offers.push({ price, airline, stops, durationMin });
      }
    }
  }
  return offers;
}

function formatDuration(min: number | null): string {
  if (min === null || !Number.isFinite(min)) return "";
  const h = Math.floor(min / 60);
  const m = min % 60;
  if (h === 0) return `${m} min`;
  return m === 0 ? `${h} hr` : `${h} hr ${m} min`;
}

export async function fetchGoogleFlights(args: FetchArgs): Promise<Offer | null> {
  let raw: RawOffer[];
  try {
    const sess = await getSession();
    const body = new URLSearchParams({ "f.req": buildFReq(args) }).toString();
    const postUrl =
      "https://www.google.com/_/FlightsFrontendUi/data/" +
      "travel.frontend.flights.FlightsFrontendService/GetShoppingResults" +
      `?f.sid=${sess.sid}&bl=${sess.bl}&hl=en&soc-app=162` +
      `&soc-platform=1&soc-device=1&_reqid=15257&rt=c`;

    const res = await fetch(postUrl, {
      method: "POST",
      headers: {
        ...BASE_HEADERS,
        accept: "*/*",
        "content-type": "application/x-www-form-urlencoded;charset=UTF-8",
        origin: "https://www.google.com",
        referer: sess.pageUrl,
        cookie: sess.cookieHeader,
        "x-same-domain": "1",
        "x-goog-ext-259736195-jspb": JSON.stringify([
          "en-US", "US", "USD", 1, null, [-300], null, null, 7, [],
        ]),
      },
      body,
    });
    if (res.status !== 200) {
      // Invalidate cached session on auth/cookie issues so the next call retries.
      if (res.status === 400 || res.status === 401 || res.status === 403) {
        sessionCache = null;
      }
      console.warn(`Google Flights ${res.status} for ${args.origin}→${args.dest} on ${args.depart}`);
      return null;
    }
    const text = await res.text();
    raw = parseShoppingResults(text);
  } catch (err) {
    console.warn(`Google Flights fetch error for ${args.origin}→${args.dest}:`, err);
    return null;
  }

  if (raw.length === 0) return null;

  // Cheapest first; prefer fewer stops on ties.
  raw.sort((a, b) => a.price - b.price || a.stops - b.stops);
  const best = raw[0];

  const airport = getAirport(args.dest);
  const nights =
    args.return && args.depart
      ? Math.round(
          (new Date(args.return).getTime() - new Date(args.depart).getTime()) /
            (1000 * 60 * 60 * 24),
        )
      : null;

  return {
    origin: args.origin,
    destIata: args.dest,
    destCity: airport?.city ?? args.dest,
    destCountry: airport?.country ?? "",
    departDate: args.depart,
    returnDate: args.return,
    nights,
    price: best.price,
    priceDisplay: `$${best.price.toFixed(0)}`,
    currency: "USD",
    airline: best.airline,
    stops: best.stops,
    duration: formatDuration(best.durationMin),
    source: "google",
    stale: false,
    bookingUrl: bookingUrl({
      origin: args.origin,
      dest: args.dest,
      depart: args.depart,
      return: args.return,
      adults: args.adults,
      cabin: args.cabin,
    }),
  };
}
