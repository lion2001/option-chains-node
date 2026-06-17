export const DEFAULT_OPTION_WATCHLIST = [
  "POET",
  "AAOI",
  "MRVL",
  "LITE",
  "ALAB",
  "COHR"
];

export const resolveTrackedOptionSymbols = (symbolsFromEnv: string[]): string[] => {
  if (symbolsFromEnv.length > 0) {
    return symbolsFromEnv;
  }

  return DEFAULT_OPTION_WATCHLIST;
};
