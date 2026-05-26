/**
 * Wikipedia hero image lookup. Free, no auth, decent quality.
 * Caches the resulting URL (not bytes) — landmark photos don't change.
 */

import { cacheGet, cacheSet } from "./cache-helpers";

const WIKI_API = "https://en.wikipedia.org/api/rest_v1/page/summary/";
const USER_AGENT = "flighthelper/2.0 (personal travel tool)";

interface WikiResponse {
  thumbnail?: { source: string };
  originalimage?: { source: string };
}

export async function heroImage(wikiTitle: string): Promise<string | null> {
  const cacheKey = `img:${wikiTitle}`;
  const cached = await cacheGet<string>(cacheKey);
  if (cached !== null) return cached || null; // empty string = previously confirmed no image

  let url: string | null = null;
  try {
    const res = await fetch(WIKI_API + encodeURIComponent(wikiTitle.replace(/ /g, "_")), {
      headers: { "User-Agent": USER_AGENT, Accept: "application/json" },
      signal: AbortSignal.timeout(5000),
    });
    if (res.ok) {
      const data = (await res.json()) as WikiResponse;
      url = data.originalimage?.source ?? data.thumbnail?.source ?? null;
    }
  } catch {
    url = null;
  }

  // Cache the result (including "no image found" as empty string) for 7 days.
  await cacheSet(cacheKey, url ?? "", 60 * 60 * 24 * 7);
  return url;
}
