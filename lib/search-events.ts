import type { Card, ParsedQuery, SearchStats } from "./types";

export type SearchStreamEvent =
  | { type: "status"; message: string; phase: "parse" | "search" | "images" | "done" }
  | {
      type: "parsed";
      parsed: ParsedQuery;
      originIata: string;
      destinations: string[];
      totalCombos: number;
    }
  | {
      type: "progress";
      checked: number;
      total: number;
      succeeded: number;
      label?: string;
    }
  | { type: "card"; card: Card }
  | { type: "card-image"; destLabel: string; imageUrl: string }
  | { type: "done"; parsed: ParsedQuery; stats: SearchStats }
  | { type: "error"; error: string };

export type SearchPhase = "parse" | "search" | "images" | "done";

export interface SearchCallbacks {
  onStatus?: (message: string, phase: SearchPhase) => void;
  onParsed?: (parsed: ParsedQuery, originIata: string, destinations: string[], totalCombos: number) => void;
  onProgress?: (checked: number, total: number, succeeded: number, label?: string) => void;
  onCard?: (card: Card) => void;
  onCardImage?: (destLabel: string, imageUrl: string) => void;
}
