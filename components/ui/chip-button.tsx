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
      whileHover={reduceMotion ? undefined : { y: -1 }}
      whileTap={reduceMotion ? undefined : { scale: 0.98 }}
      transition={{ type: "spring", stiffness: 400, damping: 30 }}
      className={[
        "btn-vercel-secondary touch-target px-4 py-2.5 text-left sm:text-center",
        className,
      ].join(" ")}
    >
      <span className="font-mono text-[13px] leading-snug text-[#4d4d4d]">{children}</span>
    </motion.button>
  );
}
