"use client";

import { motion, useReducedMotion } from "motion/react";

/**
 * Premium minimalist bokeh backdrop for the loading state.
 *
 * Design notes:
 *   - Monochrome only. The rest of the site is black/gray/white (#171717,
 *     #525252, #888888, #ebebeb, #fafafa) so the loader must match.
 *   - Three large soft black-tinted circles at 6-10% opacity, drifting on
 *     independent orbits. Heavy blur (blur-3xl) sells the bokeh depth-of-field
 *     look without painting the page in colour.
 *   - Slow, GPU-friendly transforms only. Honours prefers-reduced-motion.
 *   - No waves, no rainbows. Restraint is the point.
 */

interface BokehSpec {
  size: string;
  opacity: number;
  top: string;
  left: string;
  duration: number;
  delay: number;
  driftX: number;
  driftY: number;
}

const BOKEH: BokehSpec[] = [
  { size: "h-[60vh] w-[60vh]", opacity: 0.10, top: "-14%",  left: "-12%", duration: 38, delay: 0,   driftX: 180, driftY: 120 },
  { size: "h-[52vh] w-[52vh]", opacity: 0.08, top: "30%",   left: "55%",  duration: 44, delay: 4,   driftX: -200, driftY: 160 },
  { size: "h-[45vh] w-[45vh]", opacity: 0.07, top: "55%",   left: "-8%",  duration: 36, delay: 8,   driftX: 160, driftY: -140 },
  { size: "h-[40vh] w-[40vh]", opacity: 0.06, top: "5%",    left: "30%",  duration: 32, delay: 2,   driftX: 140, driftY: 200 },
];

export function LoadingBackdrop() {
  const reduceMotion = useReducedMotion();

  if (reduceMotion) {
    return (
      <div
        className="pointer-events-none fixed inset-0 overflow-hidden"
        aria-hidden
        style={{
          zIndex: 0,
          background:
            "radial-gradient(ellipse at 25% 25%, rgba(0,0,0,0.06), transparent 60%), radial-gradient(ellipse at 75% 70%, rgba(0,0,0,0.05), transparent 60%)",
        }}
      />
    );
  }

  return (
    <div
      className="pointer-events-none fixed inset-0 overflow-hidden"
      style={{ zIndex: 0 }}
      aria-hidden
    >
      {BOKEH.map((b, i) => (
        <motion.div
          key={i}
          className={`absolute rounded-full ${b.size} blur-3xl will-change-transform`}
          style={{
            top: b.top,
            left: b.left,
            backgroundColor: `rgba(23,23,23,${b.opacity})`,
          }}
          initial={{ x: 0, y: 0, scale: 1 }}
          animate={{
            x: [0, b.driftX, b.driftX * 0.3, -b.driftX * 0.6, 0],
            y: [0, b.driftY, -b.driftY * 0.4, b.driftY * 0.2, 0],
            scale: [1, 1.12, 0.96, 1.06, 1],
          }}
          transition={{
            duration: b.duration,
            delay: b.delay,
            repeat: Infinity,
            ease: "easeInOut",
          }}
        />
      ))}
    </div>
  );
}
