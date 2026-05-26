import { GeistMono } from "geist/font/mono";
import { GeistSans } from "geist/font/sans";
import type { Metadata, Viewport } from "next";
import "./globals.css";
import { LazyMotion, domAnimation } from "motion/react";
import { LiquidGlassFilters } from "@/components/ui/liquid-glass-filters";

export const metadata: Metadata = {
  title: "Flighthelper — Find the cheapest flights, naturally",
  description:
    "Describe your trip in plain English. Compare Google Flights and Amadeus across dates and destinations.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#fafafa",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${GeistSans.variable} ${GeistMono.variable}`}>
      <body className={`${GeistSans.className} antialiased min-h-screen`}>
        <LiquidGlassFilters />
        <LazyMotion features={domAnimation}>{children}</LazyMotion>
      </body>
    </html>
  );
}
