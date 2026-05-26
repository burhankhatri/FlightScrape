"use client";

import { motion } from "motion/react";
import type { Card, SearchStats } from "@/lib/types";

interface Props {
  cards: Card[];
  stats: SearchStats;
  originDisplay: string;
}

export function StatsBar({ cards, stats, originDisplay }: Props) {
  if (cards.length === 0) return null;

  const isFlex = stats.dateCombos > 1;
  const showSpread = isFlex && cards.some((c) => c.combosSucceeded >= 2);

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.05, duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
    >
      <div className="vercel-surface mx-auto max-w-2xl px-4 py-3 sm:px-5 sm:py-3.5 text-center">
        <div className="text-sm tracking-[-0.02em] text-[#4d4d4d]">
          <span className="inline-flex flex-wrap items-center justify-center gap-x-1">
            <span>
              <span className="font-semibold text-[#171717]">{cards.length}</span>
              {cards.length === 1 ? " destination" : " destinations"} from{" "}
              <span className="font-semibold text-[#171717]">{originDisplay}</span>
            </span>
            {isFlex && (
              <span className="text-[#888888]">
                · cheapest across {stats.dateCombos} date options
              </span>
            )}
          </span>
        </div>

        {showSpread && (
          <details className="mt-3 text-xs text-[#888888]">
            <summary className="cursor-pointer font-medium list-none transition hover:text-[#171717]">
              How we know it&apos;s the cheapest
            </summary>
            <ul className="mt-2.5 max-h-40 space-y-1.5 overflow-y-auto text-left">
              {cards.map((c) => {
                if (c.combosSucceeded < 2 || c.priceMax <= c.priceMin) return null;
                const pct = ((c.priceMax - c.priceMin) / c.priceMin) * 100;
                return (
                  <li
                    key={c.destLabel}
                    className="rounded-md border border-[#ebebeb] bg-[#fafafa] px-3 py-2 text-[#4d4d4d]"
                  >
                    <strong className="text-[#171717]">{c.destLabel}</strong>: checked{" "}
                    {c.combosSucceeded} options
                    {c.combosTried > c.combosSucceeded &&
                      ` (${c.combosTried - c.combosSucceeded} timed out)`}
                    · range ${Math.round(c.priceMin).toLocaleString()}–$
                    {Math.round(c.priceMax).toLocaleString()} (spread {pct.toFixed(0)}%) · picked
                    the cheapest
                  </li>
                );
              })}
            </ul>
          </details>
        )}
      </div>
    </motion.div>
  );
}
