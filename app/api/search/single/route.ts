/**
 * POST /api/search/single
 *
 * Fetch a single (origin, dest, depart, return) combo on demand — used by the
 * FlightCard's "shift by ±N days" controls so the user can probe nearby dates
 * without re-running the full natural-language search.
 *
 * Body: {
 *   originIata: string;
 *   destIata: string;
 *   departDate: string;            // YYYY-MM-DD
 *   returnDate: string | null;     // YYYY-MM-DD or null for one-way
 *   cabin?: "economy" | "premium-economy" | "business" | "first";
 *   adults?: number;
 * }
 *
 * Returns { offer: Offer | null }.
 */

import { NextRequest, NextResponse } from "next/server";
import { bookingUrl } from "@/lib/deeplink";
import { getAirport } from "@/lib/destinations";
import { lookupPair } from "@/lib/search";
import type { Cabin, Offer } from "@/lib/types";

export const runtime = "nodejs";
export const maxDuration = 30;

interface Body {
  originIata?: string;
  destIata?: string;
  departDate?: string;
  returnDate?: string | null;
  cabin?: Cabin;
  adults?: number;
}

const ISO_RE = /^\d{4}-\d{2}-\d{2}$/;

export async function POST(req: NextRequest) {
  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const originIata = body.originIata?.toUpperCase();
  const destIata = body.destIata?.toUpperCase();
  const departDate = body.departDate;
  const returnDate = body.returnDate ?? null;
  const cabin: Cabin = body.cabin ?? "economy";
  const adults = body.adults ?? 1;

  if (!originIata || !destIata) {
    return NextResponse.json(
      { error: "originIata and destIata are required" },
      { status: 400 },
    );
  }
  if (!getAirport(originIata) || !getAirport(destIata)) {
    return NextResponse.json(
      { error: "Unknown IATA code" },
      { status: 400 },
    );
  }
  if (!departDate || !ISO_RE.test(departDate)) {
    return NextResponse.json(
      { error: "departDate must be YYYY-MM-DD" },
      { status: 400 },
    );
  }
  if (returnDate !== null && !ISO_RE.test(returnDate)) {
    return NextResponse.json(
      { error: "returnDate must be YYYY-MM-DD or null" },
      { status: 400 },
    );
  }
  if (returnDate !== null && returnDate <= departDate) {
    return NextResponse.json(
      { error: "returnDate must be strictly after departDate" },
      { status: 400 },
    );
  }

  const offer = await lookupPair(
    originIata,
    destIata,
    departDate,
    returnDate,
    cabin,
    adults,
  );

  if (!offer) {
    return NextResponse.json({ offer: null });
  }

  const withUrl: Offer = {
    ...offer,
    bookingUrl: bookingUrl({
      origin: originIata,
      dest: destIata,
      depart: departDate,
      return: returnDate,
      adults,
      cabin,
    }),
  };

  return NextResponse.json({ offer: withUrl });
}
