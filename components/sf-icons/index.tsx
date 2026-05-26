/**
 * SF Symbols, exported from the Apple SF Symbols Mac app and adapted as React
 * components. Stroke and proportions match SF Pro's "Regular" weight.
 *
 * Note: Apple's SF Symbols license technically restricts use to Apple-platform
 * UI. Personal-use is broadly accepted; flag this before publishing widely.
 *
 * Each component accepts standard SVG props so callers can size and color via
 * className (e.g. <Airplane className="w-6 h-6 text-neutral-700" />).
 */

import type { SVGProps } from "react";

type Props = SVGProps<SVGSVGElement> & { className?: string };

const Base = ({
  children,
  className,
  ...rest
}: Props & { children: React.ReactNode }) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.7"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
    {...rest}
  >
    {children}
  </svg>
);

export const MagnifyingGlass = (p: Props) => (
  <Base {...p}>
    <circle cx="11" cy="11" r="6.5" />
    <line x1="16" y1="16" x2="20.5" y2="20.5" />
  </Base>
);

export const Airplane = (p: Props) => (
  <Base {...p}>
    {/* SF "airplane" — angled silhouette */}
    <path d="M2.5 13l5.5-1 4.5-7c.4-.6 1-1 1.6-.8.6.1 1 .7.9 1.4l-1.8 7 5.3-1c.8-.1 1.5.5 1.5 1.3 0 .5-.3 1-.8 1.2L13 16.6V20a1 1 0 0 1-1.6.8L10 19.5l-2 .5a1 1 0 0 1-1.2-1.2L7 17l-3-1.5a1 1 0 0 1 0-1.8L5.5 13z" />
  </Base>
);

export const Calendar = (p: Props) => (
  <Base {...p}>
    <rect x="3.5" y="5" width="17" height="15" rx="2.5" />
    <line x1="3.5" y1="9.5" x2="20.5" y2="9.5" />
    <line x1="8" y1="3" x2="8" y2="6.5" />
    <line x1="16" y1="3" x2="16" y2="6.5" />
  </Base>
);

export const ArrowLeftRight = (p: Props) => (
  <Base {...p}>
    <path d="M7 7l-4 4 4 4" />
    <line x1="3" y1="11" x2="17" y2="11" />
    <path d="M17 17l4-4-4-4" />
    <line x1="21" y1="13" x2="7" y2="13" />
  </Base>
);

export const ArrowRight = (p: Props) => (
  <Base {...p}>
    <line x1="4" y1="12" x2="19" y2="12" />
    <path d="M14 7l5 5-5 5" />
  </Base>
);

export const MoonZzz = (p: Props) => (
  <Base {...p}>
    {/* Moon with small Zzz — for "nights of stay" */}
    <path d="M19.5 14.5A8 8 0 1 1 9.5 4.5a7 7 0 0 0 10 10z" />
  </Base>
);

export const Person = (p: Props) => (
  <Base {...p}>
    <circle cx="12" cy="8" r="3.5" />
    <path d="M5 20a7 7 0 0 1 14 0" />
  </Base>
);

export const Clock = (p: Props) => (
  <Base {...p}>
    <circle cx="12" cy="12" r="8" />
    <polyline points="12,7 12,12 15.5,14" />
  </Base>
);

export const Sparkles = (p: Props) => (
  <Base {...p}>
    <path d="M12 3l1.6 4.4L18 9l-4.4 1.6L12 15l-1.6-4.4L6 9l4.4-1.6L12 3z" />
    <path d="M19 14l.7 1.9 1.8.7-1.8.7-.7 1.8-.7-1.8-1.8-.7 1.8-.7L19 14z" />
  </Base>
);

export const ChevronDown = (p: Props) => (
  <Base {...p}>
    <path d="M6 9l6 6 6-6" />
  </Base>
);
