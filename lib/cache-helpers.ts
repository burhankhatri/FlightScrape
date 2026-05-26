/**
 * Low-level cache helpers used by images.ts and any future caller that needs
 * generic key/value storage. Keeps cache.ts focused on typed search/parse helpers.
 */

import { Redis } from "@upstash/redis";

const _mem = new Map<string, { value: unknown; expiresAt: number }>();

function getRedis(): Redis | null {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return null;
  return new Redis({ url, token });
}

export async function cacheGet<T>(key: string): Promise<T | null> {
  const redis = getRedis();
  if (redis) {
    try {
      const v = await redis.get<T>(key);
      return v ?? null;
    } catch {
      return null;
    }
  }
  const entry = _mem.get(key);
  if (!entry || entry.expiresAt < Date.now()) {
    if (entry) _mem.delete(key);
    return null;
  }
  return entry.value as T;
}

export async function cacheSet<T>(key: string, value: T, ttlSec: number): Promise<void> {
  const redis = getRedis();
  if (redis) {
    try {
      await redis.set(key, value, { ex: ttlSec });
    } catch {
      /* ignore */
    }
    return;
  }
  _mem.set(key, { value, expiresAt: Date.now() + ttlSec * 1000 });
}
