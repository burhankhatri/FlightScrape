/**
 * Natural-language query → structured search params via Claude Haiku (tool_use).
 *
 * Direct port of python-archive/lib/parser.py — same SYSTEM_PROMPT, same tool
 * schema, just with the @anthropic-ai/sdk JS SDK. Schema-validated by the API
 * itself, so the model literally can't return malformed JSON.
 */

import Anthropic from "@anthropic-ai/sdk";
import type { ParsedQuery } from "./types";
import { getCachedParse, setCachedParse } from "./cache";

const MODEL = "claude-haiku-4-5";

const TOOL_DEFINITION = {
  name: "submit_flight_search",
  description:
    "Submit the parsed parameters of a flight search. Always call this tool to return your answer — do not write prose.",
  input_schema: {
    type: "object" as const,
    properties: {
      origin: {
        type: ["string", "null"],
        description:
          "The departure place name as the user stated it (country, city, or IATA code). Null if the user did not specify.",
      },
      destinations: {
        type: "array",
        items: { type: "string" },
        minItems: 1,
        description:
          "One or more destinations the user mentioned, each a country/city/IATA. Preserve country names when the user said a country, city names when they said a city.",
      },
      depart_dates: {
        type: "array",
        items: { type: "string", pattern: "^\\d{4}-\\d{2}-\\d{2}$" },
        minItems: 1,
        maxItems: 14,
        description:
          "Departure dates to try, in YYYY-MM-DD. Goal: find the ACTUAL cheapest, which often hides between coarse samples.\n" +
          "  • Specific date ('25th July') → 1 date\n" +
          "  • A specific month or named window ('in July', 'mid August') → 14 dates, EVERY OTHER DAY across the window (e.g. for July: Jul 1, 3, 5, 7, 9, 11, 13, 15, 17, 19, 21, 23, 25, 27). Using stride 2 (not 3) matters — coarser sampling missed the 22%-cheaper deal on Jul 23 in our benchmark.\n" +
          "  • Multi-month or vague ('summer', 'next 3 months') → 12-14 dates spread roughly evenly\n" +
          "  • Half-month ('first two weeks of July') → ~8 dates every day or every other day across that window\n" +
          "Use 14 samples whenever the user gives ANY flexibility. Failed/timed-out queries are common, so dense sampling is redundancy not waste.",
      },
      return_dates: {
        type: ["array", "null"],
        items: { type: "string", pattern: "^\\d{4}-\\d{2}-\\d{2}$" },
        description:
          "Return dates parallel to depart_dates (same length).\n" +
          "  • '2 weeks' / 'for 14 days' (strict) → return = depart + 14\n" +
          "  • 'around 2 weeks' / 'roughly' / 'not strict' / 'minimum 2 weeks' / 'about a fortnight' → vary the duration explicitly: split the entries across +13, +14, and +15 days. For 14 departs, do 5x+14, 5x+13, 4x+15 (or similar). NEVER return all the same duration when the user signaled flexibility.\n" +
          "  • For 'minimum N days' bias toward N and N+1 (not N-1)\n" +
          "  • Specific return ('returning Aug 25') with one depart → exactly that date\n" +
          "  • Specific return with multiple flex departs → repeat the same return for every entry",
      },
      pax: {
        type: "integer",
        minimum: 1,
        maximum: 9,
        description: "Number of adult passengers. Default 1.",
      },
      cabin: {
        type: "string",
        enum: ["economy", "premium-economy", "business", "first"],
        description: "Cabin class. Default 'economy'.",
      },
      trip_type: {
        type: "string",
        enum: ["round-trip", "one-way"],
        description:
          "round-trip if user mentioned returning, coming back, or gave two dates / a duration. one-way otherwise.",
      },
    },
    required: [
      "origin",
      "destinations",
      "depart_dates",
      "return_dates",
      "pax",
      "cabin",
      "trip_type",
    ],
  },
};

const SYSTEM_PROMPT = `You parse flight search queries.

Always respond by calling the submit_flight_search tool. Never write prose.

Be tolerant of typos: "philliiphense"→"Philippines", "thialand"→"Thailand", "kualal umpur"→"Kuala Lumpur".

Date handling:
- "25th July" with today's year — use this year if the date is still in the future, else next year.
- "next month" — pick mid-month of the next calendar month (e.g. 15th).
- "in July" / "during July" — produce 14 evenly-spaced depart dates across that month, every other day.
- "for 2 weeks" / "10-day trip" — return_dates = depart_dates + the duration.
- "returning Aug 25" with multiple depart options — set every return_date to Aug 25.
- If no return language and no duration is given, set trip_type="one-way" and return_dates=null.

ABSOLUTE RULES for return_dates (these are not negotiable):
1. return_dates[i] MUST be strictly LATER than depart_dates[i]. Never the same day, never earlier. A return before the depart is impossible.
2. return_dates length MUST equal depart_dates length.
3. If you find yourself about to emit a return earlier than the corresponding depart, you have made an error — recompute by adding the intended duration in days to the depart date.

Minimum/at-least durations:
- "at least N days", "minimum N days", "no less than N days", "≥N days", "N+ days" → every (depart, return) pair MUST satisfy return ≥ depart + N nights. Sample durations of N, N+1, N+2, N+3, N+5, N+7 — weighted toward the lower end. NEVER return a duration less than N. This is the most common bug; double-check before submitting.
- "around N days", "about N days", "roughly N days" → split across N-1, N, N+1, N+2.
- "exactly N days", "strictly N days" → all pairs use exactly N.
- "any N days/weeks", "any N-week trip" → exactly N (the "any" modifies the start date, not the length).

Window constraints — "between A and B", "from A to B", "A to B" with explicit dates:
- BOTH depart_dates[i] AND return_dates[i] MUST fall within [A, B] for every i.
- If a duration is also given (e.g. "any 2 weeks between July 15 and Aug 15"), depart_dates[i] MUST be ≤ B − duration so the return still fits inside B.
- Sample depart dates evenly across [A, B − duration], not [A, B]. Going past B − duration produces returns outside the user's window.

Origin handling:
- If the user said "from X" or "leaving from X", set origin to X.
- Otherwise origin=null. The caller will fill in a default.

Destinations:
- Keep the granularity the user used. "Japan" stays "Japan" (country), "Tokyo" stays "Tokyo" (city).
- Always include every destination the user mentioned, in order.`;

export async function parseQuery(
  query: string,
  defaultOrigin: string | null = null,
): Promise<ParsedQuery> {
  const cached = await getCachedParse(query);
  let parsed: ParsedQuery;
  if (cached) {
    parsed = cached;
  } else {
    parsed = await callClaude(query);
    await setCachedParse(query, parsed);
  }

  if (!parsed.origin && defaultOrigin) {
    parsed = { ...parsed, origin: defaultOrigin };
  }

  parsed = repairDates(parsed, query);

  return parsed;
}

// ----- Date-pair defense ---------------------------------------------------

function parseISO(iso: string): number {
  return Date.UTC(
    parseInt(iso.slice(0, 4), 10),
    parseInt(iso.slice(5, 7), 10) - 1,
    parseInt(iso.slice(8, 10), 10),
  );
}

function addDaysISO(iso: string, days: number): string {
  const t = parseISO(iso) + days * 86_400_000;
  return new Date(t).toISOString().slice(0, 10);
}

function nightsBetween(depart: string, ret: string): number {
  return Math.round((parseISO(ret) - parseISO(depart)) / 86_400_000);
}

const TODAY_ISO = () => new Date().toISOString().slice(0, 10);

const WORD_NUMBERS: Record<string, number> = {
  one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7,
  eight: 8, nine: 9, ten: 10, eleven: 11, twelve: 12, thirteen: 13, fourteen: 14,
};

/**
 * Replace spelled-out numbers ("two weeks") with digits ("2 weeks") so the
 * downstream regexes can stay simple. Only touches words that appear next to a
 * duration unit (day/week/night) or after a duration keyword ("any", "for",
 * "at least", ...) so we don't mangle phrases like "one-way".
 */
function normalizeQueryForDuration(query: string): string {
  let q = query.toLowerCase();
  const wordsAlt = Object.keys(WORD_NUMBERS).join("|");
  q = q.replace(
    new RegExp(`\\b(${wordsAlt})\\s+(days?|nights?|weeks?|wks?)\\b`, "g"),
    (_, w: string, unit: string) => `${WORD_NUMBERS[w]} ${unit}`,
  );
  q = q.replace(
    new RegExp(`\\b(any|for|at\\s*least|minimum|min|exactly|strictly|about|around|roughly)\\s+(${wordsAlt})\\b`, "g"),
    (_, kw: string, w: string) => `${kw} ${WORD_NUMBERS[w]}`,
  );
  return q;
}

/**
 * Parse a duration intent from the raw user query. Returns the minimum number
 * of nights the user is willing to accept (or null if the query is silent on
 * duration). Used to fix up LLM outputs that violate the constraint.
 */
function inferMinNights(query: string): {
  min: number | null;
  exact: number | null;
} {
  const q = normalizeQueryForDuration(query);
  // Order matters: "at least 14 days" must match before plain "14 days".
  const minPatterns: Array<[RegExp, (m: RegExpMatchArray) => number]> = [
    [/(?:at\s*least|minimum|min\.?|no\s*less\s*than|>=|≥)\s*(\d+)\s*\+?\s*(?:days?|nights?|d\b)/, (m) => parseInt(m[1], 10)],
    [/(\d+)\s*\+\s*(?:days?|nights?)/, (m) => parseInt(m[1], 10)],
    [/(?:at\s*least|minimum)\s*(\d+)\s*(?:weeks?|wks?)/, (m) => parseInt(m[1], 10) * 7],
  ];
  for (const [re, get] of minPatterns) {
    const m = q.match(re);
    if (m) return { min: get(m), exact: null };
  }
  const exactPatterns: Array<[RegExp, (m: RegExpMatchArray) => number]> = [
    [/(?:exactly|strictly|precisely|any)\s*(\d+)\s*(?:days?|nights?)/, (m) => parseInt(m[1], 10)],
    [/(?:exactly|strictly|precisely|any)\s*(\d+)\s*(?:weeks?|wks?)/, (m) => parseInt(m[1], 10) * 7],
    [/for\s*(\d+)\s*(?:days?|nights?)\b/, (m) => parseInt(m[1], 10)],
    [/(\d+)[-\s]*(?:day|night)\s*trip/, (m) => parseInt(m[1], 10)],
    [/for\s*(\d+)\s*weeks?/, (m) => parseInt(m[1], 10) * 7],
    [/(\d+)[-\s]*week\s*trip/, (m) => parseInt(m[1], 10) * 7],
  ];
  for (const [re, get] of exactPatterns) {
    const m = q.match(re);
    if (m) return { min: null, exact: get(m) };
  }
  return { min: null, exact: null };
}

// ----- Window parsing ("between Jul 15 and Aug 15") -----------------------

const MONTH_NAMES: Record<string, number> = {
  jan: 1, january: 1, feb: 2, february: 2, mar: 3, march: 3, apr: 4, april: 4,
  may: 5, jun: 6, june: 6, jul: 7, july: 7, aug: 8, august: 8,
  sep: 9, sept: 9, september: 9, oct: 10, october: 10, nov: 11, november: 11,
  dec: 12, december: 12,
};

function resolveMonthDay(month: number, day: number, today: string): string | null {
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  const yearNow = parseInt(today.slice(0, 4), 10);
  const mm = String(month).padStart(2, "0");
  const dd = String(day).padStart(2, "0");
  const candidate = `${yearNow}-${mm}-${dd}`;
  return candidate >= today ? candidate : `${yearNow + 1}-${mm}-${dd}`;
}

function parseLooseDate(text: string, today: string): string | null {
  const t = text.toLowerCase().trim().replace(/[,.]/g, "");
  if (/^\d{4}-\d{2}-\d{2}$/.test(t)) return t;
  let m = t.match(/^([a-z]+)\s+(\d{1,2})(?:st|nd|rd|th)?$/);
  if (m && MONTH_NAMES[m[1]]) return resolveMonthDay(MONTH_NAMES[m[1]], parseInt(m[2], 10), today);
  m = t.match(/^(\d{1,2})(?:st|nd|rd|th)?\s+(?:of\s+)?([a-z]+)$/);
  if (m && MONTH_NAMES[m[2]]) return resolveMonthDay(MONTH_NAMES[m[2]], parseInt(m[1], 10), today);
  return null;
}

/**
 * Detect a window like "between July 15 and August 15" / "from 1st aug to 1st sep"
 * / "Jul 15 to Aug 15". Returns ISO start+end (both inclusive), or null.
 */
function inferWindow(query: string, today: string): { start: string; end: string } | null {
  const q = query.toLowerCase();
  const datePart =
    String.raw`(?:\d{4}-\d{2}-\d{2}|(?:[a-z]+)\s+\d{1,2}(?:st|nd|rd|th)?|\d{1,2}(?:st|nd|rd|th)?\s+(?:of\s+)?[a-z]+)`;
  const patterns: RegExp[] = [
    new RegExp(`(?:between|from)\\s+(${datePart})\\s+(?:and|to|through|until|till|-)\\s+(${datePart})`),
    new RegExp(`(${datePart})\\s+(?:to|through|until|till|-)\\s+(${datePart})`),
  ];
  for (const re of patterns) {
    const m = q.match(re);
    if (!m) continue;
    const a = parseLooseDate(m[1], today);
    const b = parseLooseDate(m[2], today);
    if (a && b && b > a) return { start: a, end: b };
  }
  return null;
}

/**
 * Validate and repair the LLM's depart/return arrays. LLMs occasionally emit:
 *   - mismatched lengths
 *   - returns earlier than departs (or duplicates of an earlier return)
 *   - returns that violate an "at least N days" constraint from the query
 *
 * Strategy: drop bad pairs, then if too many are gone (or the user signaled a
 * duration), synthesize fresh returns by adding N..N+5 day offsets to the
 * surviving departs. Guarantees a coherent search regardless of LLM weather.
 */
function repairDates(parsed: ParsedQuery, query: string): ParsedQuery {
  let { departDates, returnDates } = parsed;
  if (!departDates || departDates.length === 0) return parsed;

  // Drop depart dates in the past (LLM sometimes picks current-year months
  // that have already passed without rolling to next year).
  const today = TODAY_ISO();
  departDates = departDates.filter((d) => d >= today);
  if (departDates.length === 0) {
    // Fallback: shift everything one year forward.
    departDates = parsed.departDates.map((d) => {
      const y = parseInt(d.slice(0, 4), 10);
      return `${y + 1}${d.slice(4)}`;
    });
  }

  if (parsed.tripType === "one-way" || returnDates === null) {
    return { ...parsed, departDates, returnDates: null };
  }

  const { min, exact } = inferMinNights(query);
  const window = inferWindow(query, today);

  // Window + duration: regenerate from scratch so every pair fits the window.
  // This is the most common bug class — the LLM samples departs to the end of
  // the window then naively adds the duration, pushing returns past the window.
  if (window && (exact !== null || min !== null)) {
    const baseNights = exact ?? min!;
    const winStart = window.start >= today ? window.start : today;
    const latestDepart = addDaysISO(window.end, -baseNights);
    if (latestDepart >= winStart) {
      const totalDays = nightsBetween(winStart, latestDepart);
      const targetSamples = Math.min(14, totalDays + 1);
      const stride =
        targetSamples <= 1 ? 1 : Math.max(1, Math.round(totalDays / (targetSamples - 1)));
      const departSamples: string[] = [];
      for (let d = winStart; d <= latestDepart && departSamples.length < 14; d = addDaysISO(d, stride)) {
        departSamples.push(d);
      }
      // Force-include latestDepart so we don't miss the end of the window.
      if (departSamples[departSamples.length - 1] !== latestDepart && departSamples.length < 14) {
        departSamples.push(latestDepart);
      }
      // Pick a duration per sample. For "exact" use exact. For "min" cycle
      // through min/+1/+3/+7 but clamped so return ≤ window.end.
      const candidateDurations =
        exact !== null ? [exact] : [min!, min! + 1, min! + 3, min! + 7];
      const rebuilt = departSamples.map((d, i) => {
        const maxFromHere = nightsBetween(d, window.end);
        let dur = candidateDurations[i % candidateDurations.length];
        if (dur > maxFromHere) {
          dur = candidateDurations.find((n) => n <= maxFromHere) ?? baseNights;
        }
        return { d, r: addDaysISO(d, dur) };
      });
      return {
        ...parsed,
        departDates: rebuilt.map((p) => p.d),
        returnDates: rebuilt.map((p) => p.r),
      };
    }
    // Window too narrow for the requested duration — fall through.
  }

  // Align lengths conservatively.
  if (returnDates.length !== departDates.length) {
    const n = Math.min(returnDates.length, departDates.length);
    returnDates = returnDates.slice(0, n);
    departDates = departDates.slice(0, n);
  }

  // Validate each pair. Window without duration: clip pairs to window.end.
  const valid: Array<{ d: string; r: string }> = [];
  for (let i = 0; i < departDates.length; i++) {
    const d = departDates[i];
    const r = returnDates[i];
    if (!d || !r || !/^\d{4}-\d{2}-\d{2}$/.test(d) || !/^\d{4}-\d{2}-\d{2}$/.test(r)) {
      continue;
    }
    const nights = nightsBetween(d, r);
    if (nights < 1) continue;
    if (min !== null && nights < min) continue;
    if (exact !== null && nights !== exact) continue;
    if (window && (d < window.start || r > window.end)) continue;
    valid.push({ d, r });
  }

  // If most pairs survived, just keep them.
  const targetCount = parsed.departDates.length || 8;
  if (valid.length >= Math.ceil(targetCount * 0.6)) {
    return {
      ...parsed,
      departDates: valid.map((p) => p.d),
      returnDates: valid.map((p) => p.r),
    };
  }

  // Otherwise rebuild from the surviving depart dates + duration intent.
  // Use the original depart list (already cleaned of past dates) as the base.
  const baseDeparts = departDates;
  const durations =
    exact !== null
      ? [exact]
      : min !== null
        ? [min, min + 1, min + 2, min + 3, min + 5, min + 7]
        : valid.length > 0
          ? [...new Set(valid.map((p) => nightsBetween(p.d, p.r)))]
          : [7, 10, 14]; // last-resort defaults for unspecified durations

  const rebuilt: Array<{ d: string; r: string }> = baseDeparts.map((d, i) => {
    const dur = durations[i % durations.length];
    return { d, r: addDaysISO(d, dur) };
  });

  return {
    ...parsed,
    departDates: rebuilt.map((p) => p.d),
    returnDates: rebuilt.map((p) => p.r),
  };
}

async function callClaude(query: string): Promise<ParsedQuery> {
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  const today = new Date().toISOString().slice(0, 10);
  const userMsg = `Today is ${today}.\n\nQuery: ${query}`;

  const resp = await client.messages.create({
    model: MODEL,
    max_tokens: 1024,
    system: SYSTEM_PROMPT,
    tools: [TOOL_DEFINITION as never],
    tool_choice: { type: "tool", name: "submit_flight_search" },
    messages: [{ role: "user", content: userMsg }],
  });

  for (const block of resp.content) {
    if (block.type === "tool_use" && block.name === "submit_flight_search") {
      const input = block.input as Record<string, unknown>;
      return {
        origin: (input.origin as string | null) ?? null,
        destinations: input.destinations as string[],
        departDates: input.depart_dates as string[],
        returnDates: (input.return_dates as string[] | null) ?? null,
        pax: input.pax as number,
        cabin: input.cabin as ParsedQuery["cabin"],
        tripType: input.trip_type as ParsedQuery["tripType"],
      };
    }
  }
  throw new Error("Claude did not call the submit_flight_search tool");
}
