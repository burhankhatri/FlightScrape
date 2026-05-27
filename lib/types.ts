/**
 * Shared types — mirror the Python dataclasses in python-archive/lib/search.py.
 * Anything serialized to JSON by /api/search must be representable here.
 */

export type Cabin = "economy" | "premium-economy" | "business" | "first";
export type TripType = "round-trip" | "one-way";

/** Verdict from the forecast engine. */
export type ForecastVerdict =
  | "best"      // current is at or near the 60-day floor — book confidently
  | "good"      // current is in the bottom quartile of the 60-day range — fair deal
  | "typical"   // current is in the middle of the range — no strong signal
  | "shift"     // a nearby date is materially cheaper — wait and shift dates
  | "high";     // current is above typical / in the top quartile — wait

/** Price forecast attached to the cheapest offer per card. */
export interface PriceForecast {
  verdict: ForecastVerdict;
  /** One-sentence human-readable summary, e.g. "Among the cheapest 20% — book." */
  headline: string;
  /** Optional second line with concrete action, e.g. "Shift to Aug 28 to save $109". */
  detail: string | null;

  /** Google's "typical price" for this route + season (from GetShoppingResults [5][2]). */
  typicalPrice: number | null;
  /** typical − current. Positive = below typical (good); negative = above typical. */
  priceDelta: number | null;

  /** Cheapest nearby option within the 60-day calendar window. */
  nearbyMin: { departDate: string; returnDate: string | null; price: number; daysFromBaseline: number } | null;
  /** Where this price sits in the 60-day distribution (0 = absolute min, 1 = max). */
  percentile: number | null;

  /** Days until departure, used for urgency in the verdict. */
  daysUntilDepart: number;
}

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
  /** Google's "typical historical price" for this route+season. Set when Google
   *  exposed it in section [5][2]; null for cache hits saved before this was added. */
  typicalPrice?: number | null;
  /** typical − current. Positive ⇒ current is below typical (good deal). */
  priceDelta?: number | null;
  /** Rich forecast verdict — attached only to the "best" offer per card to avoid
   *  one extra GetCalendarGraph call per alternate. */
  forecast?: PriceForecast;
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
