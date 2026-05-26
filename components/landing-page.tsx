"use client";

import Link from "next/link";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useEffect, useState } from "react";
import { ArrowRight } from "@/components/sf-icons";

const spring = { type: "spring" as const, stiffness: 260, damping: 28 };

const EXAMPLE_QUERIES = [
  "cheapest flights to Bali in March",
  "Tokyo and Seoul for two weeks in April",
  "Europe under $600 in September",
  "direct flights to Lisbon from NYC",
] as const;

const FEATURES = [
  {
    n: "01",
    title: "Natural language",
    body: "Describe the trip like you would to a friend.",
  },
  {
    n: "02",
    title: "Parallel search",
    body: "We test dates and routes across Google Flights and Amadeus.",
  },
  {
    n: "03",
    title: "Live results",
    body: "Cards stream in — one best price per destination.",
  },
] as const;

const HEADLINE = ["Find", "flights", "in", "plain", "English."];

const container = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.07, delayChildren: 0.12 },
  },
};

const word = {
  hidden: { opacity: 0, y: 22, filter: "blur(8px)" },
  visible: {
    opacity: 1,
    y: 0,
    filter: "blur(0px)",
    transition: { duration: 0.55, ease: [0.22, 1, 0.36, 1] },
  },
};

const fadeUp = {
  hidden: { opacity: 0, y: 16 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.5, ease: [0.22, 1, 0.36, 1] },
  },
};

function CyclingQuery({ reduceMotion }: { reduceMotion: boolean | null }) {
  const [index, setIndex] = useState(0);

  useEffect(() => {
    if (reduceMotion) return;
    const id = window.setInterval(() => {
      setIndex((i) => (i + 1) % EXAMPLE_QUERIES.length);
    }, 3200);
    return () => window.clearInterval(id);
  }, [reduceMotion]);

  const query = EXAMPLE_QUERIES[reduceMotion ? 0 : index];

  return (
    <div className="mt-10 w-full max-w-md">
      <p className="type-caption-mono mb-2 text-[#888888]">Example query</p>
      <div className="relative min-h-[3rem] overflow-hidden rounded-md border border-[#ebebeb] bg-white px-4 py-3 shadow-[0_1px_1px_#00000005,0_2px_2px_#0000000a]">
        <AnimatePresence mode="wait">
          <motion.p
            key={query}
            initial={reduceMotion ? false : { opacity: 0, y: 10, filter: "blur(4px)" }}
            animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
            exit={reduceMotion ? undefined : { opacity: 0, y: -8, filter: "blur(4px)" }}
            transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
            className="font-mono text-[13px] leading-5 text-[#171717]"
          >
            &ldquo;{query}&rdquo;
          </motion.p>
        </AnimatePresence>
        {!reduceMotion && (
          <motion.span
            aria-hidden
            className="absolute bottom-3 right-4 h-4 w-px bg-[#171717]"
            animate={{ opacity: [1, 1, 0, 0] }}
            transition={{ duration: 1, repeat: Infinity, times: [0, 0.45, 0.5, 1] }}
          />
        )}
      </div>
    </div>
  );
}

export function LandingPage() {
  const reduceMotion = useReducedMotion();
  const motionOff = !!reduceMotion;

  return (
    <div className="landing-shell page-shell flex min-h-[100dvh] flex-col">
      <header className="page-container pt-2 sm:pt-4">
        <motion.p
          initial={motionOff ? false : { opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.6 }}
          className="text-sm font-medium tracking-[-0.02em] text-[#4d4d4d]"
        >
          Flighthelper
        </motion.p>
      </header>

      <main className="page-container flex flex-1 flex-col justify-center py-12 sm:py-16">
        <div className="mx-auto w-full max-w-2xl">
          <motion.div
            variants={motionOff ? undefined : container}
            initial={motionOff ? false : "hidden"}
            animate={motionOff ? undefined : "visible"}
          >
            <h1 className="sf-display type-hero text-balance text-[#171717]">
              {HEADLINE.map((w, i) => (
                <motion.span
                  key={`${w}-${i}`}
                  variants={motionOff ? undefined : word}
                  className="mr-[0.28em] inline-block last:mr-0"
                >
                  {w}
                </motion.span>
              ))}
            </h1>

            <motion.p
              variants={motionOff ? undefined : fadeUp}
              className="mt-6 max-w-lg text-base leading-7 text-[#4d4d4d] sm:text-lg"
            >
              Describe your trip once. We compare dates, routes, and providers —
              then surface the cheapest deal per destination.
            </motion.p>

            <motion.div variants={motionOff ? undefined : fadeUp}>
              <CyclingQuery reduceMotion={reduceMotion} />
            </motion.div>

            <motion.div
              variants={motionOff ? undefined : fadeUp}
              className="mt-10 flex flex-col items-start gap-4 sm:flex-row sm:items-center"
            >
              <motion.div
                whileHover={motionOff ? undefined : { y: -2 }}
                whileTap={motionOff ? undefined : { scale: 0.98 }}
                transition={spring}
              >
                <Link
                  href="/flights"
                  className="group inline-flex h-12 items-center gap-2 rounded-full bg-[#171717] px-6 text-base font-medium text-white no-underline transition-colors hover:bg-[#383838]"
                >
                  Start searching
                  <motion.span
                    className="inline-flex"
                    initial={false}
                    animate={motionOff ? undefined : { x: [0, 3, 0] }}
                    transition={{ duration: 1.6, repeat: Infinity, ease: "easeInOut" }}
                  >
                    <ArrowRight className="h-4 w-4" />
                  </motion.span>
                </Link>
              </motion.div>
              <Link
                href="/flights"
                className="text-sm tracking-[-0.02em] text-[#4d4d4d] transition-colors hover:text-[#171717]"
              >
                View example searches
              </Link>
            </motion.div>
          </motion.div>

          <motion.ul
            initial={motionOff ? false : { opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true, margin: "-40px" }}
            transition={{ duration: 0.6, delay: 0.15 }}
            className="mt-20 divide-y divide-[#ebebeb] border-t border-[#ebebeb]"
          >
            {FEATURES.map(({ n, title, body }, i) => (
              <motion.li
                key={n}
                initial={motionOff ? false : { opacity: 0, x: -12 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true, margin: "-20px" }}
                transition={{ delay: i * 0.08, duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
                className="grid grid-cols-[3rem_1fr] gap-x-4 gap-y-1 py-5 sm:grid-cols-[4rem_1fr] sm:gap-x-6"
              >
                <span className="type-caption-mono text-[#888888]">{n}</span>
                <div>
                  <h2 className="text-base font-semibold tracking-[-0.02em] text-[#171717]">
                    {title}
                  </h2>
                  <p className="mt-1 text-sm leading-5 tracking-[-0.02em] text-[#4d4d4d]">
                    {body}
                  </p>
                </div>
              </motion.li>
            ))}
          </motion.ul>
        </div>
      </main>

      <footer className="page-container pb-8 pt-4">
        <motion.p
          initial={motionOff ? false : { opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          className="text-center text-xs leading-4 text-[#888888]"
        >
          Made for travellers who hate spreadsheets.
        </motion.p>
      </footer>
    </div>
  );
}
