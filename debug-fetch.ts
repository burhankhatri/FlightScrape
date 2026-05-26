/* Debug helper: hit Google Flights directly + dump what we got. */
import { buildTfs } from "./lib/tfs";
import * as cheerio from "cheerio";

async function tryRoute(dest: string) {
  console.log(`\n=== ${dest} ===`);
  const tfs = buildTfs({
    legs: [
      { date: "2026-07-25", fromIata: "KHI", toIata: dest },
      { date: "2026-08-08", fromIata: dest, toIata: "KHI" },
    ],
    trip: "round-trip",
    cabin: "economy",
    adults: 1,
  });
  const url =
    "https://www.google.com/travel/flights?" +
    new URLSearchParams({ tfs, hl: "en", tfu: "EgQIABABIgA", curr: "USD" }).toString();

  const res = await fetch(url, {
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
      Accept:
        "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
      "Accept-Language": "en-US,en;q=0.9",
    },
  });
  const html = await res.text();
  const $ = cheerio.load(html);
  console.log("  status:", res.status, "html length:", html.length);
  console.log("  IWWDBc sections:", $('div[jsname="IWWDBc"]').length, "YdtKid sections:", $('div[jsname="YdtKid"]').length);
  console.log("  ul.Rk10dc:", $("ul.Rk10dc").length, "price elems:", $(".YMlIz.FpEdX").length);
  // Search for ANY price-like text in the HTML
  const priceMatches = html.match(/\$\s?[\d,]{3,}/g);
  console.log("  $ price-like substrings in HTML:", priceMatches ? priceMatches.slice(0, 5) : "none");
}

async function main() {
  for (const dest of ["BKK", "KTM", "NRT", "KUL"]) {
    await tryRoute(dest);
    await new Promise((r) => setTimeout(r, 1500));
  }
}
main().catch(console.error);
