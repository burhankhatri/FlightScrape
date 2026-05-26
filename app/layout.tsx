import { Inter, Instrument_Serif } from "next/font/google";
import type { Metadata, Viewport } from "next";
import "./globals.css";
import { LazyMotion, domAnimation } from "motion/react";
import { LiquidGlassFilters } from "@/components/ui/liquid-glass-filters";

const instrumentSerif = Instrument_Serif({
  subsets: ["latin"],
  variable: "--font-display",
  display: "swap",
  weight: "400",
});

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-body",
  display: "swap",
  weight: ["400", "500", "600"],
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
    <html lang="en" className={`${instrumentSerif.variable} ${inter.variable}`}>
      <body className="font-sans antialiased min-h-screen">
        <LiquidGlassFilters />
        <LazyMotion features={domAnimation}>{children}</LazyMotion>
      </body>
    </html>
  );
}
