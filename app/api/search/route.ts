/**
 * POST /api/search
 *
 * Body: { query: string, defaultOrigin?: string, filters?: Filters }
 *
 * Pipeline:
 *   1. parser.parseQuery(query) → ParsedQuery
 *   2. resolveOrigin(parsed.origin) → IATA
 *   3. search.search(...) → { cards, stats }
 *   4. Return { parsed, cards, stats }
 *
 * One endpoint instead of separate /parse + /search to keep the round-trips
 * down — the parser only runs once per query thanks to the cache layer.
 *
 * Runtime: Node (not Edge) because the search fan-out makes many outbound
 * fetches that can take 30-90s. Edge has a 25s hard limit.
 */

import { NextRequest, NextResponse } from "next/server";
import { resolveOrigin } from "@/lib/destinations";
import { parseQuery } from "@/lib/parser";
import { search } from "@/lib/search";
import type { Filters, SearchResponse } from "@/lib/types";

export const runtime = "nodejs";
export const maxDuration = 300; // 5 min — Vercel hobby tier max

interface RequestBody {
  query: string;
  defaultOrigin?: string;
  filters?: Filters;
}

export async function POST(req: NextRequest) {
  let body: RequestBody;
  try {
    body = (await req.json()) as RequestBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (!body.query?.trim()) {
    return NextResponse.json({ error: "Missing query" }, { status: 400 });
  }
  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json(
      { error: "Server is missing ANTHROPIC_API_KEY" },
      { status: 500 },
    );
  }

  const parsed = await parseQuery(body.query, body.defaultOrigin ?? null);

  const originIata = resolveOrigin(parsed.origin);
  if (!originIata) {
    return NextResponse.json(
      {
        error: `Unknown origin: ${parsed.origin}. Add it to lib/destinations.ts.`,
        parsed,
      },
      { status: 400 },
    );
  }

  const { cards, stats } = await search({
    originIata,
    destinationNames: parsed.destinations,
    departDates: parsed.departDates,
    returnDates: parsed.returnDates,
    cabin: parsed.cabin,
    adults: parsed.pax,
    filters: body.filters,
  });

  const response: SearchResponse = { parsed, cards, stats };
  return NextResponse.json(response);
}
