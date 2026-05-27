/**
 * Shared session for Google Flights' internal RPC endpoints.
 *
 * Both `GetShoppingResults` (price search) and `GetCalendarGraph` (60-day price
 * grid) live behind the same `/_/FlightsFrontendUi/data/...` URL and use the
 * same three pieces of state, harvested once per ~20 minutes from a `GET
 * /travel/flights` page load:
 *
 *   - `f.sid` — short-lived session identifier (embedded in the page as `FdrFJe`)
 *   - `bl`    — JS build label (embedded as `cfb2h`); both endpoints reject the
 *               request if it doesn't match the currently-deployed build
 *   - the `NID` cookie issued in the response, threaded through as a `cookie:`
 *     header on the POST.
 *
 * Cached per-process for SESSION_TTL_MS. A single concurrent fetch is shared
 * via the `sessionPromise` so a burst of parallel scrapes only triggers one
 * page-GET.
 */

const SESSION_TTL_MS = 20 * 60_000;

const BASE_HEADERS: Record<string, string> = {
  "user-agent":
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 " +
    "(KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
  "accept-language": "en-US,en;q=0.9",
};

export interface GoogleFlightsSession {
  sid: string;
  bl: string;
  cookieHeader: string;
  pageUrl: string;
  fetchedAt: number;
}

let sessionCache: GoogleFlightsSession | null = null;
let sessionPromise: Promise<GoogleFlightsSession> | null = null;

/** Get a valid Google Flights session — cached, deduplicated under concurrency. */
export async function getGoogleFlightsSession(): Promise<GoogleFlightsSession> {
  const now = Date.now();
  if (sessionCache && now - sessionCache.fetchedAt < SESSION_TTL_MS) {
    return sessionCache;
  }
  if (sessionPromise) return sessionPromise;
  sessionPromise = (async () => {
    const pageUrl = "https://www.google.com/travel/flights?hl=en&curr=USD";
    const res = await fetch(pageUrl, {
      headers: { ...BASE_HEADERS, accept: "text/html" },
      redirect: "manual",
    });
    if (res.status !== 200) {
      throw new Error(`google-flights session: page status ${res.status}`);
    }
    const setCookies = res.headers.getSetCookie?.() ?? [];
    const cookieHeader = setCookies.map((s) => s.split(";")[0]).join("; ");
    const html = await res.text();
    const sid = html.match(/"FdrFJe":"(-?\d+)"/)?.[1];
    const bl = html.match(/"cfb2h":"(boq_travel[^"]+)"/)?.[1];
    if (!sid || !bl) {
      throw new Error("google-flights session: missing sid/bl in page HTML");
    }
    sessionCache = { sid, bl, cookieHeader, pageUrl, fetchedAt: now };
    return sessionCache;
  })();
  try {
    return await sessionPromise;
  } finally {
    sessionPromise = null;
  }
}

/** Invalidate the cached session — call this on auth/cookie failures (400/401/403). */
export function invalidateGoogleFlightsSession(): void {
  sessionCache = null;
}
