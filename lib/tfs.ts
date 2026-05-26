/**
 * Build the `?tfs=...` URL parameter Google Flights expects.
 *
 * Reverse-engineered from python-archive/.venv/.../fast_flights/flights_pb2.py.
 * Decoded proto schema (proto3):
 *
 *   message Airport    { string airport = 2; }
 *   message FlightData {
 *     string date = 2;
 *     Airport from_flight = 13;
 *     Airport to_flight = 14;
 *     optional int32 max_stops = 5;
 *   }
 *   message Info {
 *     repeated FlightData data = 3;
 *     Seat seat = 9;
 *     repeated Passenger passengers = 8;   // packed
 *     Trip trip = 19;
 *   }
 *   enum Seat      { UNKNOWN=0, ECONOMY=1, PREMIUM_ECONOMY=2, BUSINESS=3, FIRST=4 }
 *   enum Trip      { UNKNOWN=0, ROUND_TRIP=1, ONE_WAY=2, MULTI_CITY=3 }
 *   enum Passenger { UNKNOWN=0, ADULT=1, CHILD=2, INFANT_IN_SEAT=3, INFANT_ON_LAP=4 }
 *
 * We hand-encode protobuf wire format directly (no `protobufjs` runtime) since
 * the message is tiny and we want zero bundle cost. Each field is:
 *   varint( (field_number << 3) | wire_type )  +  value
 * Wire type 0 = varint (int/enum). Wire type 2 = length-delimited (string/embedded).
 *
 * Validated by comparing output against fast-flights' base64 output for the
 * same KHI→KUL round-trip search — they match byte-for-byte.
 */

import type { Cabin, TripType } from "./types";

// ---------- enum mappings ----------

const SEAT_ENUM: Record<Cabin, number> = {
  economy: 1,
  "premium-economy": 2,
  business: 3,
  first: 4,
};

const TRIP_ENUM: Record<TripType | "multi-city", number> = {
  "round-trip": 1,
  "one-way": 2,
  "multi-city": 3,
};

const PASSENGER_ADULT = 1;
// CHILD=2, INFANT_IN_SEAT=3, INFANT_ON_LAP=4 — not used in this codebase yet.

// ---------- wire-format primitives ----------

function varint(n: number): Uint8Array {
  const out: number[] = [];
  let v = n >>> 0;
  while (v > 0x7f) {
    out.push((v & 0x7f) | 0x80);
    v >>>= 7;
  }
  out.push(v & 0x7f);
  return new Uint8Array(out);
}

function tag(fieldNumber: number, wireType: number): Uint8Array {
  return varint((fieldNumber << 3) | wireType);
}

function concat(...parts: Uint8Array[]): Uint8Array {
  let total = 0;
  for (const p of parts) total += p.length;
  const out = new Uint8Array(total);
  let off = 0;
  for (const p of parts) {
    out.set(p, off);
    off += p.length;
  }
  return out;
}

function encodeString(fieldNumber: number, s: string): Uint8Array {
  const bytes = new TextEncoder().encode(s);
  return concat(tag(fieldNumber, 2), varint(bytes.length), bytes);
}

function encodeVarintField(fieldNumber: number, value: number): Uint8Array {
  return concat(tag(fieldNumber, 0), varint(value));
}

function encodeMessageField(fieldNumber: number, body: Uint8Array): Uint8Array {
  return concat(tag(fieldNumber, 2), varint(body.length), body);
}

/** Encode a packed repeated varint (proto3 default for repeated enums/ints). */
function encodePackedVarintField(fieldNumber: number, values: number[]): Uint8Array {
  if (values.length === 0) return new Uint8Array();
  const valuesBytes = concat(...values.map((v) => varint(v)));
  return concat(tag(fieldNumber, 2), varint(valuesBytes.length), valuesBytes);
}

// ---------- message builders ----------

function buildAirport(iata: string): Uint8Array {
  return encodeString(2, iata);
}

function buildFlightData(
  date: string,
  fromIata: string,
  toIata: string,
  maxStops: number | null,
): Uint8Array {
  const parts: Uint8Array[] = [];
  parts.push(encodeString(2, date));
  parts.push(encodeMessageField(13, buildAirport(fromIata)));
  parts.push(encodeMessageField(14, buildAirport(toIata)));
  if (maxStops !== null) parts.push(encodeVarintField(5, maxStops));
  return concat(...parts);
}

interface FlightLeg {
  date: string;
  fromIata: string;
  toIata: string;
}

export interface BuildTfsArgs {
  legs: FlightLeg[];
  trip: TripType;
  cabin: Cabin;
  adults: number;
  maxStops?: number | null;
}

function buildInfo({ legs, trip, cabin, adults, maxStops = null }: BuildTfsArgs): Uint8Array {
  const parts: Uint8Array[] = [];

  // repeated FlightData data = 3;
  for (const leg of legs) {
    parts.push(
      encodeMessageField(3, buildFlightData(leg.date, leg.fromIata, leg.toIata, maxStops)),
    );
  }

  // repeated Passenger passengers = 8 (packed).
  const passengers = Array(adults).fill(PASSENGER_ADULT);
  parts.push(encodePackedVarintField(8, passengers));

  // Seat seat = 9.
  parts.push(encodeVarintField(9, SEAT_ENUM[cabin]));

  // Trip trip = 19.
  parts.push(encodeVarintField(19, TRIP_ENUM[trip]));

  return concat(...parts);
}

// ---------- base64 encoding ----------

function uint8ToBase64(bytes: Uint8Array): string {
  if (typeof Buffer !== "undefined") return Buffer.from(bytes).toString("base64");
  // Browser fallback (we only run this server-side, but be safe).
  let binary = "";
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary);
}

/** Build the base64-encoded tfs string for Google Flights. */
export function buildTfs(args: BuildTfsArgs): string {
  const info = buildInfo(args);
  return uint8ToBase64(info);
}

/** Build the full Google Flights URL. */
export function buildGoogleFlightsUrl(args: BuildTfsArgs, currency = "USD"): string {
  const tfs = buildTfs(args);
  // tfu = EgQIABABIgA — fast-flights passes this; appears to be a constant client signal.
  const params = new URLSearchParams({
    tfs,
    hl: "en",
    tfu: "EgQIABABIgA",
    curr: currency,
  });
  return `https://www.google.com/travel/flights?${params.toString()}`;
}
