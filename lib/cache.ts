/**
 * Cache with TTL — Upstash Redis if configured, in-memory otherwise.
 *
 * In-memory only works within a single serverless invocation, so for production
 * Vercel deploys the user should set UPSTASH_REDIS_REST_URL + _TOKEN.
 * For localhost dev the in-memory fallback is fine (server stays running).
 */

import { Redis } from "@upstash/redis";

const DEFAULT_TTL_SEC = 6 * 60 * 60; // 6 hours

const _memCache = new Map<string, { value: unknown; expiresAt: number }>();

function getRedis(): Redis | null {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return null;
  return new Redis({ url, token });
}

async function cacheGet<T>(key: string): Promise<T | null> {
  const redis = getRedis();
  if (redis) {
    try {
      const v = await redis.get<T>(key);
      return v ?? null;
    } catch (e) {
      console.warn("Redis get failed:", e);
      return null;
    }
  }
  const entry = _memCache.get(key);
  if (!entry) return null;
  if (entry.expiresAt < Date.now()) {
    _memCache.delete(key);
    return null;
  }
  return entry.value as T;
}

async function cacheSet<T>(key: string, value: T, ttlSec: number): Promise<void> {
  const redis = getRedis();
  if (redis) {
    try {
      await redis.set(key, value, { ex: ttlSec });
    } catch (e) {
      console.warn("Redis set failed:", e);
    }
    return;
  }
  _memCache.set(key, { value, expiresAt: Date.now() + ttlSec * 1000 });
}

// ---------- typed helpers ----------

import type { Offer, ParsedQuery } from "./types";

const searchKey = (
  origin: string,
  dest: string,
  depart: string,
  ret: string | null,
  cabin: string,
  pax: number,
): string => `s:${origin}:${dest}:${depart}:${ret ?? ""}:${cabin}:${pax}`;

export async function getCachedSearch(
  origin: string,
  dest: string,
  depart: string,
  ret: string | null,
  cabin: string,
  pax: number,
): Promise<Offer | null> {
  return cacheGet<Offer>(searchKey(origin, dest, depart, ret, cabin, pax));
}

export async function setCachedSearch(
  origin: string,
  dest: string,
  depart: string,
  ret: string | null,
  cabin: string,
  pax: number,
  offer: Offer,
  ttlSec: number = DEFAULT_TTL_SEC,
): Promise<void> {
  await cacheSet(searchKey(origin, dest, depart, ret, cabin, pax), offer, ttlSec);
}

export async function getCachedParse(query: string): Promise<ParsedQuery | null> {
  return cacheGet<ParsedQuery>(`p:${query.trim().toLowerCase()}`);
}

export async function setCachedParse(query: string, parsed: ParsedQuery): Promise<void> {
  // Parse cache never expires — same query always parses the same way.
  await cacheSet(`p:${query.trim().toLowerCase()}`, parsed, 60 * 60 * 24 * 30);
}

/** Generic typed get/set for module-specific caches (e.g. calendar-graph). */
export async function getCachedGeneric<T>(key: string): Promise<T | null> {
  return cacheGet<T>(key);
}

export async function setCachedGeneric<T>(
  key: string,
  value: T,
  ttlSec: number = DEFAULT_TTL_SEC,
): Promise<void> {
  await cacheSet(key, value, ttlSec);
}
