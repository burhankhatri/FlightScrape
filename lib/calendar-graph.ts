/**
 * Google Flights' "Price graph" endpoint — `GetCalendarGraph`.
 *
 * Returns ~60 (depart, return, price) tuples for nearby date pairs of the same
 * trip duration as the baseline. This is what powers the date-flexible price
 * chart shown in Google Flights' UI when the user clicks "Price graph".
 *
 * We use it for forecasting: given the user's chosen dates, are there nearby
 * date pairs that would be materially cheaper? And where does the chosen price
 * sit in the 60-day distribution (percentile)?
 *
 * Reverse-engineered from the same XHR `GetShoppingResults` lives in. Same
 * session cookies, same `bl`/`sid` URL params, just a different RPC method
 * with extra payload fields: [graph_start, graph_end] date window + trip nights.
 */

import { getGoogleFlightsSession } from "./google-flights-session";
import { getCachedGeneric, setCachedGeneric } from "./cache";

export interface NearbyPrice {
  departDate: string;
  returnDate: string;
  price: number;
}

interface FetchArgs {
  origin: string;
  dest: string;
  departDate: string;          // YYYY-MM-DD
  returnDate: string;          // YYYY-MM-DD (required; one-way calendar isn't supported)
  adults: number;
}

const BASE_HEADERS: Record<string, string> = {
  "user-agent":
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 " +
    "(KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
  "accept-language": "en-US,en;q=0.9",
};

function addDaysISO(iso: string, days: number): string {
  const t = Date.UTC(
    parseInt(iso.slice(0, 4), 10),
    parseInt(iso.slice(5, 7), 10) - 1,
    parseInt(iso.slice(8, 10), 10),
  );
  return new Date(t + days * 86_400_000).toISOString().slice(0, 10);
}

function nightsBetween(a: string, b: string): number {
  const ta = Date.UTC(+a.slice(0, 4), +a.slice(5, 7) - 1, +a.slice(8, 10));
  const tb = Date.UTC(+b.slice(0, 4), +b.slice(5, 7) - 1, +b.slice(8, 10));
  return Math.round((tb - ta) / 86_400_000);
}

function buildFReq(args: FetchArgs): string {
  const { origin, dest, departDate, returnDate, adults } = args;
  // Same legs structure as GetShoppingResults.
  const legs = [
    [
      [[[origin, 0]]], [[[dest, 0]]], null, 0, null, null,
      departDate, null, null, null, null, null, null, null, 3,
    ],
    [
      [[[dest, 0]]], [[[origin, 0]]], null, 0, null, null,
      returnDate, null, null, null, null, null, null, null, 3,
    ],
  ];
  const trip = nightsBetween(departDate, returnDate);
  // Graph window: 7 days before depart through 60 days after.
  const graphStart = addDaysISO(departDate, -7);
  const graphEnd = addDaysISO(departDate, 60);

  const inner = [
    null,
    [
      null, null, 1, null, [], 1, [adults, 0, 0, 0],
      null, null, null, null, null, null,
      legs,
      null, null, null, 1,
    ],
    [graphStart, graphEnd],
    null,
    [trip, trip],
  ];
  return JSON.stringify([null, JSON.stringify(inner)]);
}

function parseGraphResponse(raw: string): NearbyPrice[] {
  const out: NearbyPrice[] = [];
  const matches = raw.matchAll(/"wrb\.fr",(?:"[^"]*"|null),"((?:\\.|[^"\\])*)"/g);
  for (const m of matches) {
    let inner: unknown;
    try {
      inner = JSON.parse(JSON.parse(`"${m[1]}"`));
    } catch {
      continue;
    }
    // Walk for [depart, return, [[null, price], "token"]] tuples.
    const stack: unknown[] = [inner];
    let depth = 0;
    while (stack.length > 0 && depth < 30_000) {
      depth++;
      const node = stack.pop();
      if (!Array.isArray(node)) continue;
      if (
        typeof node[0] === "string" &&
        /^\d{4}-\d{2}-\d{2}$/.test(node[0]) &&
        typeof node[1] === "string" &&
        /^\d{4}-\d{2}-\d{2}$/.test(node[1])
      ) {
        const priceCell = (node[2] as unknown[] | undefined)?.[0];
        const price = Array.isArray(priceCell) ? priceCell[1] : undefined;
        if (typeof price === "number") {
          out.push({ departDate: node[0], returnDate: node[1], price });
        }
        continue;
      }
      for (const child of node) stack.push(child);
    }
  }
  return out;
}

const CALGRAPH_TTL_SEC = 6 * 60 * 60;

function cacheKey(args: FetchArgs): string {
  return `cg:${args.origin}:${args.dest}:${args.departDate}:${args.returnDate}:${args.adults}`;
}

export async function fetchCalendarGraph(args: FetchArgs): Promise<NearbyPrice[] | null> {
  const key = cacheKey(args);
  const cached = await getCachedGeneric<NearbyPrice[]>(key);
  if (cached) return cached;

  let sess;
  try {
    sess = await getGoogleFlightsSession();
  } catch (err) {
    console.warn(`calendar-graph session error:`, err);
    return null;
  }

  const body = new URLSearchParams({ "f.req": buildFReq(args) }).toString();
  const postUrl =
    "https://www.google.com/_/FlightsFrontendUi/data/" +
    "travel.frontend.flights.FlightsFrontendService/GetCalendarGraph" +
    `?f.sid=${sess.sid}&bl=${sess.bl}&hl=en&soc-app=162` +
    `&soc-platform=1&soc-device=1&_reqid=15257&rt=c`;

  try {
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
      console.warn(`GetCalendarGraph ${res.status} for ${args.origin}→${args.dest}`);
      return null;
    }
    const text = await res.text();
    const nearby = parseGraphResponse(text);
    if (nearby.length === 0) return null;
    await setCachedGeneric(key, nearby, CALGRAPH_TTL_SEC);
    return nearby;
  } catch (err) {
    console.warn(`GetCalendarGraph fetch error for ${args.origin}→${args.dest}:`, err);
    return null;
  }
}
