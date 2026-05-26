import type { Config } from "tailwindcss";

export default {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    screens: {
      xs: "380px",
      sm: "640px",
      md: "768px",
      lg: "1024px",
      xl: "1280px",
      "2xl": "1536px",
    },
    extend: {
      fontFamily: {
        sans: [
          "var(--font-body)",
          "-apple-system",
          "BlinkMacSystemFont",
          "Segoe UI",
          "system-ui",
          "sans-serif",
        ],
        display: [
          "var(--font-display)",
          "var(--font-body)",
          "-apple-system",
          "BlinkMacSystemFont",
          "sans-serif",
        ],
        mono: ["ui-monospace", "SFMono-Regular", "Menlo", "Monaco", "Consolas", "monospace"],
      },
      borderRadius: {
        "4xl": "2rem",
        "5xl": "2.5rem",
      },
      maxWidth: {
        "8xl": "88rem",
      },
      keyframes: {
        "metal-spin": {
          "0%": { transform: "rotate(0deg)" },
          "100%": { transform: "rotate(360deg)" },
        },
        "fade-in-blur": {
          "0%": { opacity: "0", filter: "blur(12px)", transform: "translateY(16px)" },
          "100%": { opacity: "1", filter: "blur(0px)", transform: "translateY(0)" },
        },
        sheen: {
          "0%": { transform: "translateX(-120%) skewX(-12deg)" },
          "100%": { transform: "translateX(120%) skewX(-12deg)" },
        },
      },
      animation: {
        "metal-spin": "metal-spin 5.5s linear infinite",
        "metal-spin-fast": "metal-spin 1.8s linear infinite",
        "fade-in-blur": "fade-in-blur 750ms cubic-bezier(0.16, 1, 0.3, 1) both",
        sheen: "sheen 0.75s cubic-bezier(0.2, 0.8, 0.2, 1)",
      },
    },
  },
  plugins: [],
} satisfies Config;
