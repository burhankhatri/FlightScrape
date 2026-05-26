"use client";

import { motion, useReducedMotion } from "motion/react";
import { forwardRef, useState, type ReactNode } from "react";

type Variant = "default" | "strong" | "pill";

const variantClass: Record<Variant, string> = {
  default: "glass",
  strong: "glass-strong",
  pill: "glass-pill",
};

export interface GlassSurfaceProps
  extends Omit<React.ComponentPropsWithoutRef<typeof motion.div>, "children"> {
  variant?: Variant;
  interactive?: boolean;
  children?: ReactNode;
}

export const GlassSurface = forwardRef<HTMLDivElement, GlassSurfaceProps>(
  function GlassSurface(
    {
      variant = "default",
      interactive = false,
      className = "",
      children,
      ...props
    },
    ref,
  ) {
    const reduceMotion = useReducedMotion();
    const [sheen, setSheen] = useState(false);

    return (
      <motion.div
        ref={ref}
        className={[
          variantClass[variant],
          interactive ? "glass-hover-lift" : "",
          "relative overflow-hidden transform-gpu w-full",
        ]
          .filter(Boolean)
          .join(" ")}
        onHoverStart={() => !reduceMotion && interactive && setSheen(true)}
        onHoverEnd={() => setSheen(false)}
        {...props}
      >
        {interactive && !reduceMotion && (
          <motion.div
            aria-hidden
            className="glass-sheen pointer-events-none absolute inset-0 z-[1] rounded-[inherit]"
            initial={{ x: "-130%", opacity: 0 }}
            animate={
              sheen
                ? { x: "130%", opacity: 1 }
                : { x: "-130%", opacity: 0 }
            }
            transition={{ duration: 0.65, ease: [0.22, 1, 0.36, 1] }}
          />
        )}
        {/* Layout classes (flex, padding, etc.) go here — NOT on the outer shell */}
        <div className={["relative z-[2] w-full", className].filter(Boolean).join(" ")}>
          {children}
        </div>
      </motion.div>
    );
  },
);

GlassSurface.displayName = "GlassSurface";
