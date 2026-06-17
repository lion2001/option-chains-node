# option-chains-node

一个基于 `Node.js + TypeScript + Express + MySQL` 的后端服务，用于按日拉取并写入期权链数据。

默认接入 `Alpaca Options Market Data API` 的免费延迟数据源，也保留 mock 与自定义接口模式。

Alpaca 数据接入默认参考官方 JS SDK `@alpacahq/alpaca-trade-api` 的 `getOptionChain()` 能力实现。

默认维护一组重点标的：`POET`、`AAOI`、`MRVL`、`LITE`、`ALAB`、`COHR`。

## 功能

- 提供健康检查接口 `GET /health`
- 提供手动触发更新接口 `POST /api/options/update`
- 启动时自动连接本地 MySQL 并确保目标表存在
- 使用 `cron` 定时执行每日期权数据更新
- 默认按“上一个交易日”归档数据，并写入 `data_date` 作为逻辑分区字段
- 支持 Alpaca 官方免费延迟期权链、外部自定义 API 和本地 mock 数据源
- `alpaca` 模式会在快照后补充 `volume` 和 `open_interest`

## 项目结构

```text
.
├── src
│   ├── app.ts
│   ├── config
│   │   ├── env.ts
│   │   └── optionWatchlist.ts
│   ├── db
│   │   ├── mysql.ts
│   │   └── schema.ts
│   ├── jobs/dailyOptionUpdateJob.ts
│   ├── routes
│   │   ├── health.ts
│   │   └── options.ts
│   ├── scripts/runDailyUpdate.ts
│   ├── services
│   │   ├── optionChainService.ts
│   │   └── optionDataSource.ts
│   ├── types/options.ts
│   ├── utils/tradingDate.ts
│   └── index.ts
├── sql/init.sql
├── .env.example
├── package.json
└── tsconfig.json
```

## 环境变量

复制环境变量模板：

```bash
cp .env.example .env
```

关键配置项：

- `MYSQL_HOST` / `MYSQL_PORT` / `MYSQL_USER` / `MYSQL_PASSWORD` / `MYSQL_DATABASE`
- `OPTION_SYMBOLS`: 需要更新的标的，例如 `POET,AAOI,MRVL,LITE,ALAB,COHR`
- `OPTION_UPDATE_CRON`: 定时表达式，默认工作日 18:30 执行
- `OPTION_DATA_PROVIDER`: 数据源类型，支持 `alpaca` / `custom` / `mock`
- `ALPACA_API_KEY_ID` / `ALPACA_API_SECRET_KEY`: Alpaca 账号密钥
- `ALPACA_OPTION_FEED`: 默认 `indicative`，即官方免费延迟数据
- `OPTION_CONTRACT_LIMIT`: Alpaca 单次分页请求大小，服务会自动翻页直到拿完整个当前快照链
- `OPTION_EXPIRATION_DATE` / `OPTION_EXPIRATION_DATE_GTE` / `OPTION_EXPIRATION_DATE_LTE`: 过期日过滤条件
- `OPTION_TYPE`: 合约类型过滤，支持 `call` / `put`
- `OPTION_DATA_API_URL`: 自定义期权数据源地址
- `OPTION_DATA_API_KEY`: 自定义接口密钥
- `USE_MOCK_SOURCE`: 未配置外部 API 时是否使用 mock 数据

## 初始化步骤

请先确保本机已安装 Node.js 20+ 与本地 MySQL。

```bash
npm install
cp .env.example .env
```

如果使用默认的 Alpaca 数据源：

1. 注册一个免费账号
2. 在控制台生成 `API Key ID` 和 `Secret Key`
3. 将它们填入 `.env` 中的 `ALPACA_API_KEY_ID` 和 `ALPACA_API_SECRET_KEY`

默认使用 `indicative` feed，适合免费测试和每日批量更新。

如果你希望手动初始化数据库：

```bash
mysql -u root -p < sql/init.sql
```

> 服务启动时也会自动尝试创建 `option_daily_quotes` 表。

## 默认标的列表

默认 watchlist 定义在 `src/config/optionWatchlist.ts`：

```ts
["POET", "AAOI", "MRVL", "LITE", "ALAB", "COHR"]
```

如果 `.env` 里配置了 `OPTION_SYMBOLS`，会优先使用环境变量；未配置时则回退到这份默认列表。

## 数据归档设计

`option_daily_quotes` 表里保留两个日期字段：

- `trade_date`: 记录这批期权数据归属的交易日
- `data_date`: 作为“类似 Hive `dt` 分区”的逻辑分区字段，当前默认与 `trade_date` 保持一致

为了便于查看单个标的的趋势波动，表上额外增加了这些索引：

- `(symbol, data_date)`
- `(data_date, symbol)`
- `(symbol, expiry_date, data_date)`

示例查询：

```sql
SELECT
  data_date,
  expiry_date,
  option_type,
  strike,
  bid,
  ask,
  last_price,
  implied_volatility,
  open_interest
FROM option_daily_quotes
WHERE symbol = 'MRVL'
  AND data_date BETWEEN '2026-06-01' AND '2026-06-30'
ORDER BY data_date, expiry_date, strike, option_type;
```

> 注意：当前 Alpaca `getOptionChain()` 拉取的是执行时的最新期权链快照。服务会把这批数据按“上一个交易日”归档到 `data_date`，便于日级分析；如果后续要做严格历史回放，需要接入支持历史链快照的数据源。

## 启动项目

开发模式：

```bash
npm run dev
```

构建：

```bash
npm run build
```

生产启动：

```bash
npm run start
```

手动执行一次每日更新：

```bash
npm run update:options
```

## API

健康检查：

```bash
curl http://localhost:3000/health
```

手动更新：

```bash
curl -X POST http://localhost:3000/api/options/update
```

只更新指定标的：

```bash
curl -X POST http://localhost:3000/api/options/update \
  -H "Content-Type: application/json" \
  -d '{"symbols":["POET"]}'
```

## 接入真实期权数据源

当前 `src/services/optionDataSource.ts` 内置了三种模式：

- `OPTION_DATA_PROVIDER=alpaca` 时，从 Alpaca 官方接口拉取期权链
- `OPTION_DATA_PROVIDER=custom` 时，从自定义 API 拉取
- `OPTION_DATA_PROVIDER=mock` 时，写入示例 mock 数据

当前 `alpaca` 模式会按照 `next_page_token` 自动翻页，直到拉完整个标的的当前期权链快照；`OPTION_CONTRACT_LIMIT` 只控制每页大小，不再限制总返回条数。

为了尽量补齐链上字段，当前实现还会在快照拉取完成后：

- 通过 `GET https://data.alpaca.markets/v1beta1/options/bars` 按合约批量补充 `volume`
- 通过 `GET https://paper-api.alpaca.markets/v2/options/contracts` 分页补充 `open_interest`

如果补数接口临时失败，主流程仍会保留快照已返回的数据继续入库，并在日志里打印中文告警。

默认模式会请求：

```text
GET https://data.alpaca.markets/v1beta1/options/snapshots/{symbol}
```

并使用 `APCA-API-KEY-ID` / `APCA-API-SECRET-KEY` 进行鉴权。

如果你的数据源返回结构和当前实现不同，只需要修改 `normalizeApiContract()` 或 `normalizeAlpacaSnapshot()` 即可。
