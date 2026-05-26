import { DM_Sans, Plus_Jakarta_Sans } from "next/font/google";
import type { Metadata, Viewport } from "next";
import "./globals.css";
import { LazyMotion, domAnimation } from "motion/react";
import { LiquidGlassFilters } from "@/components/ui/liquid-glass-filters";

const plusJakarta = Plus_Jakarta_Sans({
  subsets: ["latin"],
  variable: "--font-display",
  display: "swap",
  weight: ["500", "600", "700", "800"],
});

const dmSans = DM_Sans({
  subsets: ["latin"],
  variable: "--font-body",
  display: "swap",
  weight: ["400", "500", "600", "700"],
});

export const metadata: Metadata = {
  title: "Flighthelper — Find the cheapest flights, naturally",
  description:
    "Describe your trip in plain English. Compare Google Flights and Amadeus across dates and destinations.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#eef3f9",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${plusJakarta.variable} ${dmSans.variable}`}>
      <body className="font-sans antialiased min-h-screen">
        <LiquidGlassFilters />
        <LazyMotion features={domAnimation}>{children}</LazyMotion>
      </body>
    </html>
  );
}
