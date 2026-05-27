/**
 * Forecast engine — combines Google's three free price signals into one
 * confident "book / wait / shift" verdict per offer.
 *
 * Inputs we have for free, every search:
 *   1. `current` — the cheapest price for the exact dates the user asked for.
 *   2. `typical` — Google's "typical historical price" benchmark for this
 *      route+season (from GetShoppingResults section [5][2]).
 *   3. `nearby` — 60+ (date, price) tuples for the same trip length in a
 *      ±7/+60 day window (from GetCalendarGraph).
 *   4. `daysUntilDepart` — derived from departDate.
 *
 * The output is a 5-class verdict with a one-sentence headline and an optional
 * second-line "do this" action. Designed so the user can read it in one glance
 * and trust it — every claim is grounded in the underlying numbers, no LLM
 * fluff.
 */

import type { ForecastVerdict, PriceForecast } from "./types";

export interface NearbyDatePrice {
  departDate: string;
  returnDate: string | null;
  price: number;
}

export interface ForecastInput {
  currentPrice: number;
  departDate: string;
  returnDate: string | null;
  typicalPrice: number | null;
  /** Cheapest other (depart, return) pair from the calendar graph, sorted by price asc. */
  nearby: NearbyDatePrice[] | null;
  /** "today" override for deterministic testing; defaults to actual today. */
  today?: string;
}

const HIGH_THRESHOLD_PCT = 0.12;   // current ≥ typical × 1.12 ⇒ above-typical territory
const GOOD_THRESHOLD_PCT = 0.08;   // current ≤ typical × 0.92 ⇒ below-typical territory
const SHIFT_MIN_SAVINGS = 30;      // dollars — minimum nearby saving worth recommending
const SHIFT_MIN_SAVINGS_PCT = 0.07;// nearby must be ≥7% cheaper to bother
const URGENT_DAYS = 14;            // <14 days out ⇒ prices usually only rise from here

function nightsBetween(a: string, b: string): number {
  const ta = Date.UTC(+a.slice(0, 4), +a.slice(5, 7) - 1, +a.slice(8, 10));
  const tb = Date.UTC(+b.slice(0, 4), +b.slice(5, 7) - 1, +b.slice(8, 10));
  return Math.round((tb - ta) / 86_400_000);
}

function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

function fmtPrice(n: number): string {
  return `$${Math.round(n)}`;
}

function fmtShortDate(iso: string): string {
  const d = new Date(iso + "T00:00:00Z");
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
}

/**
 * Compute the forecast verdict.
 *
 * Decision order (first match wins, by user intent):
 *   1. Current is at or near the 60-day floor (≤ min × 1.03)            → "best"
 *      — even if a slightly-cheaper-still option exists, this IS the floor.
 *   2. Current is in the bottom quartile (percentile ≤ 0.25)
 *      OR ≥ GOOD_THRESHOLD_PCT below typical                              → "good"
 *      — already a strong deal; the nearbyMin is shown as a hint, not the verdict.
 *   3. Nearby shift saves ≥ MIN_SAVINGS AND ≥ 7% AND user has time       → "shift"
 *      — only when the user isn't already getting a great price.
 *   4. Above typical by ≥ HIGH_THRESHOLD_PCT                              → "high"
 *   5. Else                                                                → "typical"
 *
 * The key reorder vs the first draft: "best" and "good" come before "shift".
 * If you're already in the cheapest 25% of fares, telling you to wait would be
 * misleading even when an absolutely-cheaper alternative exists in the window.
 */
export function computeForecast(input: ForecastInput): PriceForecast {
  const { currentPrice, departDate, typicalPrice } = input;
  const today = input.today ?? todayISO();
  const daysUntilDepart = Math.max(0, nightsBetween(today, departDate));

  // ---- compute nearby stats ----
  const nearby = (input.nearby ?? [])
    .filter((p) => p.price > 0 && p.departDate !== departDate)
    .slice()
    .sort((a, b) => a.price - b.price);

  let percentile: number | null = null;
  let nearbyMin: PriceForecast["nearbyMin"] = null;

  if (nearby.length > 0) {
    // Build the full distribution including the user's current pick.
    const allPrices = [currentPrice, ...nearby.map((p) => p.price)].sort((a, b) => a - b);
    const rank = allPrices.findIndex((p) => p >= currentPrice);
    percentile = rank / Math.max(1, allPrices.length - 1);

    const cheapest = nearby[0];
    if (cheapest.price < currentPrice) {
      const saves = currentPrice - cheapest.price;
      const savesPct = saves / currentPrice;
      if (saves >= SHIFT_MIN_SAVINGS && savesPct >= SHIFT_MIN_SAVINGS_PCT) {
        nearbyMin = {
          departDate: cheapest.departDate,
          returnDate: cheapest.returnDate,
          price: cheapest.price,
          daysFromBaseline: Math.abs(nightsBetween(departDate, cheapest.departDate)),
        };
      }
    }
  }

  // ---- compute typical-price delta ----
  const priceDelta = typicalPrice !== null ? typicalPrice - currentPrice : null;
  const deltaPct =
    typicalPrice && typicalPrice > 0 ? (typicalPrice - currentPrice) / typicalPrice : null;

  const nearbyHint = (): string | null => {
    if (!nearbyMin) return null;
    const saved = currentPrice - nearbyMin.price;
    return `Cheapest nearby is ${fmtPrice(nearbyMin.price)} on ${fmtShortDate(nearbyMin.departDate)}${nearbyMin.returnDate ? ` → ${fmtShortDate(nearbyMin.returnDate)}` : ""} (saves ${fmtPrice(saved)}).`;
  };

  // ---- decide verdict ----
  let verdict: ForecastVerdict;
  let headline: string;
  let detail: string | null = null;

  if (nearby.length > 0 && currentPrice <= nearby[0].price * 1.03) {
    // Within 3% of the 60-day floor — basically the best you'll see.
    verdict = "best";
    headline = "Cheapest price in 60 days — book now.";
    if (typicalPrice && deltaPct && deltaPct > 0.05) {
      detail = `${fmtPrice(typicalPrice - currentPrice)} below typical for this route.`;
    }
  } else if (
    (deltaPct !== null && deltaPct >= GOOD_THRESHOLD_PCT) ||
    (percentile !== null && percentile <= 0.25)
  ) {
    verdict = "good";
    if (percentile !== null && percentile <= 0.15) {
      headline = `Great price — cheaper than ${Math.round((1 - percentile) * 100)}% of nearby dates.`;
    } else if (deltaPct !== null && deltaPct >= GOOD_THRESHOLD_PCT) {
      headline = `Good price — ${fmtPrice(typicalPrice! - currentPrice)} below typical for this route.`;
    } else {
      headline = `Good price — among the cheapest 25% in the next 60 days.`;
    }
    // Surface the absolute nearby min as a hint, but don't say "wait".
    detail = nearbyHint();
  } else if (nearbyMin) {
    // Not in bottom quartile, but nearby has materially cheaper option.
    verdict = "shift";
    const saved = currentPrice - nearbyMin.price;
    headline = `Wait — shift dates to save ${fmtPrice(saved)}.`;
    detail = `Cheapest nearby is ${fmtPrice(nearbyMin.price)} on ${fmtShortDate(nearbyMin.departDate)}${nearbyMin.returnDate ? ` → ${fmtShortDate(nearbyMin.returnDate)}` : ""}.`;
  } else if (deltaPct !== null && deltaPct <= -HIGH_THRESHOLD_PCT) {
    verdict = "high";
    headline = `Above typical — ${fmtPrice(currentPrice - typicalPrice!)} more than usual for this route.`;
    if (daysUntilDepart > URGENT_DAYS) {
      detail = "If your dates are flexible, watching for a drop is reasonable.";
    } else {
      detail = `Departure is ${daysUntilDepart} day${daysUntilDepart === 1 ? "" : "s"} out — prices usually only rise from here.`;
    }
  } else {
    verdict = "typical";
    if (typicalPrice && Math.abs(deltaPct ?? 0) < 0.05) {
      headline = `Typical price for this route — no strong signal either way.`;
    } else {
      headline = `Typical price — book if the dates work for you.`;
    }
  }

  // Override: <14 days out, never recommend "wait" unless nearby saving is huge.
  if (verdict === "high" && daysUntilDepart <= URGENT_DAYS && !nearbyMin) {
    verdict = "typical";
    headline = `Departure is in ${daysUntilDepart} day${daysUntilDepart === 1 ? "" : "s"} — prices typically rise from here, so book if you're going.`;
    detail = typicalPrice ? `(${fmtPrice(currentPrice - typicalPrice)} above typical, but waiting risks a bigger increase.)` : null;
  }

  return {
    verdict,
    headline,
    detail,
    typicalPrice: typicalPrice ?? null,
    priceDelta: priceDelta,
    nearbyMin,
    percentile,
    daysUntilDepart,
  };
}
