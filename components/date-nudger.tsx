"use client";

import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useCallback, useState } from "react";
import type { Offer } from "@/lib/types";

interface Props {
  baseline: Offer;
  adults: number;
}

interface Probe {
  shift: number;            // days applied to both depart and return
  loading: boolean;
  offer: Offer | null;      // null = no inventory
  error?: string;
}

const SHIFTS = [-3, -2, -1, 1, 2, 3] as const;

function addDays(iso: string, days: number): string {
  const t = Date.UTC(
    parseInt(iso.slice(0, 4), 10),
    parseInt(iso.slice(5, 7), 10) - 1,
    parseInt(iso.slice(8, 10), 10),
  );
  return new Date(t + days * 86_400_000).toISOString().slice(0, 10);
}

function formatShortDate(iso: string): string {
  const d = new Date(iso + "T00:00:00Z");
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });
}

export function DateNudger({ baseline, adults }: Props) {
  const [open, setOpen] = useState(false);
  const [probes, setProbes] = useState<Record<number, Probe>>({});
  const reduceMotion = useReducedMotion();

  const fetchShift = useCallback(
    async (shift: number) => {
      setProbes((p) => ({
        ...p,
        [shift]: { shift, loading: true, offer: null },
      }));
      const departDate = addDays(baseline.departDate, shift);
      const returnDate = baseline.returnDate
        ? addDays(baseline.returnDate, shift)
        : null;
      try {
        const res = await fetch("/api/search/single", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            originIata: baseline.origin,
            destIata: baseline.destIata,
            departDate,
            returnDate,
            cabin: "economy",
            adults,
          }),
        });
        if (!res.ok) {
          setProbes((p) => ({
            ...p,
            [shift]: { shift, loading: false, offer: null, error: "failed" },
          }));
          return;
        }
        const json = (await res.json()) as { offer: Offer | null };
        setProbes((p) => ({
          ...p,
          [shift]: { shift, loading: false, offer: json.offer },
        }));
      } catch {
        setProbes((p) => ({
          ...p,
          [shift]: { shift, loading: false, offer: null, error: "network" },
        }));
      }
    },
    [baseline, adults],
  );

  const handleOpen = useCallback(() => {
    setOpen((wasOpen) => {
      const next = !wasOpen;
      if (next) {
        // Kick off all 6 probes in parallel on first open.
        for (const s of SHIFTS) {
          if (!probes[s]) fetchShift(s);
        }
      }
      return next;
    });
  }, [fetchShift, probes]);

  return (
    <div>
      <button
        type="button"
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          handleOpen();
        }}
        className="text-xs text-sky-700 hover:text-sky-900 transition font-medium inline-flex items-center gap-1"
      >
        <span aria-hidden>±</span>
        {open ? "Hide nearby dates" : "Try shifting dates"}
      </button>

      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={reduceMotion ? false : { opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={reduceMotion ? undefined : { opacity: 0, height: 0 }}
            transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
            className="overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <p className="mt-2 mb-2 text-[11px] text-neutral-500 leading-snug">
              Shifts both depart &amp; return by the same offset. Cheaper finds
              are highlighted.
            </p>
            <div className="grid grid-cols-3 gap-1.5">
              {SHIFTS.map((shift) => {
                const probe = probes[shift];
                const cheaper =
                  probe?.offer && probe.offer.price < baseline.price;
                const diff = probe?.offer
                  ? probe.offer.price - baseline.price
                  : 0;
                const departDate = addDays(baseline.departDate, shift);
                return (
                  <DateNudgeChip
                    key={shift}
                    shift={shift}
                    departLabel={formatShortDate(departDate)}
                    loading={probe?.loading ?? false}
                    offer={probe?.offer ?? null}
                    cheaper={!!cheaper}
                    diff={diff}
                    error={probe?.error}
                  />
                );
              })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

interface ChipProps {
  shift: number;
  departLabel: string;
  loading: boolean;
  offer: Offer | null;
  cheaper: boolean;
  diff: number;
  error?: string;
}

function DateNudgeChip({
  shift,
  departLabel,
  loading,
  offer,
  cheaper,
  diff,
  error,
}: ChipProps) {
  const label = `${shift > 0 ? "+" : ""}${shift}d`;

  if (loading) {
    return (
      <div className="glass-pill !rounded-xl px-2.5 py-2 text-center text-[11px] text-neutral-400">
        <div className="font-mono">{label}</div>
        <div className="mt-0.5">…</div>
      </div>
    );
  }

  if (error || !offer) {
    return (
      <div className="glass-pill !rounded-xl px-2.5 py-2 text-center text-[11px] text-neutral-300">
        <div className="font-mono">{label}</div>
        <div className="mt-0.5">—</div>
      </div>
    );
  }

  return (
    <a
      href={offer.bookingUrl}
      target="_blank"
      rel="noopener noreferrer"
      onClick={(e) => e.stopPropagation()}
      className={[
        "glass-pill !rounded-xl px-2.5 py-2 text-center text-[11px] no-underline transition-colors block",
        cheaper
          ? "ring-1 ring-sky-400/60 bg-sky-50/70 text-sky-900 hover:bg-sky-100/70"
          : "text-neutral-700 hover:bg-white/70",
      ].join(" ")}
      title={`Depart ${departLabel} · ${offer.airline} · ${offer.duration}`}
    >
      <div className="font-mono opacity-70">{label}</div>
      <div className="mt-0.5 font-bold tabular-nums">{offer.priceDisplay}</div>
      {cheaper && (
        <div className="text-[9px] font-semibold mt-0.5">
          save ${Math.abs(Math.round(diff))}
        </div>
      )}
    </a>
  );
}
