/**
 * Build Google Flights URLs pre-filled with the user's search.
 *
 * Reuses lib/tfs.ts (the protobuf builder). The `?q=...` natural-language URL
 * just lands on Google's homepage — only `?tfs=...` opens the actual search
 * results. Same conclusion as python-archive/lib/deeplink.py.
 */

import { buildGoogleFlightsUrl } from "./tfs";
import type { Cabin } from "./types";

export function bookingUrl(args: {
  origin: string;
  dest: string;
  depart: string;
  return?: string | null;
  adults?: number;
  cabin?: Cabin;
}): string {
  const adults = args.adults ?? 1;
  const cabin = args.cabin ?? "economy";
  const legs = [{ date: args.depart, fromIata: args.origin, toIata: args.dest }];
  if (args.return) {
    legs.push({ date: args.return, fromIata: args.dest, toIata: args.origin });
  }
  return buildGoogleFlightsUrl(
    {
      legs,
      trip: args.return ? "round-trip" : "one-way",
      cabin,
      adults,
    },
    "USD",
  );
}
