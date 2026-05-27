"use client";

import { motion, useReducedMotion } from "motion/react";

/**
 * Animated fullscreen backdrop for the search-loading phase.
 *
 * Composition:
 *   - 5 large, heavily-blurred coloured bokeh circles drifting on independent
 *     orbits — provides the soft depth-of-field look.
 *   - One SVG sine wave with a Gaussian-blur filter, slowly translating
 *     horizontally — the "waves" the user asked for.
 *   - All animation is GPU-friendly (transform + opacity only) and is disabled
 *     when prefers-reduced-motion is set.
 *
 * Rendered fixed-position behind the page content with `-z-10`.
 */

interface BokehSpec {
  size: string;         // tailwind size class (e.g. "h-[55vh] w-[55vh]")
  color: string;        // tailwind bg color (e.g. "bg-sky-400/40")
  top: string;
  left: string;
  duration: number;     // seconds for one orbit
  delay: number;        // start offset
  driftX: number;       // px on x-axis
  driftY: number;       // px on y-axis
}

const BOKEH: BokehSpec[] = [
  { size: "h-[55vh] w-[55vh]", color: "bg-sky-400/40",     top: "-12%", left: "-8%",  duration: 28, delay: 0,   driftX: 240, driftY: 140 },
  { size: "h-[48vh] w-[48vh]", color: "bg-indigo-400/35",  top: "20%",  left: "55%",  duration: 34, delay: 2.5, driftX: -220, driftY: 180 },
  { size: "h-[40vh] w-[40vh]", color: "bg-rose-300/30",    top: "55%",  left: "-12%", duration: 31, delay: 5,   driftX: 180, driftY: -160 },
  { size: "h-[42vh] w-[42vh]", color: "bg-amber-300/30",   top: "60%",  left: "50%",  duration: 38, delay: 1.5, driftX: -200, driftY: -140 },
  { size: "h-[35vh] w-[35vh]", color: "bg-violet-400/30",  top: "10%",  left: "30%",  duration: 26, delay: 4,   driftX: 160, driftY: 220 },
];

export function LoadingBackdrop() {
  const reduceMotion = useReducedMotion();

  if (reduceMotion) {
    // Honour the user preference — show a static gradient instead.
    return (
      <div
        className="pointer-events-none fixed inset-0 overflow-hidden"
        aria-hidden
        style={{
          zIndex: 0,
          background:
            "radial-gradient(ellipse at 20% 20%, rgba(56,189,248,0.18), transparent 60%), radial-gradient(ellipse at 80% 60%, rgba(139,92,246,0.18), transparent 60%)",
        }}
      />
    );
  }

  return (
    <div className="pointer-events-none fixed inset-0 overflow-hidden" style={{ zIndex: 0 }} aria-hidden>
      {/* Bokeh circles — heavy blur gives the dreamy depth-of-field look */}
      {BOKEH.map((b, i) => (
        <motion.div
          key={i}
          className={`absolute rounded-full ${b.size} ${b.color} blur-3xl will-change-transform`}
          style={{ top: b.top, left: b.left }}
          initial={{ x: 0, y: 0, scale: 1 }}
          animate={{
            x: [0, b.driftX, b.driftX * 0.4, -b.driftX * 0.6, 0],
            y: [0, b.driftY, -b.driftY * 0.5, b.driftY * 0.3, 0],
            scale: [1, 1.15, 0.95, 1.08, 1],
          }}
          transition={{
            duration: b.duration,
            delay: b.delay,
            repeat: Infinity,
            ease: "easeInOut",
          }}
        />
      ))}

      {/* Wave SVG — Gaussian-blur filter softens the line into a soft motion-blur band */}
      <svg
        className="absolute inset-x-0 bottom-[5%] h-[40vh] w-[200%] opacity-50"
        viewBox="0 0 1200 200"
        preserveAspectRatio="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          <linearGradient id="wave-grad" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="#7dd3fc" stopOpacity="0" />
            <stop offset="40%" stopColor="#a78bfa" stopOpacity="0.55" />
            <stop offset="100%" stopColor="#fb7185" stopOpacity="0" />
          </linearGradient>
          <filter id="wave-blur" x="-10%" y="-50%" width="120%" height="200%">
            <feGaussianBlur stdDeviation="14" />
          </filter>
        </defs>
        <motion.path
          d="M0,100 C200,40 400,160 600,100 C800,40 1000,160 1200,100 L1200,200 L0,200 Z"
          fill="url(#wave-grad)"
          filter="url(#wave-blur)"
          animate={{ x: [0, -600, 0] }}
          transition={{ duration: 22, repeat: Infinity, ease: "linear" }}
        />
        <motion.path
          d="M0,120 C250,60 450,180 700,120 C950,60 1150,180 1400,120 L1400,200 L0,200 Z"
          fill="url(#wave-grad)"
          filter="url(#wave-blur)"
          style={{ opacity: 0.5 }}
          animate={{ x: [0, 400, 0] }}
          transition={{ duration: 18, repeat: Infinity, ease: "linear" }}
        />
      </svg>
    </div>
  );
}
