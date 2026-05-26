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

  // Defend against length-mismatched parallel arrays.
  if (parsed.returnDates && parsed.returnDates.length !== parsed.departDates.length) {
    const n = Math.min(parsed.returnDates.length, parsed.departDates.length);
    parsed = {
      ...parsed,
      departDates: parsed.departDates.slice(0, n),
      returnDates: parsed.returnDates.slice(0, n),
    };
  }

  return parsed;
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
