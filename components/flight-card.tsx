"use client";

import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useState } from "react";
import type { Card, Offer, PriceForecast } from "@/lib/types";
import { DateNudger } from "./date-nudger";

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
      initial={reduceMotion ? { opacity: 0 } : { opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={reduceMotion ? undefined : { y: -2, transition: { type: "spring", stiffness: 300, damping: 26 } }}
      transition={{
        delay: reduceMotion ? 0 : 0.05 + index * 0.05,
        duration: 0.45,
        ease: [0.22, 1, 0.36, 1],
      }}
      className="flex h-full text-[#171717] transform-gpu"
    >
      <article className="vercel-surface flex h-full w-full flex-col overflow-hidden transition-shadow hover:shadow-[0_2px_2px_#0000000a,0_8px_16px_-4px_#0000000a]">
        <div className={`${CARD_X} pt-5`}>
          <div className="relative mx-auto h-36 w-full overflow-hidden rounded-md bg-[#f5f5f5] sm:h-40">
            {card.imageUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={card.imageUrl}
                alt={card.destLabel}
                className="h-full w-full object-cover"
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
                "flex h-full w-full items-center justify-center bg-[#f5f5f5]",
                card.imageUrl ? "absolute inset-0 hidden" : "",
              ].join(" ")}
            >
              <span className="font-display text-3xl font-semibold text-[#a1a1a1]">
                {best.destCity.charAt(0)}
              </span>
            </div>
          </div>
        </div>

        <div className={`${CARD_X} pt-4 pb-3 text-center`}>
          <h3 className="font-display text-lg font-semibold tracking-[-0.03em] text-[#171717] sm:text-xl">
            {best.destCity}
          </h3>
          <p className="mt-1 text-sm text-[#888888]">{card.destCountry}</p>
        </div>

        <hr className="vercel-divider mx-5 shrink-0" />

        <div className={`${CARD_X} py-4`}>
          <div className="grid grid-cols-[1fr_auto_1fr] items-start gap-x-2 sm:gap-x-3">
            <div className="min-w-0 text-left">
              <div className="text-base font-semibold tabular-nums leading-none text-[#171717] sm:text-lg">
                {formatDate(best.departDate)}
              </div>
              <div className="mt-1 truncate font-mono text-xs text-[#888888]">
                {best.origin}
              </div>
            </div>

            <span className="vercel-badge shrink-0">{stopsLabel}</span>

            <div className="min-w-0 text-right">
              <div className="text-base font-semibold tabular-nums leading-none text-[#171717] sm:text-lg">
                {best.returnDate ? formatDate(best.returnDate) : "One-way"}
              </div>
              <div className="mt-1 font-mono text-xs text-[#888888]">{best.destIata}</div>
            </div>
          </div>

          <div className="mt-4 flex items-center justify-center gap-2 text-center">
            <span className="text-sm font-semibold text-[#171717] sm:text-[15px]">
              {best.airline || "Multiple"}
            </span>
            {best.duration && (
              <>
                <span className="text-[#ebebeb]">·</span>
                <span className="text-sm font-semibold tabular-nums text-[#171717] sm:text-[15px]">
                  {best.duration}
                </span>
              </>
            )}
          </div>
          {nights && (
            <p className="mt-1 text-center text-xs text-[#888888]">{nights}</p>
          )}
        </div>

        <hr className="vercel-divider mx-5 shrink-0" />

        <div
          className={`${CARD_X} flex flex-col justify-between gap-3 py-4 sm:flex-row sm:items-end`}
        >
          <div className="min-w-0">
            {isCheapestOfMany && (
              <span className="mb-1 block text-xs font-medium text-[#4d4d4d]">
                Best of {card.combosSucceeded} date options
              </span>
            )}
            <div className="text-2xl font-semibold tabular-nums tracking-[-0.03em] text-[#171717] sm:text-[1.75rem]">
              {best.priceDisplay}
            </div>
            <div className="mt-0.5 text-[11px] text-[#888888]">per person</div>
          </div>

          <div className="flex flex-col items-end gap-1.5">
            <a
              href={best.bookingUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="btn-vercel-primary shrink-0"
            >
              Book
            </a>
            <p className="max-w-[180px] text-right text-[10px] leading-tight text-[#a1a1a1]">
              Opens Google Flights — sign-in may unlock cheaper personalised deals
            </p>
          </div>
        </div>

        <AnimatePresence>
          {best.forecast && (
            <motion.div
              initial={reduceMotion ? { opacity: 0 } : { opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
              className={CARD_X}
            >
              <ForecastBadge forecast={best.forecast} />
            </motion.div>
          )}
        </AnimatePresence>

        <div className={`${CARD_X} mt-auto pb-5`}>
          <DateNudger baseline={best} adults={1} />

          {card.alternates.length > 0 && (
            <>
              <hr className="vercel-divider my-4 shrink-0" />
              <div>
                <p className="mb-2 text-[11px] font-medium uppercase tracking-wider text-[#888888]">
                  Other options
                </p>
                <ul className="space-y-1.5 text-xs text-[#4d4d4d]">
                  {card.alternates.slice(0, 2).map((alt, i) => (
                    <AlternateRow key={`top-${i}`} alt={alt} bestDestIata={best.destIata} />
                  ))}
                </ul>

                {card.alternates.length > 2 && (
                  <>
                    <AnimatePresence initial={false}>
                      {showAlternates && (
                        <motion.ul
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: "auto" }}
                          exit={{ opacity: 0, height: 0 }}
                          transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
                          className="mt-1.5 space-y-1.5 overflow-hidden text-xs text-[#4d4d4d]"
                        >
                          {card.alternates.slice(2).map((alt, i) => (
                            <AlternateRow key={`rest-${i}`} alt={alt} bestDestIata={best.destIata} />
                          ))}
                        </motion.ul>
                      )}
                    </AnimatePresence>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        setShowAlternates((v) => !v);
                      }}
                      className="mt-2 text-xs font-medium text-[#0070f3] transition hover:text-[#0761d1]"
                    >
                      {showAlternates
                        ? "Hide"
                        : `Show ${card.alternates.length - 2} more`}
                    </button>
                  </>
                )}
              </div>
            </>
          )}
        </div>
      </article>
    </motion.div>
  );
}

function AlternateRow({ alt, bestDestIata }: { alt: Offer; bestDestIata: string }) {
  return (
    <li>
      <a
        href={alt.bookingUrl}
        target="_blank"
        rel="noopener noreferrer"
        onClick={(e) => e.stopPropagation()}
        className="flex items-center gap-2 rounded-md border border-[#ebebeb] bg-[#fafafa] px-3 py-2 no-underline transition-colors hover:border-[#a1a1a1] hover:text-[#171717]"
      >
        <span className="shrink-0 font-mono text-[#888888]">
          {formatDate(alt.departDate)}
          {alt.returnDate && ` → ${formatDate(alt.returnDate)}`}
        </span>
        <span className="text-[#ebebeb]">·</span>
        <span className="min-w-0 flex-1 truncate">
          {alt.airline}
          {alt.destIata !== bestDestIata && (
            <span className="ml-1 font-mono text-[10px] text-[#4d4d4d]">
              {alt.destIata}
            </span>
          )}
        </span>
        <span className="shrink-0 font-semibold tabular-nums text-[#171717]">
          {alt.priceDisplay}
        </span>
      </a>
    </li>
  );
}

const VERDICT_STYLE: Record<
  PriceForecast["verdict"],
  { bg: string; border: string; text: string; chip: string; icon: string; label: string }
> = {
  best: {
    bg: "bg-[#ecfdf3]",
    border: "border-[#abefc6]",
    text: "text-[#067647]",
    chip: "bg-[#067647] text-white",
    icon: "✓",
    label: "Best price",
  },
  good: {
    bg: "bg-[#f0fdf4]",
    border: "border-[#bbf7d0]",
    text: "text-[#15803d]",
    chip: "bg-[#15803d] text-white",
    icon: "↓",
    label: "Good price",
  },
  typical: {
    bg: "bg-[#f5f5f5]",
    border: "border-[#e5e5e5]",
    text: "text-[#4d4d4d]",
    chip: "bg-[#525252] text-white",
    icon: "·",
    label: "Typical",
  },
  shift: {
    bg: "bg-[#fffbeb]",
    border: "border-[#fde68a]",
    text: "text-[#a16207]",
    chip: "bg-[#a16207] text-white",
    icon: "⇄",
    label: "Wait — shift dates",
  },
  high: {
    bg: "bg-[#fef2f2]",
    border: "border-[#fecaca]",
    text: "text-[#b91c1c]",
    chip: "bg-[#b91c1c] text-white",
    icon: "↑",
    label: "Above typical",
  },
};

function ForecastBadge({ forecast }: { forecast: PriceForecast }) {
  const s = VERDICT_STYLE[forecast.verdict];
  return (
    <div className={`mb-4 rounded-lg border ${s.border} ${s.bg} px-3 py-2.5`}>
      <div className="flex items-start gap-2.5">
        <span
          className={`mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full ${s.chip} text-[11px] font-bold leading-none`}
          aria-hidden
        >
          {s.icon}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline gap-1.5">
            <span className={`text-[10px] font-bold uppercase tracking-wider ${s.text}`}>
              {s.label}
            </span>
            {forecast.percentile !== null && (
              <span className="text-[10px] text-[#a1a1a1]">
                · {Math.round(forecast.percentile * 100)}th percentile (60d)
              </span>
            )}
          </div>
          <p className={`mt-0.5 text-[13px] font-medium leading-snug ${s.text}`}>
            {forecast.headline}
          </p>
          {forecast.detail && (
            <p className="mt-0.5 text-[11px] leading-snug text-[#4d4d4d]">{forecast.detail}</p>
          )}
        </div>
      </div>
    </div>
  );
}
