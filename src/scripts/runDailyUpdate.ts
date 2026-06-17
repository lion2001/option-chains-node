import { closePool, verifyDatabaseConnection } from "../db/mysql";
import { ensureOptionTable } from "../db/schema";
import { runDailyOptionUpdate } from "../services/optionChainService";

const main = async (): Promise<void> => {
  await verifyDatabaseConnection();
  await ensureOptionTable();

  const summary = await runDailyOptionUpdate();
  console.log("[脚本] 每日期权更新执行结果");
  console.log(JSON.stringify(summary, null, 2));
};

main()
  .catch((error) => {
    console.error("[脚本] 每日期权更新执行失败", error);
    process.exit(1);
  })
  .finally(async () => {
    await closePool();
  });
