"use client";

import { motion, useReducedMotion } from "motion/react";
import { useState } from "react";
import type { Card } from "@/lib/types";
import { GlassSurface } from "./ui/glass-surface";

interface Props {
  card: Card;
  index: number;
}

function formatDate(iso: string): string {
  const d = new Date(iso + "T00:00:00Z");
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });
}

function nightsLabel(n: number | null): string | null {
  if (n === null) return null;
  return n === 1 ? "1 night" : `${n} nights`;
}

export function FlightCard({ card, index }: Props) {
  const [showAlternates, setShowAlternates] = useState(false);
  const reduceMotion = useReducedMotion();
  const { best } = card;
  const nights = nightsLabel(best.nights);
  const isCheapestOfMany = card.combosSucceeded >= 2;
  const stopsLabel =
    best.stops === 0 ? "Direct" : `${best.stops} stop${best.stops > 1 ? "s" : ""}`;

  return (
    <motion.a
      href={best.bookingUrl}
      target="_blank"
      rel="noopener noreferrer"
      initial={reduceMotion ? { opacity: 0 } : { opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={reduceMotion ? undefined : { y: -4, transition: { type: "spring", stiffness: 300, damping: 26 } }}
      transition={{
        delay: reduceMotion ? 0 : 0.05 + index * 0.05,
        duration: 0.5,
        ease: [0.22, 1, 0.36, 1],
      }}
      className="block no-underline text-neutral-800 transform-gpu"
    >
      <GlassSurface interactive className="overflow-hidden">
        <div className="relative px-5 pt-5 pb-0 platform-rings">
          <div className="relative h-36 sm:h-40 mx-auto max-w-[92%]">
            {card.imageUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={card.imageUrl}
                alt={card.destLabel}
                className="w-full h-full object-cover image-feather-card"
                loading="lazy"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center image-feather-card bg-gradient-to-br from-sky-100/80 to-indigo-100/60 rounded-3xl">
                <span className="text-3xl font-semibold text-sky-400/60">
                  {best.destCity.charAt(0)}
                </span>
              </div>
            )}
          </div>
        </div>

        <div className="px-6 pt-2 pb-1 text-center">
          <h3 className="text-xl sm:text-[1.35rem] font-semibold tracking-tight text-neutral-900">
            {best.destCity}
          </h3>
          <p className="text-sm text-neutral-500 mt-0.5">{card.destCountry}</p>
        </div>

        <hr className="glass-divider mx-6 my-3" />

        <div className="px-6 py-1">
          <div className="flex items-center justify-between gap-3">
            <div className="text-left min-w-0">
              <div className="text-lg sm:text-xl font-bold tabular-nums text-neutral-900 leading-none">
                {formatDate(best.departDate)}
              </div>
              <div className="text-xs text-neutral-500 mt-1 font-medium tracking-wide">
                {best.origin}
              </div>
            </div>

            <span className="glass-pill px-2.5 py-1 text-[10px] uppercase tracking-wider text-neutral-500 font-semibold shrink-0">
              {stopsLabel}
            </span>

            <div className="text-right min-w-0">
              <div className="text-lg sm:text-xl font-bold tabular-nums text-neutral-900 leading-none">
                {best.returnDate ? formatDate(best.returnDate) : "One-way"}
              </div>
              <div className="text-xs text-neutral-500 mt-1 font-medium tracking-wide">
                {best.destIata}
              </div>
            </div>
          </div>

          <p className="mt-3 text-center text-[13px] text-neutral-500">
            {[best.airline || "Multiple", best.duration, nights].filter(Boolean).join(" · ")}
          </p>
        </div>

        <hr className="glass-divider mx-6 my-3" />

        <div className="px-6 pb-5 pt-1 flex items-end justify-between gap-3">
          <div className="min-w-0">
            {isCheapestOfMany && (
              <span className="text-xs text-sky-700 font-medium mb-1 block">
                Best of {card.combosSucceeded} date options
              </span>
            )}
            <div className="text-2xl sm:text-[1.75rem] font-bold text-neutral-900 tabular-nums tracking-tight">
              {best.priceDisplay}
            </div>
            <div className="text-[11px] text-neutral-400 mt-0.5">per person · tap to book</div>
          </div>

          <span className="liquid-glass-button liquid-glass-button-sm pointer-events-none shrink-0">
            <span className="liquid-glass-button-label">Book</span>
          </span>
        </div>

        {card.alternates.length > 0 && (
          <div className="px-6 pb-5 -mt-2">
            <button
              type="button"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                setShowAlternates((v) => !v);
              }}
              className="text-xs text-neutral-500 hover:text-neutral-800 transition font-medium"
            >
              {showAlternates ? "Hide" : "Show"} {card.alternates.length} other option
              {card.alternates.length > 1 ? "s" : ""}
            </button>
            {showAlternates && (
              <motion.ul
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                className="mt-2 space-y-1.5 text-xs text-neutral-600 overflow-hidden"
              >
                {card.alternates.map((alt, i) => (
                  <li key={i} className="flex items-center gap-2 glass-pill !rounded-2xl px-3 py-2">
                    <span className="font-mono text-neutral-500 shrink-0">
                      {formatDate(alt.departDate)}
                      {alt.returnDate && ` → ${formatDate(alt.returnDate)}`}
                    </span>
                    <span className="text-neutral-300">·</span>
                    <span className="truncate flex-1">{alt.airline}</span>
                    <span className="font-semibold text-neutral-800 tabular-nums shrink-0">
                      {alt.priceDisplay}
                    </span>
                  </li>
                ))}
              </motion.ul>
            )}
          </div>
        )}
      </GlassSurface>
    </motion.a>
  );
}
