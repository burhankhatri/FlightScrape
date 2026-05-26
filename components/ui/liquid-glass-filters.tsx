/**
 * SVG displacement filters for liquid-glass surfaces.
 * Inspired by creativoma/liquid-glass (feTurbulence + feDisplacementMap)
 * and crenspire/glass-ui specular highlights.
 */
export function LiquidGlassFilters() {
  return (
    <svg
      aria-hidden
      className="pointer-events-none absolute w-0 h-0 overflow-hidden"
      xmlns="http://www.w3.org/2000/svg"
    >
      <defs>
        <filter id="liquid-glass-soft" x="-20%" y="-20%" width="140%" height="140%">
          <feTurbulence
            type="fractalNoise"
            baseFrequency="0.012 0.018"
            numOctaves="2"
            seed="8"
            result="noise"
          />
          <feDisplacementMap
            in="SourceGraphic"
            in2="noise"
            scale="6"
            xChannelSelector="R"
            yChannelSelector="G"
          />
        </filter>
        <filter id="liquid-glass-glow" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur in="SourceAlpha" stdDeviation="4" result="blur" />
          <feOffset in="blur" dx="0" dy="2" result="offsetBlur" />
          <feFlood floodColor="rgba(180, 210, 255, 0.45)" result="color" />
          <feComposite in="color" in2="offsetBlur" operator="in" result="glow" />
          <feMerge>
            <feMergeNode in="glow" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>
    </svg>
  );
}
