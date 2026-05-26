"use client";

import { motion } from "motion/react";
import type { Card, SearchStats } from "@/lib/types";
import { GlassSurface } from "./ui/glass-surface";

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
      <GlassSurface
        variant="pill"
        className="mx-auto max-w-2xl px-5 py-3.5 text-center"
      >
        <div className="text-sm sm:text-[15px] text-neutral-600">
          <span className="inline-flex flex-wrap items-center justify-center gap-x-1">
            <span>
              <span className="font-bold text-neutral-900">{cards.length}</span>
              {cards.length === 1 ? " destination" : " destinations"} from{" "}
              <span className="font-bold text-neutral-900">{originDisplay}</span>
            </span>
            {isFlex && (
              <span className="text-neutral-500">
                · cheapest across {stats.dateCombos} date options
              </span>
            )}
          </span>
        </div>

        {showSpread && (
          <details className="mt-3 text-xs text-neutral-500">
            <summary className="cursor-pointer hover:text-neutral-800 transition font-medium list-none">
              How we know it&apos;s the cheapest
            </summary>
            <ul className="mt-2.5 space-y-1.5 text-left max-h-40 overflow-y-auto">
              {cards.map((c) => {
                if (c.combosSucceeded < 2 || c.priceMax <= c.priceMin) return null;
                const pct = ((c.priceMax - c.priceMin) / c.priceMin) * 100;
                return (
                  <li key={c.destLabel} className="glass-pill !rounded-2xl px-3 py-2">
                    <strong className="text-neutral-800">{c.destLabel}</strong>: checked{" "}
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
      </GlassSurface>
    </motion.div>
  );
}
