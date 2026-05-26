"use client";

import { useState } from "react";
import { LiquidGlassButton } from "./ui/liquid-glass-button";

interface Props {
  onSearch: (query: string) => void;
  loading?: boolean;
  initialQuery?: string;
  inputId?: string;
  /** embedded = inside TripSearchForm card (no outer pill) */
  variant?: "standalone" | "embedded";
}

export function SearchBar({
  onSearch,
  loading,
  initialQuery = "",
  inputId = "trip-search",
  variant = "standalone",
}: Props) {
  const [value, setValue] = useState(initialQuery);
  const [focused, setFocused] = useState(false);

  const submit = (e?: React.FormEvent) => {
    e?.preventDefault();
    if (value.trim() && !loading) onSearch(value.trim());
  };

  const isEmbedded = variant === "embedded";

  return (
    <form
      onSubmit={submit}
      className={[
        "w-full flex items-center gap-2 sm:gap-3 transform-gpu",
        isEmbedded
          ? [
              "rounded-2xl px-3 py-2 bg-white/35 border border-white/50",
              focused ? "ring-1 ring-sky-300/50 bg-white/45" : "",
            ].join(" ")
          : [
              "glass-strong min-h-[3.25rem] px-4 py-3 sm:px-5 sm:py-3.5",
              focused ? "ring-2 ring-sky-200/80 ring-offset-2 ring-offset-transparent" : "",
            ].join(" "),
      ].join(" ")}
    >
      <input
        id={inputId}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        placeholder="e.g. cheapest flights to KL in july"
        className="flex-1 min-w-0 bg-transparent outline-none text-[15px] placeholder:text-neutral-400 text-neutral-800 py-0.5"
        disabled={loading}
        aria-label="Describe your trip"
      />

      <LiquidGlassButton type="submit" disabled={loading} ariaLabel="Search flights">
        {loading ? "…" : "Search"}
      </LiquidGlassButton>
    </form>
  );
}
