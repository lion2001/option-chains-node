import axios from "axios";

import { env } from "../config/env";
import { OptionContract, OptionType } from "../types/options";

interface ApiOptionContract {
  symbol?: string;
  tradeDate?: string;
  expiryDate?: string;
  strike?: number | string;
  optionType?: string;
  bid?: number | string | null;
  ask?: number | string | null;
  last?: number | string | null;
  volume?: number | string | null;
  openInterest?: number | string | null;
  impliedVolatility?: number | string | null;
  source?: string;
}

interface AlpacaSnapshot {
  symbol?: string;
  Symbol?: string;
  latestTrade?: {
    p?: number;
    price?: number;
  };
  LatestTrade?: {
    Price?: number;
  };
  latestQuote?: {
    ap?: number;
    bp?: number;
  };
  LatestQuote?: {
    AskPrice?: number;
    BidPrice?: number;
  };
  greeks?: {
    delta?: number;
    gamma?: number;
    theta?: number;
    vega?: number;
    rho?: number;
  };
  Greeks?: {
    Delta?: number;
    Gamma?: number;
    Theta?: number;
    Vega?: number;
    Rho?: number;
  };
  impliedVolatility?: number;
  ImpliedVOlatility?: number;
  ImpliedVolatility?: number;
  openInterest?: number;
  OpenInterest?: number;
  volume?: number;
  Volume?: number;
}

interface AlpacaOptionChainResponse {
  snapshots?: Record<string, AlpacaSnapshot> | AlpacaSnapshot[];
  next_page_token?: string | null;
}

interface AlpacaBar {
  S?: string;
  symbol?: string;
  v?: number;
  volume?: number;
}

interface AlpacaBarsResponse {
  bars?: Record<string, AlpacaBar[]> | AlpacaBar[];
  next_page_token?: string | null;
}

interface AlpacaOptionContractMetadata {
  symbol?: string;
  open_interest?: string | number | null;
}

interface AlpacaOptionContractsResponse {
  option_contracts?: AlpacaOptionContractMetadata[];
  next_page_token?: string | null;
}

const ALPACA_OPTION_BARS_URL = "https://data.alpaca.markets/v1beta1/options/bars";
const ALPACA_OPTION_CONTRACTS_URL = "https://paper-api.alpaca.markets/v2/options/contracts";

const normalizeNumber = (value: number | string | null | undefined): number | null => {
  if (value === null || value === undefined || value === "") {
    return null;
  }

  const parsed = Number(value);
  return Number.isNaN(parsed) ? null : parsed;
};

const toOptionType = (value: string | undefined): OptionType => {
  return value?.toUpperCase() === "PUT" ? "PUT" : "CALL";
};

const pickNumber = (...values: Array<number | null | undefined>): number | null => {
  for (const value of values) {
    if (typeof value === "number" && !Number.isNaN(value)) {
      return value;
    }
  }

  return null;
};

const chunkArray = <T>(items: T[], size: number): T[][] => {
  if (items.length === 0) {
    return [];
  }

  const chunks: T[][] = [];

  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size));
  }

  return chunks;
};

const formatOccDate = (rawDate: string): string => {
  const year = Number(rawDate.slice(0, 2));
  const month = rawDate.slice(2, 4);
  const day = rawDate.slice(4, 6);

  return `20${year.toString().padStart(2, "0")}-${month}-${day}`;
};

const parseOccContractSymbol = (
  contractSymbol: string,
  defaultSymbol: string
): Pick<OptionContract, "symbol" | "expiryDate" | "strike" | "optionType"> => {
  const normalized = contractSymbol.startsWith("O:") ? contractSymbol.slice(2) : contractSymbol;
  const match = normalized.match(/^([A-Z.]+)(\d{6})([CP])(\d{8})$/);

  if (!match) {
    throw new Error(`无法解析期权合约代码: ${contractSymbol}`);
  }

  return {
    symbol: match[1] || defaultSymbol,
    expiryDate: formatOccDate(match[2]),
    strike: Number(match[4]) / 1000,
    optionType: match[3] === "P" ? "PUT" : "CALL"
  };
};

const buildMockContracts = (symbol: string, dataDate: string): OptionContract[] => {
  const tradeDate = dataDate;

  const nextMonth = new Date(`${dataDate}T00:00:00.000Z`);
  nextMonth.setUTCDate(nextMonth.getUTCDate() + 30);
  const expiryDate = nextMonth.toISOString().slice(0, 10);

  return [
    {
      symbol,
      dataDate,
      tradeDate,
      expiryDate,
      strike: 100,
      optionType: "CALL",
      bid: 2.2,
      ask: 2.4,
      last: 2.3,
      volume: 1200,
      openInterest: 5400,
      impliedVolatility: 0.25,
      source: "mock"
    },
    {
      symbol,
      dataDate,
      tradeDate,
      expiryDate,
      strike: 100,
      optionType: "PUT",
      bid: 1.8,
      ask: 2.0,
      last: 1.9,
      volume: 900,
      openInterest: 4300,
      impliedVolatility: 0.27,
      source: "mock"
    }
  ];
};

const normalizeApiContract = (
  symbol: string,
  dataDate: string,
  item: ApiOptionContract
): OptionContract => {
  return {
    symbol: (item.symbol ?? symbol).toUpperCase(),
    dataDate,
    tradeDate: item.tradeDate ?? dataDate,
    expiryDate: item.expiryDate ?? new Date().toISOString().slice(0, 10),
    strike: normalizeNumber(item.strike) ?? 0,
    optionType: toOptionType(item.optionType),
    bid: normalizeNumber(item.bid),
    ask: normalizeNumber(item.ask),
    last: normalizeNumber(item.last),
    volume: normalizeNumber(item.volume),
    openInterest: normalizeNumber(item.openInterest),
    impliedVolatility: normalizeNumber(item.impliedVolatility),
    source: item.source ?? "api"
  };
};

const ensureAlpacaCredentials = (): void => {
  if (!env.alpaca.apiKeyId || !env.alpaca.apiSecretKey) {
    throw new Error("未配置 Alpaca API Key，请设置 ALPACA_API_KEY_ID 和 ALPACA_API_SECRET_KEY。");
  }
};

const normalizeOptionTypeFilter = (): string | undefined => {
  if (!env.optionType) {
    return undefined;
  }

  const normalized = env.optionType.toLowerCase();
  return normalized === "call" || normalized === "put" ? normalized : undefined;
};

const buildAlpacaParams = () => {
  return {
    feed: env.alpaca.feed,
    limit: Math.max(1, Math.min(env.optionContractLimit, 1000)),
    type: normalizeOptionTypeFilter(),
    expiration_date: env.optionExpirationDate,
    expiration_date_gte: env.optionExpirationDateGte,
    expiration_date_lte: env.optionExpirationDateLte
  };
};

const getAlpacaHeaders = () => {
  ensureAlpacaCredentials();

  return {
    accept: "application/json",
    "APCA-API-KEY-ID": env.alpaca.apiKeyId,
    "APCA-API-SECRET-KEY": env.alpaca.apiSecretKey
  };
};

const buildOccContractSymbol = (contract: OptionContract): string => {
  const expiryDate = contract.expiryDate.replace(/-/g, "").slice(2);
  const optionType = contract.optionType === "PUT" ? "P" : "C";
  const strike = Math.round(contract.strike * 1000)
    .toString()
    .padStart(8, "0");

  return `${contract.symbol.toUpperCase()}${expiryDate}${optionType}${strike}`;
};

const extractAlpacaSnapshots = (payload: unknown): AlpacaSnapshot[] => {
  if (Array.isArray(payload)) {
    return payload as AlpacaSnapshot[];
  }

  if (!payload || typeof payload !== "object") {
    return [];
  }

  if ("snapshots" in payload) {
    const { snapshots } = payload as AlpacaOptionChainResponse;

    if (Array.isArray(snapshots)) {
      return snapshots;
    }

    if (snapshots && typeof snapshots === "object") {
      return Object.entries(snapshots).map(([contractSymbol, snapshot]) => ({
        symbol: snapshot?.symbol ?? snapshot?.Symbol ?? contractSymbol,
        ...snapshot
      }));
    }
  }

  return [];
};

const extractAlpacaBars = (payload: unknown): Array<{ contractSymbol: string; bar: AlpacaBar }> => {
  if (!payload || typeof payload !== "object" || !("bars" in payload)) {
    return [];
  }

  const { bars } = payload as AlpacaBarsResponse;

  if (Array.isArray(bars)) {
    return bars
      .map((bar) => ({
        contractSymbol: bar.symbol ?? bar.S ?? "",
        bar
      }))
      .filter((item) => Boolean(item.contractSymbol));
  }

  if (!bars || typeof bars !== "object") {
    return [];
  }

  return Object.entries(bars).flatMap(([contractSymbol, barList]) => {
    if (!Array.isArray(barList)) {
      return [];
    }

    return barList.map((bar) => ({
      contractSymbol,
      bar
    }));
  });
};

const extractAlpacaOptionContracts = (payload: unknown): AlpacaOptionContractMetadata[] => {
  if (!payload || typeof payload !== "object" || !("option_contracts" in payload)) {
    return [];
  }

  const { option_contracts } = payload as AlpacaOptionContractsResponse;
  return Array.isArray(option_contracts) ? option_contracts : [];
};

const readQuoteNumbers = (
  quote: AlpacaSnapshot["LatestQuote"] | AlpacaSnapshot["latestQuote"] | undefined
) => {
  const normalized = quote as
    | { AskPrice?: number; BidPrice?: number; ap?: number; bp?: number }
    | undefined;

  return {
    bid: pickNumber(normalized?.BidPrice, normalized?.bp),
    ask: pickNumber(normalized?.AskPrice, normalized?.ap)
  };
};

const readTradePrice = (
  trade: AlpacaSnapshot["LatestTrade"] | AlpacaSnapshot["latestTrade"] | undefined
) => {
  const normalized = trade as { Price?: number; p?: number; price?: number } | undefined;
  return pickNumber(normalized?.Price, normalized?.p, normalized?.price);
};

const normalizeAlpacaSnapshot = (
  defaultSymbol: string,
  dataDate: string,
  contractSymbol: string | undefined,
  snapshot: AlpacaSnapshot
): OptionContract => {
  const resolvedSymbol = contractSymbol ?? snapshot.symbol ?? snapshot.Symbol;

  if (!resolvedSymbol) {
    throw new Error(`Alpaca 返回的期权快照缺少合约代码: ${defaultSymbol}`);
  }

  const parsed = parseOccContractSymbol(resolvedSymbol, defaultSymbol);
  const latestTrade = snapshot.LatestTrade ?? snapshot.latestTrade;
  const latestQuote = snapshot.LatestQuote ?? snapshot.latestQuote;
  const quoteValues = readQuoteNumbers(latestQuote);

  return {
    symbol: parsed.symbol.toUpperCase(),
    dataDate,
    tradeDate: dataDate,
    expiryDate: parsed.expiryDate,
    strike: parsed.strike,
    optionType: parsed.optionType,
    bid: quoteValues.bid,
    ask: quoteValues.ask,
    last: readTradePrice(latestTrade),
    volume: pickNumber(snapshot.Volume, snapshot.volume),
    openInterest: pickNumber(snapshot.OpenInterest, snapshot.openInterest),
    impliedVolatility: pickNumber(
      snapshot.ImpliedVolatility,
      snapshot.ImpliedVOlatility,
      snapshot.impliedVolatility
    ),
    source: `alpaca-${env.alpaca.feed}`
  };
};

const mergeContractMetrics = (
  contracts: OptionContract[],
  volumeByContract: Map<string, number | null>,
  openInterestByContract: Map<string, number | null>
): OptionContract[] => {
  return contracts.map((contract) => {
    const contractSymbol = buildOccContractSymbol(contract);
    const resolvedVolume = volumeByContract.get(contractSymbol);
    const resolvedOpenInterest = openInterestByContract.get(contractSymbol);

    return {
      ...contract,
      volume: resolvedVolume ?? contract.volume,
      openInterest: resolvedOpenInterest ?? contract.openInterest
    };
  });
};

const fetchContractVolumesFromBars = async (
  symbol: string,
  dataDate: string,
  contracts: OptionContract[]
): Promise<Map<string, number | null>> => {
  const contractSymbols = contracts.map(buildOccContractSymbol);
  const volumeByContract = new Map<string, number | null>();
  const chunks = chunkArray(contractSymbols, 100);

  if (chunks.length === 0) {
    return volumeByContract;
  }

  console.log(
    `[数据源] 开始补充成交量 symbol=${symbol} dataDate=${dataDate} contractCount=${contractSymbols.length} chunkCount=${chunks.length}`
  );

  for (const [chunkIndex, chunk] of chunks.entries()) {
    let pageToken: string | undefined;
    let pageNumber = 0;

    do {
      pageNumber += 1;
      const response = await axios.get<AlpacaBarsResponse>(ALPACA_OPTION_BARS_URL, {
        headers: getAlpacaHeaders(),
        params: {
          symbols: chunk.join(","),
          timeframe: "1Day",
          start: dataDate,
          end: dataDate,
          limit: 10000,
          sort: "asc",
          page_token: pageToken
        },
        timeout: 20000
      });

      const barEntries = extractAlpacaBars(response.data);

      for (const { contractSymbol, bar } of barEntries) {
        volumeByContract.set(contractSymbol, pickNumber(bar.volume, bar.v));
      }

      pageToken = response.data?.next_page_token ?? undefined;
      console.log(
        `[数据源] 成交量补充分页完成 symbol=${symbol} chunk=${chunkIndex + 1}/${chunks.length} page=${pageNumber} bars=${barEntries.length}${pageToken ? " nextPage=true" : " nextPage=false"}`
      );
    } while (pageToken);
  }

  console.log(`[数据源] 成交量补充完成 symbol=${symbol} matchedContracts=${volumeByContract.size}`);
  return volumeByContract;
};

const fetchOpenInterestFromContracts = async (
  symbol: string
): Promise<Map<string, number | null>> => {
  const openInterestByContract = new Map<string, number | null>();
  let pageToken: string | undefined;
  let pageNumber = 0;

  console.log(`[数据源] 开始补充未平仓量 symbol=${symbol}`);

  do {
    pageNumber += 1;
    const response = await axios.get<AlpacaOptionContractsResponse>(ALPACA_OPTION_CONTRACTS_URL, {
      headers: getAlpacaHeaders(),
      params: {
        underlying_symbols: symbol,
        status: "active",
        type: normalizeOptionTypeFilter(),
        expiration_date: env.optionExpirationDate,
        expiration_date_gte: env.optionExpirationDate ? undefined : env.optionExpirationDateGte,
        expiration_date_lte:
          env.optionExpirationDate ? undefined : env.optionExpirationDateLte ?? "2100-12-31",
        limit: 10000,
        page_token: pageToken
      },
      timeout: 20000
    });

    const optionContracts = extractAlpacaOptionContracts(response.data);

    for (const contract of optionContracts) {
      if (!contract.symbol) {
        continue;
      }

      openInterestByContract.set(contract.symbol, normalizeNumber(contract.open_interest));
    }

    pageToken = response.data?.next_page_token ?? undefined;
    console.log(
      `[数据源] 未平仓量补充分页完成 symbol=${symbol} page=${pageNumber} contracts=${optionContracts.length}${pageToken ? " nextPage=true" : " nextPage=false"}`
    );
  } while (pageToken);

  console.log(
    `[数据源] 未平仓量补充完成 symbol=${symbol} matchedContracts=${openInterestByContract.size}`
  );
  return openInterestByContract;
};

const enrichAlpacaContracts = async (
  symbol: string,
  dataDate: string,
  contracts: OptionContract[]
): Promise<OptionContract[]> => {
  const [volumeResult, openInterestResult] = await Promise.allSettled([
    fetchContractVolumesFromBars(symbol, dataDate, contracts),
    fetchOpenInterestFromContracts(symbol)
  ]);

  const volumeByContract =
    volumeResult.status === "fulfilled" ? volumeResult.value : new Map<string, number | null>();
  const openInterestByContract =
    openInterestResult.status === "fulfilled"
      ? openInterestResult.value
      : new Map<string, number | null>();

  if (volumeResult.status === "rejected") {
    console.warn(`[数据源] 成交量补充失败 symbol=${symbol}`, volumeResult.reason);
  }

  if (openInterestResult.status === "rejected") {
    console.warn(`[数据源] 未平仓量补充失败 symbol=${symbol}`, openInterestResult.reason);
  }

  const enrichedContracts = mergeContractMetrics(contracts, volumeByContract, openInterestByContract);
  const volumeCount = enrichedContracts.filter((contract) => contract.volume !== null).length;
  const openInterestCount = enrichedContracts.filter((contract) => contract.openInterest !== null).length;

  console.log(
    `[数据源] 字段补充完成 symbol=${symbol} volumeContracts=${volumeCount} openInterestContracts=${openInterestCount} totalContracts=${enrichedContracts.length}`
  );

  return enrichedContracts;
};

const fetchFromAlpaca = async (symbol: string, dataDate: string): Promise<OptionContract[]> => {
  const params = buildAlpacaParams();
  const pageSize = params.limit;
  console.log(
    `[数据源] 开始从 Alpaca 拉取期权链 symbol=${symbol} dataDate=${dataDate} feed=${env.alpaca.feed} pageSize=${pageSize}`
  );
  const results: OptionContract[] = [];
  let pageToken: string | undefined;
  let pageNumber = 0;

  do {
    pageNumber += 1;
    console.log(
      `[数据源] 正在请求 Alpaca 分页 symbol=${symbol} page=${pageNumber}${pageToken ? " hasNextToken=true" : ""}`
    );

    const response = await axios.get<AlpacaOptionChainResponse>(`${env.alpaca.baseUrl}/${symbol}`, {
      headers: getAlpacaHeaders(),
      params: {
        ...params,
        page_token: pageToken
      },
      timeout: 20000
    });

    const snapshots = extractAlpacaSnapshots(response.data);
    const pageResults = snapshots.map((snapshot) =>
      normalizeAlpacaSnapshot(symbol, dataDate, snapshot.symbol ?? snapshot.Symbol, snapshot)
    );

    results.push(...pageResults);
    pageToken = response.data?.next_page_token ?? undefined;

    console.log(
      `[数据源] Alpaca 分页拉取完成 symbol=${symbol} page=${pageNumber} pageContracts=${pageResults.length} accumulatedContracts=${results.length}${pageToken ? " nextPage=true" : " nextPage=false"}`
    );
  } while (pageToken);

  if (results.length === 0) {
    throw new Error(`Alpaca 未返回 ${symbol} 的期权链数据，请检查过滤条件或账号权限。`);
  }

  console.log(`[数据源] Alpaca 快照拉取完成 symbol=${symbol} contracts=${results.length}`);
  return enrichAlpacaContracts(symbol, dataDate, results);
};

const fetchFromCustomApi = async (
  symbol: string,
  dataDate: string
): Promise<OptionContract[]> => {
  if (!env.optionDataApiUrl) {
    throw new Error("OPTION_DATA_API_URL 未配置，无法使用自定义期权数据源。");
  }

  console.log(`[数据源] 开始从自定义接口拉取期权链 symbol=${symbol} dataDate=${dataDate}`);
  const response = await axios.get(env.optionDataApiUrl, {
    params: {
      symbol,
      apiKey: env.optionDataApiKey || undefined
    },
    timeout: 15000
  });

  const payload = response.data;
  const rawItems: ApiOptionContract[] = Array.isArray(payload)
    ? payload
    : Array.isArray(payload?.data)
      ? payload.data
      : [];

  if (rawItems.length === 0) {
    throw new Error(`未从自定义数据源获取到 ${symbol} 的期权数据，请检查接口返回结构。`);
  }

  console.log(`[数据源] 自定义接口拉取完成 symbol=${symbol} contracts=${rawItems.length}`);
  return rawItems.map((item) => normalizeApiContract(symbol, dataDate, item));
};

export const fetchOptionContracts = async (
  symbol: string,
  dataDate: string
): Promise<OptionContract[]> => {
  try {
    if (env.optionDataProvider === "mock") {
      console.log(`[数据源] 当前使用 mock 数据源 symbol=${symbol} dataDate=${dataDate}`);
      return buildMockContracts(symbol, dataDate);
    }

    if (env.optionDataProvider === "custom") {
      console.log(`[数据源] 当前使用自定义数据源 symbol=${symbol} dataDate=${dataDate}`);
      return await fetchFromCustomApi(symbol, dataDate);
    }

    console.log(`[数据源] 当前使用 Alpaca 数据源 symbol=${symbol} dataDate=${dataDate}`);
    return await fetchFromAlpaca(symbol, dataDate);
  } catch (error) {
    if (env.useMockSource) {
      console.warn(`[数据源] 拉取失败，回退到 mock 数据 symbol=${symbol} dataDate=${dataDate}`, error);
      return buildMockContracts(symbol, dataDate);
    }

    throw error;
  }
};
