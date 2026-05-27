/**
 * POST /api/search/stream — NDJSON stream with live progress + partial cards.
 */

import { NextRequest, NextResponse } from "next/server";
import { resolveOrigin } from "@/lib/destinations";
import { parseQuery } from "@/lib/parser";
import { search } from "@/lib/search";
import type { SearchStreamEvent } from "@/lib/search-events";
import type { Filters } from "@/lib/types";

export const runtime = "nodejs";
export const maxDuration = 300;

interface RequestBody {
  query: string;
  defaultOrigin?: string;
  filters?: Filters;
}

function ndjsonLine(event: SearchStreamEvent): string {
  return JSON.stringify(event) + "\n";
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

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const send = (event: SearchStreamEvent) => {
        controller.enqueue(encoder.encode(ndjsonLine(event)));
      };

      try {
        send({ type: "status", message: "Understanding your trip…", phase: "parse" });

        const parsed = await parseQuery(body.query, body.defaultOrigin ?? null);
        const originIata = resolveOrigin(parsed.origin);
        if (!originIata) {
          send({
            type: "error",
            error: `Unknown origin: ${parsed.origin}. Mention a city in your search (e.g. "from Karachi").`,
          });
          controller.close();
          return;
        }

        send({
          type: "parsed",
          parsed,
          originIata,
          destinations: parsed.destinations,
          totalCombos: 0,
        });

        send({
          type: "status",
          message: `Searching ${parsed.destinations.join(", ")}…`,
          phase: "search",
        });

        const { stats } = await search(
          {
            originIata,
            destinationNames: parsed.destinations,
            departDates: parsed.departDates,
            returnDates: parsed.returnDates,
            cabin: parsed.cabin,
            adults: parsed.pax,
            filters: body.filters,
          },
          {
            onStatus: (message, phase) => send({ type: "status", message, phase }),
            onProgress: (checked, total, succeeded, label) =>
              send({
                type: "progress",
                checked,
                total,
                succeeded,
                label,
              }),
            onCard: (card) => send({ type: "card", card }),
            onCardImage: (destLabel, imageUrl) =>
              send({ type: "card-image", destLabel, imageUrl }),
            onCardForecast: (destLabel, forecast) =>
              send({ type: "card-forecast", destLabel, forecast }),
          },
        );

        send({ type: "done", parsed, stats });
      } catch (e) {
        send({
          type: "error",
          error: e instanceof Error ? e.message : "Search failed",
        });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "application/x-ndjson",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}
