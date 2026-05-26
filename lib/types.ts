/**
 * Shared types — mirror the Python dataclasses in python-archive/lib/search.py.
 * Anything serialized to JSON by /api/search must be representable here.
 */

export type Cabin = "economy" | "premium-economy" | "business" | "first";
export type TripType = "round-trip" | "one-way";

/** One bookable result for one (origin, dest_iata, depart, return) combination. */
export interface Offer {
  origin: string;
  destIata: string;
  destCity: string;
  destCountry: string;
  departDate: string;          // YYYY-MM-DD
  returnDate: string | null;
  nights: number | null;       // null for one-way
  price: number;               // numeric, for sorting
  priceDisplay: string;        // "$684"
  currency: string;            // "USD"
  airline: string;
  stops: number;
  duration: string;            // "16 hr 5 min"
  source: "google" | "amadeus" | "cache" | "cache-stale";
  stale: boolean;
  bookingUrl: string;          // pre-built Google Flights deeplink
}

/** One destination card in the grid — best offer + runners-up. */
export interface Card {
  destLabel: string;           // "Kuala Lumpur, Malaysia"
  destCountry: string;
  wikiTitle: string;           // for image lookup
  imageUrl: string | null;     // Wikipedia hero image
  best: Offer;
  alternates: Offer[];
  combosTried: number;
  combosSucceeded: number;
  priceMin: number;
  priceMax: number;
  currency: string;
}

/** Post-fetch filters applied to results. */
export interface Filters {
  maxStops: number | null;
  maxPrice: number | null;
  excludeAirlines: string[];
  maxDurationHours: number | null;
}

/** End-to-end stats so the UI can show evidence. */
export interface SearchStats {
  totalAttempts: number;
  totalSucceeded: number;
  durationSec: number;
  dateCombos: number;
}

/** Output of the natural-language parser. */
export interface ParsedQuery {
  origin: string | null;
  destinations: string[];
  departDates: string[];
  returnDates: string[] | null;
  pax: number;
  cabin: Cabin;
  tripType: TripType;
}

/** The /api/search response shape. */
export interface SearchResponse {
  parsed: ParsedQuery;
  cards: Card[];
  stats: SearchStats;
}
