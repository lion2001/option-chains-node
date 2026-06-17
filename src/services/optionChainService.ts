import { ensureOptionTable } from "../db/schema";
import { withDatabaseSession } from "../db/mysql";
import { DailyUpdateSummary, OptionContract } from "../types/options";
import { env } from "../config/env";
import { resolveTrackedOptionSymbols } from "../config/optionWatchlist";
import { fetchOptionContracts } from "./optionDataSource";
import { getPreviousTradingDate } from "../utils/tradingDate";

const UPSERT_SQL = `
  INSERT INTO option_daily_quotes (
    symbol,
    data_date,
    trade_date,
    expiry_date,
    strike,
    option_type,
    bid,
    ask,
    last_price,
    volume,
    open_interest,
    implied_volatility,
    source
  ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  ON DUPLICATE KEY UPDATE
    bid = VALUES(bid),
    ask = VALUES(ask),
    last_price = VALUES(last_price),
    volume = VALUES(volume),
    open_interest = VALUES(open_interest),
    implied_volatility = VALUES(implied_volatility),
    source = VALUES(source),
    updated_at = CURRENT_TIMESTAMP
`;

const upsertContracts = async (contracts: OptionContract[]): Promise<number> => {
  if (contracts.length === 0) {
    console.log("[数据库] 没有可入库的期权数据");
    return 0;
  }

  console.log(
    `[数据库] 开始写入期权数据 symbol=${contracts[0].symbol} dataDate=${contracts[0].dataDate} contracts=${contracts.length}`
  );

  const affectedRows = await withDatabaseSession(async (connection) => {
    let currentAffectedRows = 0;

    for (const contract of contracts) {
      const [result] = await connection.execute(UPSERT_SQL, [
        contract.symbol,
        contract.dataDate,
        contract.tradeDate,
        contract.expiryDate,
        contract.strike,
        contract.optionType,
        contract.bid,
        contract.ask,
        contract.last,
        contract.volume,
        contract.openInterest,
        contract.impliedVolatility,
        contract.source
      ]);

      if ("affectedRows" in result) {
        currentAffectedRows += result.affectedRows;
      }
    }

    return currentAffectedRows;
  });

  console.log(
    `[数据库] 期权数据写入完成 symbol=${contracts[0].symbol} dataDate=${contracts[0].dataDate} affectedRows=${affectedRows}`
  );

  return affectedRows;
};

export const runDailyOptionUpdate = async (
  targetSymbols: string[] = resolveTrackedOptionSymbols(env.optionSymbols)
): Promise<DailyUpdateSummary> => {
  const startedAt = new Date();
  const dataDate = getPreviousTradingDate(startedAt);
  const processedSymbols: string[] = [];
  let insertedOrUpdated = 0;

  console.log(
    `[更新任务] 开始执行每日期权更新 dataDate=${dataDate} symbols=${targetSymbols.join(",") || "none"}`
  );
  await ensureOptionTable();

  for (const symbol of targetSymbols) {
    console.log(`[更新任务] 开始拉取期权数据 symbol=${symbol} dataDate=${dataDate}`);
    const contracts = await fetchOptionContracts(symbol, dataDate);
    console.log(
      `[更新任务] 拉取完成 symbol=${symbol} dataDate=${dataDate} contracts=${contracts.length}`
    );

    const affectedRows = await upsertContracts(contracts);
    insertedOrUpdated += affectedRows;
    processedSymbols.push(symbol);

    console.log(
      `[更新任务] 入库完成 symbol=${symbol} dataDate=${dataDate} contracts=${contracts.length} affectedRows=${affectedRows}`
    );
  }

  console.log(
    `[更新任务] 全部处理完成 dataDate=${dataDate} processed=${processedSymbols.join(",")} totalAffectedRows=${insertedOrUpdated}`
  );

  return {
    requestedSymbols: targetSymbols,
    processedSymbols,
    insertedOrUpdated,
    startedAt: startedAt.toISOString(),
    finishedAt: new Date().toISOString()
  };
};
