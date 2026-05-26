"use client";

import { useCallback, useEffect, useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { TripSearchForm } from "@/components/trip-search-form";
import { FlightCard } from "@/components/flight-card";
import { StatsBar } from "@/components/stats-bar";
import { SearchProgress } from "@/components/search-progress";
import { ChipButton } from "@/components/ui/chip-button";
import { GlassSurface } from "@/components/ui/glass-surface";
import {
  type OriginOption,
  findOriginByIata,
  getDefaultOrigin,
} from "@/lib/origins";
import type { SearchStreamEvent } from "@/lib/search-events";
import type { Card, ParsedQuery, SearchResponse, SearchStats } from "@/lib/types";

type Phase = "idle" | "loading" | "error" | "done";

const ORIGIN_STORAGE_KEY = "flighthelper-origin-iata";

const EXAMPLE_QUERIES = [
  "cheapest flights to KL in july for 2 weeks",
  "flights to nepal malaysia thailand and japan jul 25 to aug 25",
  "one-way to istanbul mid august",
];

function loadStoredOrigin(): OriginOption {
  if (typeof window === "undefined") return getDefaultOrigin();
  const saved = localStorage.getItem(ORIGIN_STORAGE_KEY);
  if (saved) return findOriginByIata(saved) ?? getDefaultOrigin();
  return getDefaultOrigin();
}

export default function Home() {
  const [phase, setPhase] = useState<Phase>("idle");
  const [origin, setOrigin] = useState<OriginOption>(getDefaultOrigin);
  const [cards, setCards] = useState<Card[]>([]);
  const [parsed, setParsed] = useState<ParsedQuery | null>(null);
  const [stats, setStats] = useState<SearchStats | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [statusMessage, setStatusMessage] = useState("Starting search…");
  const [progress, setProgress] = useState(0);
  const [progressTotal, setProgressTotal] = useState(0);
  const [progressSucceeded, setProgressSucceeded] = useState(0);
  const [progressLabel, setProgressLabel] = useState<string>();
  const [destinations, setDestinations] = useState<string[]>([]);

  useEffect(() => {
    setOrigin(loadStoredOrigin());
  }, []);

  useEffect(() => {
    localStorage.setItem(ORIGIN_STORAGE_KEY, origin.iata);
  }, [origin]);

  const search = useCallback(
    async (query: string) => {
      setPhase("loading");
      setError(null);
      setCards([]);
      setParsed(null);
      setStats(null);
      setStatusMessage("Understanding your trip…");
      setProgress(0);
      setProgressTotal(0);
      setProgressSucceeded(0);
      setProgressLabel(undefined);
      setDestinations([]);

      try {
        const res = await fetch("/api/search/stream", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ query, defaultOrigin: origin.city }),
        });

        if (!res.ok || !res.body) {
          const json = await res.json().catch(() => ({}));
          setError((json as { error?: string }).error ?? "Search failed");
          setPhase("error");
          return;
        }

        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";

        const handleEvent = (event: SearchStreamEvent) => {
          switch (event.type) {
            case "status":
              setStatusMessage(event.message);
              break;
            case "parsed":
              setParsed(event.parsed);
              setDestinations(event.destinations);
              setProgressTotal(event.totalCombos);
              break;
            case "progress":
              setProgressTotal(event.total);
              setProgressSucceeded(event.succeeded);
              setProgress(event.total > 0 ? event.checked / event.total : 0);
              if (event.label) setProgressLabel(event.label);
              break;
            case "card":
              setCards((prev) => {
                const exists = prev.some((c) => c.destLabel === event.card.destLabel);
                if (exists) return prev;
                return [...prev, event.card].sort((a, b) => a.best.price - b.best.price);
              });
              break;
            case "card-image":
              setCards((prev) =>
                prev.map((c) =>
                  c.destLabel === event.destLabel ? { ...c, imageUrl: event.imageUrl } : c,
                ),
              );
              break;
            case "done":
              setParsed(event.parsed);
              setStats(event.stats);
              setPhase("done");
              break;
            case "error":
              setError(event.error);
              setPhase("error");
              break;
          }
        };

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop() ?? "";
          for (const line of lines) {
            if (!line.trim()) continue;
            handleEvent(JSON.parse(line) as SearchStreamEvent);
          }
        }

        if (buffer.trim()) {
          handleEvent(JSON.parse(buffer) as SearchStreamEvent);
        }

        setPhase((p) => (p === "loading" ? "done" : p));
      } catch (e) {
        setError(e instanceof Error ? e.message : "Network error");
        setPhase("error");
      }
    },
    [origin],
  );

  const data: SearchResponse | null =
    parsed && stats ? { parsed, cards, stats } : null;

  return (
    <main className="min-h-screen flex flex-col items-center px-4 sm:px-6 py-6 sm:py-10">
      <div className="w-full max-w-6xl flex flex-col items-center gap-5 sm:gap-6">
        <motion.header
          initial={{ opacity: 0, y: -12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
          className="text-center max-w-lg"
        >
          <p className="type-caption font-medium text-sky-800/80 mb-2">
            Natural-language flight search
          </p>
          <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight text-neutral-900 text-balance">
            Find the cheapest flights from your city
          </h1>
          <p className="mt-2 text-sm sm:text-[15px] text-neutral-600 text-balance leading-snug">
            Describe your trip in plain English — we compare Google Flights and
            Amadeus, then show the best price per destination.
          </p>
        </motion.header>

        <section
          aria-labelledby="search-heading"
          className="w-full flex flex-col items-center gap-2"
        >
          <h2 id="search-heading" className="sr-only">
            Search flights
          </h2>
          <TripSearchForm
            origin={origin}
            onOriginChange={setOrigin}
            onSearch={search}
            loading={phase === "loading"}
          />
        </section>

        <div className="w-full">
          <AnimatePresence mode="wait">
            {phase === "idle" && (
              <motion.div
                key="idle"
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.4 }}
                className="flex flex-col items-center gap-3"
              >
                <h2 className="text-sm font-semibold text-neutral-800">
                  Example searches
                </h2>
                <p className="type-caption text-center max-w-md">
                  Tap one to run it with your selected departure airport.
                </p>
                <div className="flex flex-col sm:flex-row flex-wrap items-center justify-center gap-2 max-w-3xl">
                  {EXAMPLE_QUERIES.map((q) => (
                    <ChipButton key={q} onClick={() => search(q)}>
                      <span className="italic line-clamp-2 sm:line-clamp-1">{q}</span>
                    </ChipButton>
                  ))}
                </div>
              </motion.div>
            )}

            {phase === "loading" && (
              <motion.div
                key="loading"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="space-y-8"
              >
                <SearchProgress
                  message={statusMessage}
                  progress={progress}
                  succeeded={progressSucceeded}
                  total={progressTotal}
                  destinations={destinations}
                  currentLabel={progressLabel}
                />

                {cards.length > 0 && (
                  <div className="cards-carousel">
                    {cards.map((c, i) => (
                      <FlightCard key={c.destLabel} card={c} index={i} />
                    ))}
                  </div>
                )}
              </motion.div>
            )}

            {phase === "error" && (
              <motion.div
                key="error"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="flex justify-center"
              >
                <GlassSurface className="px-6 py-4 text-red-600 text-sm text-center max-w-lg">
                  {error}
                </GlassSurface>
              </motion.div>
            )}

            {phase === "done" && data && (
              <motion.div
                key="done"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="space-y-8"
              >
                <StatsBar
                  cards={data.cards}
                  stats={data.stats}
                  originDisplay={data.parsed.origin ?? origin.label}
                />
                {data.cards.length === 0 ? (
                  <GlassSurface className="px-6 py-8 text-center text-neutral-500 max-w-lg mx-auto">
                    No results. Try different dates or check that the destination is in{" "}
                    <code className="text-neutral-700">lib/destinations.ts</code>.
                  </GlassSurface>
                ) : (
                  <div className="cards-carousel">
                    {data.cards.map((c, i) => (
                      <FlightCard key={c.destLabel} card={c} index={i} />
                    ))}
                  </div>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </main>
  );
}
