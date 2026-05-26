/**
 * Wikipedia hero image lookup. Free, no auth, decent quality.
 * Caches the resulting URL (not bytes) — landmark photos don't change.
 * Falls back to curated Unsplash URLs when Wikipedia has no image.
 */

import { cacheGet, cacheSet } from "./cache-helpers";

const WIKI_API = "https://en.wikipedia.org/api/rest_v1/page/summary/";
const USER_AGENT = "flighthelper/2.0 (personal travel tool)";

/** Extra Wikipedia titles to try when the primary city name misses. */
const WIKI_TITLE_ALTERNATES: Record<string, string[]> = {
  Langkawi: ["Langkawi Island"],
  "George Town, Penang": ["Penang", "George Town, Penang"],
  Denpasar: ["Bali"],
};

/** Curated fallbacks when Wikipedia returns nothing (theme-matched Unsplash). */
const IATA_IMAGE_FALLBACKS: Record<string, string> = {
  LGK: "https://images.unsplash.com/photo-1596422846544-e75c6426b0b3?w=800&q=80&auto=format&fit=crop",
  KUL: "https://images.unsplash.com/photo-1563720223185-11003d516935?w=800&q=80&auto=format&fit=crop",
  PEN: "https://images.unsplash.com/photo-1589308074300-40e3a0a4d5f3?w=800&q=80&auto=format&fit=crop",
};

interface WikiResponse {
  thumbnail?: { source: string };
  originalimage?: { source: string };
}

async function fetchWikiTitle(title: string): Promise<string | null> {
  const cacheKey = `img:${title}`;
  const cached = await cacheGet<string>(cacheKey);
  if (cached !== null) return cached || null;

  let url: string | null = null;
  try {
    const res = await fetch(WIKI_API + encodeURIComponent(title.replace(/ /g, "_")), {
      headers: { "User-Agent": USER_AGENT, Accept: "application/json" },
      signal: AbortSignal.timeout(8000),
    });
    if (res.ok) {
      const data = (await res.json()) as WikiResponse;
      url = data.originalimage?.source ?? data.thumbnail?.source ?? null;
    }
  } catch {
    url = null;
  }

  await cacheSet(cacheKey, url ?? "", 60 * 60 * 24 * 7);
  return url;
}

/**
 * Resolve a hero image for a destination.
 * @param wikiTitle - Primary Wikipedia page title (from airport wikiCity or city name)
 * @param destIata - Optional IATA for Unsplash fallback when Wikipedia fails
 */
export async function heroImage(
  wikiTitle: string,
  destIata?: string,
): Promise<string | null> {
  const titles = [
    wikiTitle,
    ...(WIKI_TITLE_ALTERNATES[wikiTitle] ?? []),
  ];

  const seen = new Set<string>();
  for (const title of titles) {
    if (seen.has(title)) continue;
    seen.add(title);
    const url = await fetchWikiTitle(title);
    if (url) return url;
  }

  if (destIata) {
    const fallback = IATA_IMAGE_FALLBACKS[destIata.toUpperCase()];
    if (fallback) return fallback;
  }

  return null;
}
