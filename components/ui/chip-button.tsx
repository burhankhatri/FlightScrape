"use client";

import { motion, useReducedMotion } from "motion/react";
import type { ReactNode } from "react";

interface Props {
  children: ReactNode;
  onClick?: () => void;
  className?: string;
}

export function ChipButton({ children, onClick, className = "" }: Props) {
  const reduceMotion = useReducedMotion();

  return (
    <motion.button
      type="button"
      onClick={onClick}
      whileHover={reduceMotion ? undefined : { y: -2 }}
      whileTap={reduceMotion ? undefined : { scale: 0.98 }}
      transition={{ type: "spring", stiffness: 400, damping: 30 }}
      className={[
        "glass-pill glass-hover-lift touch-target px-4 py-3 sm:py-2.5",
        "text-sm text-neutral-600 hover:text-neutral-900 transition-colors",
        "cursor-pointer transform-gpu inline-flex items-center justify-center",
        className,
      ].join(" ")}
    >
      {children}
    </motion.button>
  );
}
