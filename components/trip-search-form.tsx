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

/** One tight search bar — From + Where to + Search, same field styling throughout */
export function TripSearchForm({ origin, onOriginChange, onSearch, loading }: Props) {
  const [query, setQuery] = useState("");

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (query.trim() && !loading) onSearch(query.trim());
  };

  return (
    <form
      onSubmit={submit}
      className="search-shell w-full max-w-xl mx-auto p-3 sm:p-3.5 overflow-visible"
    >
      <div className="flex flex-col sm:flex-row sm:items-end gap-3 overflow-visible">
        {/* From */}
        <div className="relative sm:w-[9.5rem] shrink-0 overflow-visible z-10">
          <FieldLabel htmlFor="origin-picker">From</FieldLabel>
          <OriginPicker
            value={origin}
            onChange={onOriginChange}
            disabled={loading}
          />
        </div>

        {/* Where to + Search */}
        <div className="flex-1 min-w-0 flex flex-col sm:flex-row sm:items-end gap-3">
          <div className="flex-1 min-w-0">
            <FieldLabel htmlFor="trip-search">Where to</FieldLabel>
            <input
              id="trip-search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="cheapest flights to KL in july"
              disabled={loading}
              className="field-box outline-none placeholder:text-neutral-400"
            />
          </div>
          <LiquidGlassButton
            type="submit"
            disabled={loading || !query.trim()}
            ariaLabel="Search flights"
            size="sm"
            className="w-full sm:w-auto sm:mb-0 shrink-0"
          >
            {loading ? "Searching…" : "Search"}
          </LiquidGlassButton>
        </div>
      </div>
    </form>
  );
}
