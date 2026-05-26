"use client";

import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useState } from "react";
import type { Filters } from "@/lib/types";
import {
  DEFAULT_FILTERS,
  activeFilterCount,
  isFiltersActive,
} from "@/lib/filter-cards";

interface Props {
  filters: Filters;
  onChange: (next: Filters) => void;
  airlines: string[];
  priceMax: number;
  priceMin: number;
  durationMax: number;
  stopsMax: number;
  resultCount: number;
  totalCount: number;
}

const STOPS_PRESETS: Array<{ label: string; value: number | null }> = [
  { label: "Any stops", value: null },
  { label: "Max 1 stop", value: 1 },
  { label: "Direct only", value: 0 },
];

export function ResultFilters({
  filters,
  onChange,
  airlines,
  priceMax,
  priceMin,
  durationMax,
  resultCount,
  totalCount,
}: Props) {
  const [open, setOpen] = useState(false);
  const reduceMotion = useReducedMotion();
  const activeCount = activeFilterCount(filters);
  const isActive = isFiltersActive(filters);

  const update = (patch: Partial<Filters>) => onChange({ ...filters, ...patch });

  const toggleAirline = (a: string) => {
    const next = filters.excludeAirlines.includes(a)
      ? filters.excludeAirlines.filter((x) => x !== a)
      : [...filters.excludeAirlines, a];
    update({ excludeAirlines: next });
  };

  const reset = () => onChange(DEFAULT_FILTERS);
  const priceStep = priceMax > 2000 ? 50 : 25;

  return (
    <div className="mx-auto w-full max-w-3xl">
      <div className="mb-3 flex flex-col gap-2 xs:flex-row xs:items-center xs:justify-between xs:gap-3">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="btn-vercel-secondary touch-target inline-flex w-full items-center justify-center gap-2 xs:w-auto"
          aria-expanded={open}
          aria-controls="result-filters-panel"
        >
          <FunnelIcon className="h-4 w-4" />
          Filters
          {activeCount > 0 && (
            <span className="inline-flex h-5 min-w-[1.25rem] items-center justify-center rounded-full bg-[#171717] px-1.5 text-[11px] font-semibold tabular-nums text-white">
              {activeCount}
            </span>
          )}
        </button>

        <div className="text-center text-xs text-[#888888] xs:text-right">
          {isActive ? (
            <>
              <span className="font-semibold text-[#171717]">{resultCount}</span>
              {" of "}
              <span className="tabular-nums">{totalCount}</span>
              {" shown"}
            </>
          ) : (
            <>
              <span className="font-semibold text-[#171717]">{totalCount}</span>{" "}
              {totalCount === 1 ? "destination" : "destinations"}
            </>
          )}
        </div>
      </div>

      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            id="result-filters-panel"
            key="filters-panel"
            initial={reduceMotion ? false : { opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={reduceMotion ? undefined : { opacity: 0, height: 0 }}
            transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
            className="overflow-hidden"
          >
            <div className="vercel-surface mb-4 p-4 sm:p-6">
              <div className="grid grid-cols-1 gap-y-5 sm:grid-cols-2 sm:gap-x-8">
                <div>
                  <FilterLabel>Stops</FilterLabel>
                  <div className="flex flex-wrap gap-1.5">
                    {STOPS_PRESETS.map((p) => {
                      const selected = filters.maxStops === p.value;
                      return (
                        <button
                          key={p.label}
                          type="button"
                          onClick={() => update({ maxStops: p.value })}
                          className={chipClass(selected)}
                        >
                          {p.label}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div>
                  <div className="mb-1.5 flex items-baseline justify-between">
                    <FilterLabel>Max price</FilterLabel>
                    <span className="font-mono text-xs tabular-nums text-[#4d4d4d]">
                      {filters.maxPrice === null
                        ? `up to $${priceMax.toLocaleString()}`
                        : `$${filters.maxPrice.toLocaleString()}`}
                    </span>
                  </div>
                  <input
                    type="range"
                    min={priceMin}
                    max={priceMax}
                    step={priceStep}
                    value={filters.maxPrice ?? priceMax}
                    onChange={(e) => {
                      const v = parseInt(e.target.value, 10);
                      update({ maxPrice: v >= priceMax ? null : v });
                    }}
                    className="w-full accent-[#171717]"
                    aria-label="Maximum price"
                  />
                </div>

                <div>
                  <div className="mb-1.5 flex items-baseline justify-between">
                    <FilterLabel>Max duration</FilterLabel>
                    <span className="font-mono text-xs tabular-nums text-[#4d4d4d]">
                      {filters.maxDurationHours === null
                        ? `up to ${durationMax}h`
                        : `${filters.maxDurationHours}h`}
                    </span>
                  </div>
                  <input
                    type="range"
                    min={Math.max(1, Math.floor(durationMax / 4))}
                    max={Math.max(durationMax, 2)}
                    step={1}
                    value={filters.maxDurationHours ?? durationMax}
                    onChange={(e) => {
                      const v = parseInt(e.target.value, 10);
                      update({
                        maxDurationHours: v >= durationMax ? null : v,
                      });
                    }}
                    className="w-full accent-[#171717]"
                    aria-label="Maximum flight duration in hours"
                  />
                </div>

                {airlines.length > 1 && (
                  <div className="sm:col-span-2">
                    <FilterLabel>Hide airlines</FilterLabel>
                    <div className="flex max-h-24 flex-wrap gap-1.5 overflow-y-auto">
                      {airlines.map((a) => {
                        const excluded = filters.excludeAirlines.includes(a);
                        return (
                          <button
                            key={a}
                            type="button"
                            onClick={() => toggleAirline(a)}
                            className={chipClass(excluded, true)}
                            aria-pressed={excluded}
                          >
                            {excluded && <span aria-hidden className="mr-1">✕</span>}
                            {a}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>

              {isActive && (
                <div className="mt-5 flex justify-end border-t border-[#ebebeb] pt-4">
                  <button
                    type="button"
                    onClick={reset}
                    className="text-xs font-medium text-[#0070f3] transition hover:text-[#0761d1]"
                  >
                    Reset all filters
                  </button>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function FilterLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="type-caption-mono mb-2 text-[#888888]">{children}</p>
  );
}

function chipClass(selected: boolean, isExclude = false): string {
  const base = "vercel-chip touch-target";
  if (selected) {
    return [base, isExclude ? "vercel-chip-exclude" : "vercel-chip-active"].join(" ");
  }
  return base;
}

function FunnelIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden
    >
      <path d="M4 5h16l-6 8v5l-4 2v-7z" />
    </svg>
  );
}
