"use client";

import { motion, AnimatePresence, useReducedMotion } from "motion/react";
import { GlassSurface } from "./ui/glass-surface";

interface Props {
  message: string;
  progress: number;
  succeeded: number;
  total: number;
  destinations: string[];
  currentLabel?: string;
}

export function SearchProgress({
  message,
  progress,
  succeeded,
  total,
  destinations,
  currentLabel,
}: Props) {
  const reduceMotion = useReducedMotion();
  const pct = Math.min(100, Math.round(progress * 100));

  return (
    <GlassSurface className="w-full max-w-lg mx-auto px-4 py-6 sm:px-8 sm:py-9 !rounded-2xl sm:!rounded-[2.5rem]">
      <div className="flex justify-center mb-6">
        <div className="relative w-16 h-16">
          <div className="absolute inset-0 liquid-glass-orb" aria-hidden />
          <div className="absolute inset-[6px] rounded-full glass-strong flex items-center justify-center z-10">
            <motion.span
              key={pct}
              initial={reduceMotion ? false : { scale: 0.9, opacity: 0.6 }}
              animate={{ scale: 1, opacity: 1 }}
              className="text-xs font-bold tabular-nums text-neutral-800"
            >
              {pct}%
            </motion.span>
          </div>
        </div>
      </div>

      <div className="h-1.5 rounded-full bg-white/50 overflow-hidden mb-5">
        <motion.div
          className="h-full rounded-full bg-gradient-to-r from-sky-400/70 to-indigo-400/80"
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ type: "spring", stiffness: 120, damping: 22 }}
        />
      </div>

      <AnimatePresence mode="wait">
        <motion.p
          key={message}
          initial={reduceMotion ? false : { opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          exit={reduceMotion ? undefined : { opacity: 0, y: -6 }}
          transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
          className="text-sm sm:text-[15px] text-neutral-700 text-center font-medium leading-relaxed"
        >
          {message}
        </motion.p>
      </AnimatePresence>

      {currentLabel && (
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="text-xs text-neutral-400 text-center mt-2 font-mono"
        >
          {currentLabel}
        </motion.p>
      )}

      <div className="mt-5 flex flex-wrap justify-center gap-2">
        {destinations.map((d) => (
          <span key={d} className="glass-pill px-3 py-1 text-xs text-neutral-600">
            {d}
          </span>
        ))}
      </div>

      <p className="text-[11px] text-neutral-400 text-center mt-4">
        {succeeded} of {total} routes checked
      </p>
    </GlassSurface>
  );
}
