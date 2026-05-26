"use client";

import { motion, useReducedMotion } from "motion/react";
import type { ReactNode } from "react";

interface Props {
  children: ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  type?: "button" | "submit";
  ariaLabel?: string;
  className?: string;
  size?: "default" | "sm";
}

/**
 * Liquid glass CTA — frosted pill with specular highlight and soft glow.
 * CSS patterns from crenspire/glass-ui + creativoma/liquid-glass (SVG filters in layout).
 */
export function LiquidGlassButton({
  children,
  onClick,
  disabled,
  type = "button",
  ariaLabel,
  className = "",
  size = "default",
}: Props) {
  const reduceMotion = useReducedMotion();

  return (
    <motion.button
      type={type}
      className={[
        "liquid-glass-button shrink-0 transform-gpu",
        size === "sm" ? "liquid-glass-button-sm" : "",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
      onClick={onClick}
      disabled={disabled}
      aria-label={ariaLabel}
      whileHover={disabled || reduceMotion ? undefined : { y: -1, scale: 1.02 }}
      whileTap={disabled || reduceMotion ? undefined : { scale: 0.98 }}
      transition={{ type: "spring", stiffness: 420, damping: 28 }}
    >
      <span className="liquid-glass-button-label">{children}</span>
    </motion.button>
  );
}
