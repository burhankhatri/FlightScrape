import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Search flights · Flighthelper",
  description:
    "Find the cheapest flights in natural language — compare Google Flights and Amadeus.",
};

export default function FlightsLayout({ children }: { children: React.ReactNode }) {
  return children;
}
