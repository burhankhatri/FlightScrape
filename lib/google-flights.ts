/**
 * Direct HTTP fetch + cheerio parse of Google Flights tfs results page.
 *
 * Replaces python-archive/lib/search.py::_fetch_fast_flights (the `common` mode of
 * fast-flights — no Playwright fallback because Vercel serverless can't run a browser).
 *
 * The CSS selectors come straight from python-archive/.venv/.../fast_flights/core.py
 * `parse_response`. They're stable: same selectors have worked across many fast-flights
 * releases. If Google changes them this file breaks first.
 */

import * as cheerio from "cheerio";
import { buildTfs } from "./tfs";
import type { Cabin, Offer, TripType } from "./types";
import { getAirport } from "./destinations";

interface FetchArgs {
  origin: string;
  dest: string;
  depart: string;
  return: string | null;
  cabin: Cabin;
  adults: number;
}

/**
 * Headers chosen to look like a real Chrome on macOS. Without a believable
 * UA + Accept-Language, Google sometimes returns its consent gate or a
 * mobile layout we don't parse.
 */
const REQUEST_HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 " +
    "(KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
  "Accept":
    "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
  "Accept-Language": "en-US,en;q=0.9",
  "Accept-Encoding": "gzip, deflate, br",
  "Cache-Control": "no-cache",
};

/** Build the tfs request URL with USD currency forced. */
function buildRequestUrl(args: FetchArgs): string {
  const legs = [
    { date: args.depart, fromIata: args.origin, toIata: args.dest },
  ];
  let trip: TripType = "one-way";
  if (args.return) {
    legs.push({ date: args.return, fromIata: args.dest, toIata: args.origin });
    trip = "round-trip";
  }
  const tfs = buildTfs({ legs, trip, cabin: args.cabin, adults: args.adults });
  const params = new URLSearchParams({
    tfs,
    hl: "en",
    tfu: "EgQIABABIgA",
    curr: "USD",
  });
  return `https://www.google.com/travel/flights?${params.toString()}`;
}

/**
 * Parse a price string into (numeric, ISO currency).
 * "$1,234.56" → [1234.56, "USD"], "PKR 257,507" → [257507, "PKR"].
 */
function parsePrice(s: string): [number, string] {
  if (!s) return [Infinity, ""];
  const symbolMap: Record<string, string> = { $: "USD", "£": "GBP", "€": "EUR", "₹": "INR", "¥": "JPY" };
  const match = s.match(/(?:([$£€₹¥])|\b([A-Z]{3})\b)?\s*([\d,]+(?:\.\d+)?)/);
  if (!match) return [Infinity, ""];
  const [, sym, isoPrefix, num] = match;
  const value = parseFloat(num.replace(/,/g, ""));
  if (isNaN(value)) return [Infinity, ""];
  const currency = sym ? symbolMap[sym] ?? "USD" : isoPrefix ?? "USD";
  return [value, currency];
}

/** Extract flights from the Google Flights HTML. Mirrors fast-flights' parse_response. */
function parseFlights(html: string): Array<{
  isBest: boolean;
  airline: string;
  duration: string;
  stops: number;
  price: string;
}> {
  const $ = cheerio.load(html);
  const flights: Array<{
    isBest: boolean;
    airline: string;
    duration: string;
    stops: number;
    price: string;
  }> = [];

  // Two sections in the results page: "best flights" and "other flights".
  const sections = $('div[jsname="IWWDBc"], div[jsname="YdtKid"]');
  sections.each((sectionIdx, section) => {
    const isBest = sectionIdx === 0;
    // The last <li> in "other" sections is a "show more" stub — skip it.
    const items = $(section).find("ul.Rk10dc li");
    items.each((itemIdx, item) => {
      if (!isBest && itemIdx === items.length - 1) return;

      const airline = $(item)
        .find("div.sSHqwe.tPgKwe.ogfYpf span")
        .first()
        .text()
        .trim();
      const duration = $(item).find("li div.Ak5kof div").first().text().trim();
      const stopsText = $(item).find(".BbR8Ec .ogfYpf").first().text().trim();
      const price = ($(item).find(".YMlIz.FpEdX").first().text().trim() || "0").replace(/,/g, "");

      let stops = 0;
      if (stopsText && stopsText !== "Nonstop") {
        const m = stopsText.match(/(\d+)/);
        stops = m ? parseInt(m[1], 10) : 0;
      }

      if (price && price !== "0") {
        flights.push({ isBest, airline, duration, stops, price });
      }
    });
  });

  return flights;
}

/** Fetch + parse. Returns the cheapest Offer or null on failure. */
export async function fetchGoogleFlights(args: FetchArgs): Promise<Offer | null> {
  const url = buildRequestUrl(args);

  let html: string;
  try {
    const res = await fetch(url, { headers: REQUEST_HEADERS, redirect: "follow" });
    if (!res.ok) {
      console.warn(`Google Flights ${res.status} for ${args.origin}→${args.dest} on ${args.depart}`);
      return null;
    }
    html = await res.text();
  } catch (err) {
    console.warn(`Google Flights fetch error for ${args.origin}→${args.dest}:`, err);
    return null;
  }

  const flights = parseFlights(html);
  if (flights.length === 0) return null;

  // Prefer is_best flights, then cheapest.
  const candidates = flights.filter((f) => f.isBest);
  const pool = candidates.length > 0 ? candidates : flights;

  let cheapest: (typeof pool)[0] | null = null;
  let cheapestPrice = Infinity;
  let cheapestCurrency = "USD";
  for (const f of pool) {
    const [price, currency] = parsePrice(f.price);
    if (price < cheapestPrice) {
      cheapest = f;
      cheapestPrice = price;
      cheapestCurrency = currency;
    }
  }
  if (!cheapest || cheapestPrice === Infinity) return null;

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
    price: cheapestPrice,
    priceDisplay: cheapest.price.startsWith("$")
      ? cheapest.price
      : `${cheapestCurrency} ${cheapestPrice.toFixed(0)}`,
    currency: cheapestCurrency,
    airline: cheapest.airline,
    stops: cheapest.stops,
    duration: cheapest.duration,
    source: "google",
    stale: false,
    bookingUrl: "", // filled in by caller via deeplink.ts
  };
}
