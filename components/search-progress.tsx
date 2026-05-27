"use client";

import { motion, AnimatePresence, useReducedMotion } from "motion/react";
import { LoadingBackdrop } from "./loading-backdrop";

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
    <>
      <LoadingBackdrop />
      <div
        className="mx-auto w-full max-w-lg rounded-2xl border border-white/40 bg-white/55 px-5 py-6 shadow-[0_1px_2px_rgba(0,0,0,0.04),0_8px_32px_rgba(0,0,0,0.06)] backdrop-blur-2xl sm:px-8 sm:py-8"
      >
        <div className="mb-5 flex items-center justify-between gap-4">
          <p className="type-caption-mono text-[#525252]">Searching</p>
          <motion.span
            key={pct}
            initial={reduceMotion ? false : { opacity: 0.6 }}
            animate={{ opacity: 1 }}
            className="font-mono text-sm tabular-nums text-[#171717]"
          >
            {pct}%
          </motion.span>
        </div>

        <div className="mb-5 h-1 overflow-hidden rounded-full bg-[#ebebeb]/70">
          <motion.div
            className="h-full rounded-full bg-gradient-to-r from-sky-500 via-violet-500 to-rose-500"
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
            className="text-center text-sm font-medium leading-relaxed tracking-[-0.02em] text-[#171717] sm:text-[15px]"
          >
            {message}
          </motion.p>
        </AnimatePresence>

        {currentLabel && (
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="mt-2 text-center font-mono text-xs text-[#525252]"
          >
            {currentLabel}
          </motion.p>
        )}

        {destinations.length > 0 && (
          <div className="mt-5 flex flex-wrap justify-center gap-2">
            {destinations.map((d) => (
              <span
                key={d}
                className="inline-flex items-center rounded-full border border-white/60 bg-white/60 px-3 py-1 text-xs font-medium text-[#171717] backdrop-blur"
              >
                {d}
              </span>
            ))}
          </div>
        )}

        <p className="mt-4 text-center text-xs text-[#525252]">
          {succeeded} of {total} routes checked
        </p>
      </div>
    </>
  );
}
