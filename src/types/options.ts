export type OptionType = "CALL" | "PUT";

export interface OptionContract {
  symbol: string;
  dataDate: string;
  tradeDate: string;
  expiryDate: string;
  strike: number;
  optionType: OptionType;
  bid: number | null;
  ask: number | null;
  last: number | null;
  volume: number | null;
  openInterest: number | null;
  impliedVolatility: number | null;
  source: string;
}

export interface DailyUpdateSummary {
  requestedSymbols: string[];
  processedSymbols: string[];
  insertedOrUpdated: number;
  startedAt: string;
  finishedAt: string;
}
