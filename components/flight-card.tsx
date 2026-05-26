"use client";

import { motion, useReducedMotion } from "motion/react";
import { useState } from "react";
import type { Card } from "@/lib/types";
import { DateNudger } from "./date-nudger";
import { GlassSurface } from "./ui/glass-surface";

interface Props {
  card: Card;
  index: number;
}

const CARD_X = "px-5";

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
    <motion.div
      initial={reduceMotion ? { opacity: 0 } : { opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={reduceMotion ? undefined : { y: -4, transition: { type: "spring", stiffness: 300, damping: 26 } }}
      transition={{
        delay: reduceMotion ? 0 : 0.05 + index * 0.05,
        duration: 0.5,
        ease: [0.22, 1, 0.36, 1],
      }}
      className="flex h-full text-neutral-800 transform-gpu"
    >
      <GlassSurface interactive className="flex h-full w-full flex-col overflow-hidden">
        <div className={`${CARD_X} pt-5 platform-rings`}>
          <div className="relative mx-auto h-36 w-full sm:h-40">
            {card.imageUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={card.imageUrl}
                alt={card.destLabel}
                className="image-feather-card h-full w-full object-cover"
                loading="lazy"
                onError={(e) => {
                  e.currentTarget.style.display = "none";
                  e.currentTarget.parentElement
                    ?.querySelector("[data-img-fallback]")
                    ?.classList.remove("hidden");
                }}
              />
            ) : null}
            <div
              data-img-fallback
              className={[
                "flex h-full w-full items-center justify-center rounded-3xl bg-gradient-to-br from-sky-100/80 to-indigo-100/60 image-feather-card",
                card.imageUrl ? "absolute inset-0 hidden" : "",
              ].join(" ")}
            >
              <span className="text-3xl font-semibold text-sky-400/60">
                {best.destCity.charAt(0)}
              </span>
            </div>
          </div>
        </div>

        <div className={`${CARD_X} pt-4 pb-3 text-center`}>
          <h3 className="font-display text-lg font-bold tracking-tight text-neutral-900 sm:text-xl">
            {best.destCity}
          </h3>
          <p className="mt-1 text-sm text-neutral-500">{card.destCountry}</p>
        </div>

        <hr className="glass-divider mx-5 shrink-0" />

        <div className={`${CARD_X} py-4`}>
          <div className="grid grid-cols-[1fr_auto_1fr] items-start gap-x-2 sm:gap-x-3">
            <div className="min-w-0 text-left">
              <div className="text-base font-bold tabular-nums leading-none text-neutral-900 sm:text-lg">
                {formatDate(best.departDate)}
              </div>
              <div className="mt-1 truncate text-xs font-medium tracking-wide text-neutral-500">
                {best.origin}
              </div>
            </div>

            <span className="glass-pill shrink-0 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider text-neutral-500">
              {stopsLabel}
            </span>

            <div className="min-w-0 text-right">
              <div className="text-base font-bold tabular-nums leading-none text-neutral-900 sm:text-lg">
                {best.returnDate ? formatDate(best.returnDate) : "One-way"}
              </div>
              <div className="mt-1 text-xs font-medium tracking-wide text-neutral-500">
                {best.destIata}
              </div>
            </div>
          </div>

          <p className="mt-3 text-center text-[13px] leading-snug text-neutral-500">
            {[best.airline || "Multiple", best.duration, nights].filter(Boolean).join(" · ")}
          </p>
        </div>

        <hr className="glass-divider mx-5 shrink-0" />

        <div
          className={`${CARD_X} flex flex-col justify-between gap-3 py-4 sm:flex-row sm:items-end`}
        >
          <div className="min-w-0">
            {isCheapestOfMany && (
              <span className="mb-1 block text-xs font-medium text-sky-700">
                Best of {card.combosSucceeded} date options
              </span>
            )}
            <div className="text-2xl font-bold tabular-nums tracking-tight text-neutral-900 sm:text-[1.75rem]">
              {best.priceDisplay}
            </div>
            <div className="mt-0.5 text-[11px] text-neutral-400">per person</div>
          </div>

          <a
            href={best.bookingUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="liquid-glass-button liquid-glass-button-sm shrink-0 no-underline text-inherit"
          >
            <span className="liquid-glass-button-label">Book</span>
          </a>
        </div>

        <div className={`${CARD_X} mt-auto space-y-3 pb-5`}>
          <DateNudger baseline={best} adults={1} />

          {card.alternates.length > 0 && (
            <div>
              <button
                type="button"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setShowAlternates((v) => !v);
                }}
                className="text-xs font-medium text-neutral-500 transition hover:text-neutral-800"
              >
                {showAlternates ? "Hide" : "Show"} {card.alternates.length} other option
                {card.alternates.length > 1 ? "s" : ""}
              </button>
              {showAlternates && (
                <motion.ul
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  className="mt-2 space-y-1.5 overflow-hidden text-xs text-neutral-600"
                >
                  {card.alternates.map((alt, i) => (
                    <li key={i}>
                      <a
                        href={alt.bookingUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={(e) => e.stopPropagation()}
                        className="glass-pill flex items-center gap-2 !rounded-2xl px-3 py-2 no-underline text-inherit transition-colors hover:text-neutral-900"
                      >
                        <span className="shrink-0 font-mono text-neutral-500">
                          {formatDate(alt.departDate)}
                          {alt.returnDate && ` → ${formatDate(alt.returnDate)}`}
                        </span>
                        <span className="text-neutral-300">·</span>
                        <span className="min-w-0 flex-1 truncate">
                          {alt.airline}
                          {alt.destIata !== best.destIata && (
                            <span className="ml-1 font-mono text-[10px] text-sky-700">
                              {alt.destIata}
                            </span>
                          )}
                        </span>
                        <span className="shrink-0 font-semibold tabular-nums text-neutral-800">
                          {alt.priceDisplay}
                        </span>
                      </a>
                    </li>
                  ))}
                </motion.ul>
              )}
            </div>
          )}
        </div>
      </GlassSurface>
    </motion.div>
  );
}
