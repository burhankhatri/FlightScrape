"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "motion/react";
import { TripSearchForm } from "@/components/trip-search-form";
import { FlightCard } from "@/components/flight-card";
import { StatsBar } from "@/components/stats-bar";
import { SearchProgress } from "@/components/search-progress";
import { ResultFilters } from "@/components/result-filters";
import { ChipButton } from "@/components/ui/chip-button";
import {
  type OriginOption,
  findOriginByIata,
  getDefaultOrigin,
} from "@/lib/origins";
import {
  DEFAULT_FILTERS,
  deriveFilterBounds,
  filterCards,
} from "@/lib/filter-cards";
import type { SearchStreamEvent } from "@/lib/search-events";
import type {
  Card,
  Filters,
  ParsedQuery,
  SearchResponse,
  SearchStats,
} from "@/lib/types";

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

function EmptyState({ children }: { children: React.ReactNode }) {
  return (
    <div className="vercel-surface mx-auto max-w-lg px-6 py-8 text-center text-sm text-[#4d4d4d]">
      {children}
    </div>
  );
}

export default function FlightsPage() {
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
  const [filters, setFilters] = useState<Filters>(DEFAULT_FILTERS);

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
      setFilters(DEFAULT_FILTERS);

      try {
        const res = await fetch("/api/search/stream", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ query, defaultOrigin: origin.iata }),
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

  const filterBounds = useMemo(() => deriveFilterBounds(cards), [cards]);
  const filteredCards = useMemo(
    () => filterCards(cards, filters),
    [cards, filters],
  );

  return (
    <main className="app-shell page-shell flex flex-col items-center">
      <div className="page-container flex flex-col items-center gap-5 sm:gap-6 md:gap-8">
        <motion.header
          initial={{ opacity: 0, y: -12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
          className="flex w-full flex-col gap-4 sm:flex-row sm:items-center sm:justify-between"
        >
          <div className="text-center sm:text-left">
            <Link
              href="/"
              className="mb-2 inline-flex items-center gap-1.5 text-sm font-medium tracking-[-0.02em] text-[#4d4d4d] transition hover:text-[#171717]"
            >
              ← Flighthelper
            </Link>
            <h1 className="sf-display text-xl font-semibold tracking-[-0.04em] text-[#171717] sm:text-2xl md:text-3xl">
              Search flights
            </h1>
            <p className="mt-1 max-w-md text-sm leading-relaxed text-[#4d4d4d]">
              Describe your trip — we compare prices across dates and destinations.
            </p>
          </div>
        </motion.header>

        <section
          aria-labelledby="search-heading"
          className="flex w-full flex-col items-center"
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
                <p className="type-caption-mono text-[#888888]">Example searches</p>
                <p className="type-caption max-w-md text-center">
                  Tap one to run it with your selected departure airport.
                </p>
                <div className="flex w-full max-w-3xl flex-col flex-wrap items-stretch justify-center gap-2 px-0 xs:flex-row xs:items-center sm:px-2">
                  {EXAMPLE_QUERIES.map((q) => (
                    <ChipButton key={q} onClick={() => search(q)} className="w-full xs:w-auto">
                      <span className="line-clamp-3 text-left xs:line-clamp-2 xs:text-center sm:line-clamp-1">
                        {q}
                      </span>
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
                <div className="vercel-surface max-w-lg px-6 py-4 text-center text-sm text-[#ee0000]">
                  {error}
                </div>
              </motion.div>
            )}

            {phase === "done" && data && (
              <motion.div
                key="done"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="space-y-6"
              >
                <StatsBar
                  cards={filteredCards}
                  stats={data.stats}
                  originDisplay={data.parsed.origin ?? origin.label}
                />

                {data.cards.length > 0 && (
                  <ResultFilters
                    filters={filters}
                    onChange={setFilters}
                    airlines={filterBounds.airlines}
                    priceMax={filterBounds.maxPrice}
                    priceMin={filterBounds.minPrice}
                    durationMax={filterBounds.maxDuration}
                    stopsMax={filterBounds.maxStops}
                    resultCount={filteredCards.length}
                    totalCount={data.cards.length}
                  />
                )}

                {data.cards.length === 0 ? (
                  <EmptyState>
                    No results. Try different dates or check that the destination is in{" "}
                    <code className="font-mono text-[#171717]">lib/destinations.ts</code>.
                  </EmptyState>
                ) : filteredCards.length === 0 ? (
                  <EmptyState>
                    No flights match your filters. Try loosening them above.
                  </EmptyState>
                ) : (
                  <div className="cards-carousel">
                    {filteredCards.map((c, i) => (
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
