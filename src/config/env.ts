import dotenv from "dotenv";

dotenv.config();

const parseNumber = (value: string | undefined, fallback: number): number => {
  if (!value) {
    return fallback;
  }

  const parsed = Number(value);
  return Number.isNaN(parsed) ? fallback : parsed;
};

const parseBoolean = (value: string | undefined, fallback: boolean): boolean => {
  if (!value) {
    return fallback;
  }

  return value.toLowerCase() === "true";
};

const parseString = (value: string | undefined): string | undefined => {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
};

const symbols = (process.env.OPTION_SYMBOLS ?? "")
  .split(",")
  .map((item) => item.trim().toUpperCase())
  .filter(Boolean);

export const env = {
  nodeEnv: process.env.NODE_ENV ?? "development",
  port: parseNumber(process.env.PORT, 3000),
  mysql: {
    host: process.env.MYSQL_HOST ?? "127.0.0.1",
    port: parseNumber(process.env.MYSQL_PORT, 3306),
    user: process.env.MYSQL_USER ?? "root",
    password: process.env.MYSQL_PASSWORD ?? "",
    database: process.env.MYSQL_DATABASE ?? "option_chains",
    connectionLimit: parseNumber(process.env.MYSQL_CONNECTION_LIMIT, 10)
  },
  optionUpdateCron: process.env.OPTION_UPDATE_CRON ?? "0 30 18 * * 1-5",
  optionSymbols: symbols,
  optionDataProvider: process.env.OPTION_DATA_PROVIDER ?? "alpaca",
  optionContractLimit: parseNumber(process.env.OPTION_CONTRACT_LIMIT, 500),
  optionType: parseString(process.env.OPTION_TYPE),
  optionExpirationDate: parseString(process.env.OPTION_EXPIRATION_DATE),
  optionExpirationDateGte: parseString(process.env.OPTION_EXPIRATION_DATE_GTE),
  optionExpirationDateLte: parseString(process.env.OPTION_EXPIRATION_DATE_LTE),
  alpaca: {
    baseUrl:
      process.env.ALPACA_OPTION_DATA_URL ??
      "https://data.alpaca.markets/v1beta1/options/snapshots",
    feed: process.env.ALPACA_OPTION_FEED ?? "indicative",
    apiKeyId: process.env.ALPACA_API_KEY_ID ?? "PKZRA2D5PVZ662Z4XZL2PM6VDJ",
    apiSecretKey: process.env.ALPACA_API_SECRET_KEY ?? "e2jxA7XE9mxa6NF1hSDyo9rNc72tAAqoBRhe181rV1k"
  },
  optionDataApiUrl: process.env.OPTION_DATA_API_URL ?? "",
  optionDataApiKey: process.env.OPTION_DATA_API_KEY ?? "",
  useMockSource: parseBoolean(process.env.USE_MOCK_SOURCE, false)
};
