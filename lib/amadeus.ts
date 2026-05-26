/**
 * Amadeus Self-Service Flight Offers Search — REST fallback when Google
 * Flights direct HTTP returns no results. Free tier: 2000 calls/month.
 *
 * Direct port of python-archive/lib/search.py::_fetch_amadeus but using fetch()
 * instead of the Python SDK so it works in Vercel serverless.
 */

import type { Cabin, Offer } from "./types";
import { getAirport } from "./destinations";

interface AmadeusFetchArgs {
  origin: string;
  dest: string;
  depart: string;
  return: string | null;
  cabin: Cabin;
  adults: number;
}

interface AmadeusTokenCache {
  token: string;
  expiresAt: number;
}

let _tokenCache: AmadeusTokenCache | null = null;

async function getAccessToken(): Promise<string | null> {
  const clientId = process.env.AMADEUS_CLIENT_ID;
  const clientSecret = process.env.AMADEUS_CLIENT_SECRET;
  if (!clientId || !clientSecret) return null;

  if (_tokenCache && _tokenCache.expiresAt > Date.now() + 30_000) {
    return _tokenCache.token;
  }

  const res = await fetch("https://test.api.amadeus.com/v1/security/oauth2/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "client_credentials",
      client_id: clientId,
      client_secret: clientSecret,
    }),
  });

  if (!res.ok) {
    console.warn("Amadeus auth failed:", res.status);
    return null;
  }
  const data = (await res.json()) as { access_token: string; expires_in: number };
  _tokenCache = {
    token: data.access_token,
    expiresAt: Date.now() + data.expires_in * 1000,
  };
  return data.access_token;
}

const TRAVEL_CLASS: Record<Cabin, string> = {
  economy: "ECONOMY",
  "premium-economy": "PREMIUM_ECONOMY",
  business: "BUSINESS",
  first: "FIRST",
};

/** Convert Amadeus ISO 8601 duration ("PT16H45M") to a friendly string. */
function isoDurationToFriendly(iso: string): string {
  return iso
    .replace("PT", "")
    .replace(/(\d+)H/, "$1 hr ")
    .replace(/(\d+)M/, "$1 min")
    .trim();
}

export async function fetchAmadeus(args: AmadeusFetchArgs): Promise<Offer | null> {
  const token = await getAccessToken();
  if (!token) return null;

  const params = new URLSearchParams({
    originLocationCode: args.origin,
    destinationLocationCode: args.dest,
    departureDate: args.depart,
    adults: String(args.adults),
    max: "5",
    currencyCode: "USD",
    travelClass: TRAVEL_CLASS[args.cabin],
  });
  if (args.return) params.set("returnDate", args.return);

  const res = await fetch(`https://test.api.amadeus.com/v2/shopping/flight-offers?${params}`, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!res.ok) {
    console.warn(`Amadeus ${res.status} for ${args.origin}→${args.dest}`);
    return null;
  }

  const data = (await res.json()) as {
    data?: Array<{
      price: { total: string; currency?: string };
      itineraries: Array<{
        duration: string;
        segments: Array<{ carrierCode: string }>;
      }>;
    }>;
  };

  const offers = data.data ?? [];
  if (offers.length === 0) return null;

  offers.sort((a, b) => parseFloat(a.price.total) - parseFloat(b.price.total));
  const best = offers[0];
  const price = parseFloat(best.price.total);
  const currency = best.price.currency ?? "USD";
  const itin = best.itineraries[0];
  const duration = isoDurationToFriendly(itin.duration);
  const segments = itin.segments;
  const airline = segments[0]?.carrierCode ?? "";
  const stops = Math.max(0, segments.length - 1);

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
    price,
    priceDisplay: `$${price.toFixed(0)}`,
    currency,
    airline,
    stops,
    duration,
    source: "amadeus",
    stale: false,
    bookingUrl: "",
  };
}
