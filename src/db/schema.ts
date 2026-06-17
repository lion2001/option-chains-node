import { PoolConnection } from "mysql2/promise";

import { withDatabaseSession } from "./mysql";

const getExistingColumns = async (connection: PoolConnection): Promise<string[]> => {
  const [rows] = await connection.query("SHOW COLUMNS FROM option_daily_quotes");

  return Array.isArray(rows)
    ? rows
        .map((row) => {
          if (typeof row === "object" && row && "Field" in row && typeof row.Field === "string") {
            return row.Field;
          }

          return "";
        })
        .filter(Boolean)
    : [];
};

const getIndexColumns = async (
  connection: PoolConnection,
  indexName: string
): Promise<string[]> => {
  const [rows] = await connection.query("SHOW INDEX FROM option_daily_quotes WHERE Key_name = ?", [
    indexName
  ]);

  if (!Array.isArray(rows)) {
    return [];
  }

  return rows
    .map((row) => {
      if (
        typeof row === "object" &&
        row &&
        "Column_name" in row &&
        typeof row.Column_name === "string" &&
        "Seq_in_index" in row
      ) {
        return {
          columnName: row.Column_name,
          sequence: Number(row.Seq_in_index)
        };
      }

      return null;
    })
    .filter((item): item is { columnName: string; sequence: number } => item !== null)
    .sort((left, right) => left.sequence - right.sequence)
    .map((item) => item.columnName);
};

const ensureIndex = async (
  connection: PoolConnection,
  indexName: string,
  expectedColumns: string[],
  createSql: string,
  dropSql?: string
): Promise<void> => {
  const existingColumns = await getIndexColumns(connection, indexName);

  if (existingColumns.join(",") === expectedColumns.join(",")) {
    return;
  }

  if (existingColumns.length > 0 && dropSql) {
    await connection.execute(dropSql);
    console.log(`[数据库] 已删除旧索引 ${indexName}`);
  }

  await connection.execute(createSql);
  console.log(`[数据库] 已创建索引 ${indexName}`);
};

export const ensureOptionTable = async (): Promise<void> => {
  await withDatabaseSession(async (connection) => {
    console.log("[数据库] 正在确保 option_daily_quotes 表存在");
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS option_daily_quotes (
        id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
        symbol VARCHAR(32) NOT NULL,
        data_date DATE NOT NULL,
        trade_date DATE NOT NULL,
        expiry_date DATE NOT NULL,
        strike DECIMAL(12, 4) NOT NULL,
        option_type ENUM('CALL', 'PUT') NOT NULL,
        bid DECIMAL(12, 4) NULL,
        ask DECIMAL(12, 4) NULL,
        last_price DECIMAL(12, 4) NULL,
        volume INT NULL,
        open_interest INT NULL,
        implied_volatility DECIMAL(10, 6) NULL,
        source VARCHAR(64) NOT NULL,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        PRIMARY KEY (id),
        UNIQUE KEY uniq_option_daily (
          symbol,
          data_date,
          expiry_date,
          strike,
          option_type
        ),
        KEY idx_symbol_data_date (symbol, data_date),
        KEY idx_data_date_symbol (data_date, symbol),
        KEY idx_symbol_expiry_data_date (symbol, expiry_date, data_date)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);

    const existingColumns = await getExistingColumns(connection);

    if (!existingColumns.includes("data_date")) {
      await connection.execute("ALTER TABLE option_daily_quotes ADD COLUMN data_date DATE NULL AFTER symbol");
      console.log("[数据库] 已补充 data_date 字段");
    }

    await connection.execute(
      "UPDATE option_daily_quotes SET data_date = trade_date WHERE data_date IS NULL OR data_date = '0000-00-00'"
    );
    await connection.execute("ALTER TABLE option_daily_quotes MODIFY COLUMN data_date DATE NOT NULL");

    await ensureIndex(
      connection,
      "uniq_option_daily",
      ["symbol", "data_date", "expiry_date", "strike", "option_type"],
      `ALTER TABLE option_daily_quotes
        ADD UNIQUE KEY uniq_option_daily (
          symbol,
          data_date,
          expiry_date,
          strike,
          option_type
        )`,
      "ALTER TABLE option_daily_quotes DROP INDEX uniq_option_daily"
    );
    await ensureIndex(
      connection,
      "idx_symbol_data_date",
      ["symbol", "data_date"],
      "ALTER TABLE option_daily_quotes ADD KEY idx_symbol_data_date (symbol, data_date)"
    );
    await ensureIndex(
      connection,
      "idx_data_date_symbol",
      ["data_date", "symbol"],
      "ALTER TABLE option_daily_quotes ADD KEY idx_data_date_symbol (data_date, symbol)"
    );
    await ensureIndex(
      connection,
      "idx_symbol_expiry_data_date",
      ["symbol", "expiry_date", "data_date"],
      "ALTER TABLE option_daily_quotes ADD KEY idx_symbol_expiry_data_date (symbol, expiry_date, data_date)"
    );

    console.log("[数据库] option_daily_quotes 表已就绪");
  });
};
