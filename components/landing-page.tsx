"use client";

import Image from "next/image";
import Link from "next/link";
import { motion, useReducedMotion } from "motion/react";
import {
  Airplane,
  ArrowLeftRight,
  ArrowRight,
  Calendar,
  Clock,
  MagnifyingGlass,
  Sparkles,
} from "@/components/sf-icons";
import { GlassSurface } from "@/components/ui/glass-surface";

/** Soft, airy hero — matches cool blue/lavender theme */
const HERO_IMAGE =
  "https://images.unsplash.com/photo-1436491865332-7a61a109cc05?w=1200&q=80&auto=format&fit=crop";

const spring = { type: "spring" as const, stiffness: 300, damping: 22 };

const heroContainer = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.12, delayChildren: 0.08 },
  },
};

const heroItem = {
  hidden: { opacity: 0, y: 28 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.65, ease: [0.22, 1, 0.36, 1] },
  },
};

const featuresContainer = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.1, delayChildren: 0.05 },
  },
};

const featureCard = {
  hidden: { opacity: 0, y: 24, scale: 0.96 },
  visible: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: spring,
  },
};

const FEATURES = [
  {
    icon: Sparkles,
    title: "Natural language",
    description:
      "Type how you'd tell a friend — \"cheapest flights to Bali in March\" or \"Japan and Korea for two weeks in July.\"",
  },
  {
    icon: ArrowLeftRight,
    title: "Smart comparison",
    description:
      "We fan out across Google Flights and Amadeus, testing dozens of date and route combinations in parallel.",
  },
  {
    icon: Clock,
    title: "Instant results",
    description:
      "Live streaming cards as prices land — one best deal per destination, sorted cheapest first.",
  },
] as const;

const STEPS = [
  {
    icon: MagnifyingGlass,
    title: "Describe your trip",
    body: "Pick your home airport, then write your trip in plain English.",
  },
  {
    icon: Calendar,
    title: "We parse & search",
    body: "Claude extracts dates and destinations; we query every combo that matters.",
  },
  {
    icon: Airplane,
    title: "Book the winner",
    body: "Tap a card to open Google Flights pre-filled with your exact route.",
  },
] as const;

export function LandingPage() {
  const reduceMotion = useReducedMotion();

  const motionProps = reduceMotion
    ? { initial: false as const, animate: undefined }
    : {};

  return (
    <div className="page-shell min-h-[100dvh]">
      {/* Hero */}
      <section className="relative pt-4 sm:pt-10 pb-12 sm:pb-20 overflow-hidden">
        <div className="page-container">
          <motion.div
            variants={reduceMotion ? undefined : heroContainer}
            initial={reduceMotion ? false : "hidden"}
            animate={reduceMotion ? undefined : "visible"}
            className="grid lg:grid-cols-2 gap-8 sm:gap-10 lg:gap-14 items-center"
          >
            <div className="text-center lg:text-left order-2 lg:order-1">
              <motion.p
                variants={reduceMotion ? undefined : heroItem}
                className="type-caption font-medium uppercase tracking-[0.18em] text-sky-700/80 mb-4"
              >
                Flighthelper
              </motion.p>

              <motion.h1
                variants={reduceMotion ? undefined : heroItem}
                className="sf-display type-hero text-neutral-900 text-balance"
              >
                Find the perfect flight,{" "}
                <span className="bg-gradient-to-r from-sky-600 via-indigo-500 to-violet-500 bg-clip-text text-transparent">
                  naturally.
                </span>
              </motion.h1>

              <motion.p
                variants={reduceMotion ? undefined : heroItem}
                className="mt-5 text-base sm:text-lg text-neutral-600 text-balance leading-relaxed max-w-xl mx-auto lg:mx-0"
              >
                No endless filters. Describe your trip once — we compare prices
                across dates, routes, and providers, then surface the best deal
                per destination.
              </motion.p>

              <motion.div
                variants={reduceMotion ? undefined : heroItem}
                className="mt-8 flex flex-col sm:flex-row items-center justify-center lg:justify-start gap-3"
              >
                <motion.div
                  whileHover={reduceMotion ? undefined : { y: -2, scale: 1.02 }}
                  whileTap={reduceMotion ? undefined : { scale: 0.98 }}
                  transition={spring}
                >
                  <Link
                    href="/flights"
                    className="liquid-glass-button touch-target inline-flex items-center justify-center gap-2 no-underline text-inherit w-full xs:w-auto min-w-[12rem]"
                  >
                    <span className="liquid-glass-button-label">
                      Start searching
                      <ArrowRight className="w-4 h-4 inline-block ml-0.5" />
                    </span>
                  </Link>
                </motion.div>
                <Link
                  href="/flights"
                  className="text-sm font-medium text-neutral-600 hover:text-neutral-900 transition-colors"
                >
                  See example queries →
                </Link>
              </motion.div>

              <motion.ul
                variants={reduceMotion ? undefined : heroItem}
                className="mt-10 flex flex-wrap justify-center lg:justify-start gap-x-6 gap-y-2 text-[13px] text-neutral-500"
              >
                <li className="flex items-center gap-1.5">
                  <Sparkles className="w-4 h-4 text-sky-600/70" />
                  Natural language
                </li>
                <li className="flex items-center gap-1.5">
                  <ArrowLeftRight className="w-4 h-4 text-sky-600/70" />
                  Google + Amadeus
                </li>
                <li className="flex items-center gap-1.5">
                  <Airplane className="w-4 h-4 text-sky-600/70 -rotate-45" />
                  6,000+ airports
                </li>
              </motion.ul>
            </div>

            <motion.div
              variants={reduceMotion ? undefined : heroItem}
              className="order-1 lg:order-2 relative"
              {...motionProps}
            >
              <GlassSurface variant="default" className="p-3 sm:p-4">
                <div className="relative aspect-[4/3] w-full overflow-hidden rounded-2xl">
                  <Image
                    src={HERO_IMAGE}
                    alt="View from an airplane window above clouds"
                    fill
                    priority
                    sizes="(max-width: 1024px) 100vw, 50vw"
                    className="object-cover image-feather-card"
                  />
                  <motion.div
                    className="absolute bottom-3 sm:bottom-4 left-3 right-3 sm:left-4 sm:right-4"
                    initial={reduceMotion ? false : { opacity: 0, y: 16 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.5, duration: 0.5 }}
                  >
                    <div className="glass-pill px-4 py-3 flex items-center gap-3">
                      <span className="glass-icon-orb shrink-0">
                        <Airplane className="w-5 h-5 -rotate-45 text-sky-700" />
                      </span>
                      <div className="min-w-0 text-left">
                        <p className="text-xs font-medium text-neutral-500">
                          Example query
                        </p>
                        <p className="text-xs sm:text-sm text-neutral-800 line-clamp-2 sm:line-clamp-1 italic">
                          cheapest flights to KL in july for 2 weeks
                        </p>
                      </div>
                    </div>
                  </motion.div>
                </div>
              </GlassSurface>

              {!reduceMotion && (
                <motion.div
                  aria-hidden
                  className="absolute -z-10 -top-8 -right-8 w-48 h-48 rounded-full bg-sky-300/25 blur-3xl"
                  animate={{ scale: [1, 1.15, 1], opacity: [0.4, 0.6, 0.4] }}
                  transition={{ duration: 6, repeat: Infinity, ease: "easeInOut" }}
                />
              )}
            </motion.div>
          </motion.div>
        </div>
      </section>

      {/* Features */}
      <section
        aria-labelledby="features-heading"
        className="py-12 sm:py-20"
      >
        <div className="page-container">
          <motion.div
            initial={reduceMotion ? false : { opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.3 }}
            transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
            className="text-center mb-10 sm:mb-12"
          >
            <h2
              id="features-heading"
              className="sf-display type-section text-neutral-900 text-balance"
            >
              Built for real trip planning
            </h2>
            <p className="mt-3 text-neutral-600 max-w-xl mx-auto text-balance">
              Flexible dates, multiple destinations, one conversation — not
              twelve separate searches.
            </p>
          </motion.div>

          <motion.div
            variants={reduceMotion ? undefined : featuresContainer}
            initial={reduceMotion ? false : "hidden"}
            whileInView={reduceMotion ? undefined : "visible"}
            viewport={{ once: true, amount: 0.2 }}
            className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-5"
          >
            {FEATURES.map(({ icon: Icon, title, description }) => (
              <motion.div
                key={title}
                variants={reduceMotion ? undefined : featureCard}
                className="h-full"
              >
                <GlassSurface interactive className="flex h-full flex-col p-6 sm:p-7">
                  <span className="glass-icon-orb mb-4">
                    <Icon className="w-5 h-5 text-sky-700" />
                  </span>
                  <h3 className="sf-display text-lg text-neutral-900 mb-2">
                    {title}
                  </h3>
                  <p className="text-[14px] text-neutral-600 leading-relaxed">
                    {description}
                  </p>
                </GlassSurface>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* How it works */}
      <section
        aria-labelledby="how-heading"
        className="py-12 sm:py-16 border-t border-white/40"
      >
        <div className="page-container">
          <motion.h2
            id="how-heading"
            initial={reduceMotion ? false : { opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.5 }}
            className="sf-display type-section text-neutral-900 text-center mb-8 sm:mb-10"
          >
            How it works
          </motion.h2>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-8 sm:gap-6 md:gap-8">
            {STEPS.map(({ icon: Icon, title, body }, i) => (
              <motion.div
                key={title}
                initial={reduceMotion ? false : { opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, amount: 0.3 }}
                transition={{ delay: i * 0.08, duration: 0.5 }}
                className="flex flex-col items-center text-center"
              >
                <motion.div
                  whileHover={reduceMotion ? undefined : { scale: 1.08, rotate: 3 }}
                  transition={spring}
                  className="glass-icon-orb w-14 h-14 mb-4"
                >
                  <Icon className="w-6 h-6 text-sky-700" />
                </motion.div>
                <h3 className="font-semibold text-neutral-900 mb-2">{title}</h3>
                <p className="text-sm text-neutral-600 leading-relaxed max-w-xs">
                  {body}
                </p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="pb-12 sm:pb-20">
        <motion.div
          initial={reduceMotion ? false : { opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.4 }}
          transition={{ duration: 0.55 }}
          className="mx-auto max-w-3xl"
        >
          <GlassSurface
            variant="strong"
            className="!rounded-3xl sm:!rounded-[2.5rem] px-5 py-8 sm:px-8 sm:py-12 text-center"
          >
            <Airplane
              className="w-10 h-10 text-sky-600/80 mx-auto mb-4 -rotate-45"
              aria-hidden
            />
            <h2 className="sf-display type-section text-neutral-900 text-balance">
              Ready to find your next trip?
            </h2>
            <p className="mt-3 text-neutral-600 text-balance">
              Open the search — pick your airport, describe where you want to go,
              and let us do the rest.
            </p>
            <motion.div
              className="mt-8 inline-block"
              whileHover={reduceMotion ? undefined : { y: -2, scale: 1.02 }}
              whileTap={reduceMotion ? undefined : { scale: 0.98 }}
              transition={spring}
            >
              <Link
                href="/flights"
                className="liquid-glass-button touch-target inline-flex items-center justify-center gap-2 no-underline text-inherit w-full sm:w-auto min-w-[12rem]"
              >
                <span className="liquid-glass-button-label">
                  Go to flight search
                  <ArrowRight className="w-4 h-4" />
                </span>
              </Link>
            </motion.div>
          </GlassSurface>
        </motion.div>

        <footer className="mt-12 text-center type-caption">
          Made for travellers who hate spreadsheets.
        </footer>
      </section>
    </div>
  );
}
