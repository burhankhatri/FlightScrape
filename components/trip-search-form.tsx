"use client";

import { useState } from "react";
import { OriginPicker } from "@/components/origin-picker";
import { LiquidGlassButton } from "@/components/ui/liquid-glass-button";
import { FieldLabel } from "@/components/ui/field-label";
import type { OriginOption } from "@/lib/origins";

interface Props {
  origin: OriginOption;
  onOriginChange: (origin: OriginOption) => void;
  onSearch: (query: string) => void;
  loading?: boolean;
}

/** Responsive search bar — stacks on phone, three-column grid on tablet+ */
export function TripSearchForm({ origin, onOriginChange, onSearch, loading }: Props) {
  const [query, setQuery] = useState("");

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (query.trim() && !loading) onSearch(query.trim());
  };

  return (
    <form
      onSubmit={submit}
      className="search-shell w-full max-w-2xl mx-auto p-3 sm:p-4 overflow-visible"
    >
      <div className="grid grid-cols-1 md:grid-cols-[12rem_minmax(0,1fr)_auto] gap-3 md:gap-x-4 overflow-visible">
        <div className="relative z-20 min-w-0 overflow-visible">
          <FieldLabel htmlFor="origin-picker">From</FieldLabel>
          <OriginPicker
            value={origin}
            onChange={onOriginChange}
            disabled={loading}
          />
        </div>

        <div className="min-w-0">
          <FieldLabel htmlFor="trip-search">Where to</FieldLabel>
          <input
            id="trip-search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="cheapest flights to KL in july"
            disabled={loading}
            className="field-box w-full outline-none placeholder:text-neutral-400 text-base sm:text-[0.9375rem]"
            autoComplete="off"
            enterKeyHint="search"
          />
        </div>

        <div className="min-w-0">
          <span
            className="type-label mb-1.5 hidden md:block invisible select-none"
            aria-hidden
          >
            Search
          </span>
          <LiquidGlassButton
            type="submit"
            disabled={loading || !query.trim()}
            ariaLabel="Search flights"
            size="sm"
            className="w-full md:w-auto touch-target"
          >
            {loading ? "Searching…" : "Search"}
          </LiquidGlassButton>
        </div>
      </div>
    </form>
  );
}
