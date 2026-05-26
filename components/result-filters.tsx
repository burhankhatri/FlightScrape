"use client";

import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useState } from "react";
import type { Filters } from "@/lib/types";
import {
  DEFAULT_FILTERS,
  activeFilterCount,
  isFiltersActive,
} from "@/lib/filter-cards";
import { GlassSurface } from "./ui/glass-surface";

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

  // Slider step: round to nearest 10 for price, 0.5 hour for duration.
  const priceStep = priceMax > 2000 ? 50 : 25;

  return (
    <div className="w-full max-w-3xl mx-auto">
      <div className="flex flex-col xs:flex-row xs:items-center xs:justify-between gap-2 xs:gap-3 mb-3">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="glass-pill touch-target px-4 py-2.5 text-sm font-medium text-neutral-700 hover:text-neutral-900 transition-colors inline-flex items-center justify-center gap-2 w-full xs:w-auto"
          aria-expanded={open}
          aria-controls="result-filters-panel"
        >
          <FunnelIcon className="w-4 h-4" />
          Filters
          {activeCount > 0 && (
            <span className="inline-flex items-center justify-center min-w-[1.25rem] h-5 px-1.5 rounded-full bg-sky-600 text-white text-[11px] font-semibold tabular-nums">
              {activeCount}
            </span>
          )}
        </button>

        <div className="text-xs text-neutral-500 text-center xs:text-right">
          {isActive ? (
            <>
              <span className="font-semibold text-neutral-800">{resultCount}</span>
              {" of "}
              <span className="tabular-nums">{totalCount}</span>
              {" shown"}
            </>
          ) : (
            <>
              <span className="font-semibold text-neutral-800">{totalCount}</span>{" "}
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
            <GlassSurface className="p-4 sm:p-6 mb-4 !rounded-2xl">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 sm:gap-x-8 gap-y-5">
                {/* Stops */}
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

                {/* Max price */}
                <div>
                  <div className="flex items-baseline justify-between mb-1.5">
                    <FilterLabel>Max price</FilterLabel>
                    <span className="text-xs text-neutral-600 tabular-nums">
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
                    className="w-full accent-sky-600"
                    aria-label="Maximum price"
                  />
                </div>

                {/* Max duration */}
                <div>
                  <div className="flex items-baseline justify-between mb-1.5">
                    <FilterLabel>Max duration</FilterLabel>
                    <span className="text-xs text-neutral-600 tabular-nums">
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
                    className="w-full accent-sky-600"
                    aria-label="Maximum flight duration in hours"
                  />
                </div>

                {/* Airlines */}
                {airlines.length > 1 && (
                  <div className="sm:col-span-2">
                    <FilterLabel>Hide airlines</FilterLabel>
                    <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto">
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
                            {excluded && (
                              <span aria-hidden className="mr-1">✕</span>
                            )}
                            {a}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>

              {isActive && (
                <div className="flex justify-end mt-5 pt-4 border-t border-white/40">
                  <button
                    type="button"
                    onClick={reset}
                    className="text-xs font-medium text-sky-700 hover:text-sky-900 transition-colors"
                  >
                    Reset all filters
                  </button>
                </div>
              )}
            </GlassSurface>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function FilterLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="type-label uppercase tracking-wider mb-2 text-[11px]">
      {children}
    </p>
  );
}

function chipClass(selected: boolean, isExclude = false): string {
  const base =
    "touch-target px-3 py-2 sm:py-1.5 rounded-full text-xs font-medium transition-all border inline-flex items-center justify-center";
  if (selected) {
    return [
      base,
      isExclude
        ? "bg-red-500/10 text-red-700 border-red-300/60"
        : "bg-sky-600 text-white border-sky-600 shadow-sm",
    ].join(" ");
  }
  return [
    base,
    "bg-white/55 text-neutral-700 border-white/70 hover:bg-white/80 hover:text-neutral-900",
  ].join(" ");
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
