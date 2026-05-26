import { Inter } from "next/font/google";
import type { Metadata } from "next";
import "./globals.css";
import { LazyMotion, domAnimation } from "motion/react";
import { LiquidGlassFilters } from "@/components/ui/liquid-glass-filters";

const inter = Inter({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-inter",
});

export const metadata: Metadata = {
  title: "Flighthelper",
  description: "Find the cheapest flights — search in natural language.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={inter.variable}>
      <body className="font-sans antialiased min-h-screen">
        <LiquidGlassFilters />
        <LazyMotion features={domAnimation}>{children}</LazyMotion>
      </body>
    </html>
  );
}
