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
  const [menuRect, setMenuRect] = useState<DOMRect | null>(null);
  const [mounted, setMounted] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const reduceMotion = useReducedMotion();

  const popular = useMemo(() => getPopularOrigins(), []);
  const filtered = useMemo(() => {
    if (!query.trim()) return [];
    return searchOrigins(query).slice(0, 6);
  }, [query]);

  const close = useCallback(() => {
    setOpen(false);
    setQuery("");
  }, []);

  useEffect(() => setMounted(true), []);

  const updateMenuPosition = useCallback(() => {
    const el = rootRef.current;
    if (!el) return;
    setMenuRect(el.getBoundingClientRect());
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
    open && menuRect ? (
      <motion.div
        key="origin-menu"
        ref={menuRef}
        role="listbox"
        aria-label="Departure airports"
        initial={reduceMotion ? false : { opacity: 0, y: -4 }}
        animate={{ opacity: 1, y: 0 }}
        exit={reduceMotion ? undefined : { opacity: 0, y: -4 }}
        transition={{ duration: 0.15 }}
        style={{
          position: "fixed",
          top: menuRect.bottom + 6,
          left: menuRect.left,
          width: Math.max(menuRect.width, 256),
          zIndex: 9999,
        }}
        className="max-w-[min(100vw-2rem,16rem)]"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="search-shell p-2 shadow-xl">
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="City or code…"
            aria-label="Filter airports"
            className="field-box text-sm mb-2 outline-none placeholder:text-neutral-400"
          />

          <div className="max-h-36 overflow-y-auto overscroll-contain">
            {!query.trim() ? (
              <div className="grid grid-cols-2 gap-1">
                {popular.map((o) => (
                  <button
                    key={o.iata}
                    type="button"
                    onClick={() => select(o)}
                    className={[
                      "rounded-lg px-2 py-1.5 text-left text-sm transition-colors",
                      o.iata === value.iata
                        ? "bg-white/80 font-medium ring-1 ring-white"
                        : "hover:bg-white/50 text-neutral-700",
                    ].join(" ")}
                  >
                    {o.city}
                  </button>
                ))}
              </div>
            ) : filtered.length === 0 ? (
              <p className="type-caption text-center py-4">No matches</p>
            ) : (
              <ul>
                {filtered.map((o) => (
                  <li key={o.iata}>
                    <button
                      type="button"
                      role="option"
                      aria-selected={o.iata === value.iata}
                      onClick={() => select(o)}
                      className={[
                        "w-full flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm text-left",
                        o.iata === value.iata
                          ? "bg-white/80 font-medium"
                          : "hover:bg-white/50",
                      ].join(" ")}
                    >
                      <span className="truncate">{o.city}</span>
                      <span className="type-code ml-auto">{o.iata}</span>
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
    <div ref={rootRef} className="relative">
      <button
        id={buttonId}
        type="button"
        disabled={disabled}
        onClick={toggle}
        aria-expanded={open}
        aria-haspopup="listbox"
        aria-label={`Departure: ${value.label}`}
        className={[
          "field-box justify-between gap-2 cursor-pointer",
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
