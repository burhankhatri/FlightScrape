"use client";

import { motion, AnimatePresence, useReducedMotion } from "motion/react";
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";
import { computeMenuLayout, type MenuLayout } from "@/lib/menu-position";
import {
  type OriginOption,
  getPopularOrigins,
  searchOrigins,
} from "@/lib/origins";
import { ChevronDown } from "./sf-icons";

interface Props {
  value: OriginOption;
  onChange: (origin: OriginOption) => void;
  disabled?: boolean;
  buttonId?: string;
}

export function OriginPicker({
  value,
  onChange,
  disabled,
  buttonId = "origin-picker",
}: Props) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [menuLayout, setMenuLayout] = useState<MenuLayout | null>(null);
  const [mounted, setMounted] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const reduceMotion = useReducedMotion();

  const popular = useMemo(() => getPopularOrigins(), []);
  const filtered = useMemo(() => {
    if (!query.trim()) return [];
    return searchOrigins(query).slice(0, 60);
  }, [query]);

  const close = useCallback(() => {
    setOpen(false);
    setQuery("");
  }, []);

  useEffect(() => setMounted(true), []);

  const updateMenuPosition = useCallback(() => {
    const el = rootRef.current;
    if (!el) return;
    setMenuLayout(computeMenuLayout(el.getBoundingClientRect()));
  }, []);

  useLayoutEffect(() => {
    if (!open) return;
    updateMenuPosition();
    const onLayout = () => updateMenuPosition();
    window.addEventListener("resize", onLayout);
    window.addEventListener("scroll", onLayout, true);
    return () => {
      window.removeEventListener("resize", onLayout);
      window.removeEventListener("scroll", onLayout, true);
    };
  }, [open, updateMenuPosition]);

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      const t = e.target as Node;
      if (rootRef.current?.contains(t) || menuRef.current?.contains(t)) return;
      close();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [open, close]);

  useEffect(() => {
    if (open) requestAnimationFrame(() => inputRef.current?.focus());
  }, [open]);

  const select = (o: OriginOption) => {
    onChange(o);
    close();
  };

  const toggle = () => {
    if (disabled) return;
    setOpen((v) => !v);
  };

  const dropdown =
    open && menuLayout ? (
      <motion.div
        key="origin-menu"
        ref={menuRef}
        role="listbox"
        aria-label="Departure airports"
        initial={reduceMotion ? false : { opacity: 0, y: -6 }}
        animate={{ opacity: 1, y: 0 }}
        exit={reduceMotion ? undefined : { opacity: 0, y: -6 }}
        transition={{ duration: 0.15 }}
        style={{
          position: "fixed",
          top: menuLayout.top,
          bottom: menuLayout.bottom,
          left: menuLayout.left,
          width: menuLayout.width,
          maxHeight: menuLayout.maxHeight,
          zIndex: 9999,
        }}
        className="origin-menu-panel"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="search-shell p-2.5 sm:p-2 shadow-xl h-full flex flex-col min-h-0">
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="City or code…"
            aria-label="Filter airports"
            className="field-box text-base sm:text-sm mb-2 outline-none placeholder:text-neutral-400 shrink-0"
          />

          <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain -mx-0.5 px-0.5">
            {!query.trim() ? (
              <>
                <p className="type-caption px-1 pt-0.5 pb-1.5">Popular</p>
                <div className="grid grid-cols-1 xs:grid-cols-2 gap-1">
                  {popular.map((o) => (
                    <button
                      key={o.iata}
                      type="button"
                      onClick={() => select(o)}
                      className={[
                        "touch-target flex items-center gap-2 rounded-lg px-3 py-2.5 sm:py-2 sm:px-2 text-left text-sm transition-colors w-full",
                        o.iata === value.iata
                          ? "bg-white/80 font-medium ring-1 ring-white"
                          : "hover:bg-white/50 active:bg-white/65 text-neutral-700",
                      ].join(" ")}
                    >
                      <span className="truncate">{o.city}</span>
                      <span className="type-code ml-auto shrink-0">{o.iata}</span>
                    </button>
                  ))}
                </div>
                <p className="type-caption px-1 pt-3 pb-1">
                  Or type a city, country, or IATA code…
                </p>
              </>
            ) : filtered.length === 0 ? (
              <p className="type-caption text-center py-6">No matches</p>
            ) : (
              <ul className="space-y-0.5">
                {filtered.map((o) => (
                  <li key={o.iata}>
                    <button
                      type="button"
                      role="option"
                      aria-selected={o.iata === value.iata}
                      onClick={() => select(o)}
                      className={[
                        "touch-target w-full flex items-center gap-2 rounded-lg px-3 py-2.5 sm:py-2 sm:px-2 text-sm text-left",
                        o.iata === value.iata
                          ? "bg-white/80 font-medium"
                          : "hover:bg-white/50 active:bg-white/65",
                      ].join(" ")}
                    >
                      <span className="truncate min-w-0">
                        {o.city}
                        <span className="text-neutral-400 hidden xs:inline">
                          {" "}
                          · {o.country}
                        </span>
                      </span>
                      <span className="type-code ml-auto shrink-0">{o.iata}</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </motion.div>
    ) : null;

  return (
    <div ref={rootRef} className="relative w-full">
      <button
        id={buttonId}
        type="button"
        disabled={disabled}
        onClick={toggle}
        aria-expanded={open}
        aria-haspopup="listbox"
        aria-label={`Departure: ${value.label}`}
        className={[
          "field-box justify-between gap-2 cursor-pointer w-full touch-target",
          open ? "field-box-active" : "",
          disabled ? "opacity-60 cursor-not-allowed" : "",
        ].join(" ")}
      >
        <span className="flex items-center gap-1.5 min-w-0 flex-1">
          <span className="truncate font-medium">{value.city}</span>
          <span className="type-code shrink-0">{value.iata}</span>
        </span>
        <motion.span
          animate={{ rotate: open ? 180 : 0 }}
          transition={{ duration: 0.2 }}
          className="text-neutral-400 shrink-0 ml-0.5"
          aria-hidden
        >
          <ChevronDown className="w-4 h-4" />
        </motion.span>
      </button>

      {mounted &&
        createPortal(
          <AnimatePresence>{dropdown}</AnimatePresence>,
          document.body,
        )}
    </div>
  );
}
