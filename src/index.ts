import { createApp } from "./app";
import { ensureOptionTable } from "./db/schema";
import { verifyDatabaseConnection } from "./db/mysql";
import { env } from "./config/env";
import { startOptionUpdateJob } from "./jobs/dailyOptionUpdateJob";

const bootstrap = async (): Promise<void> => {
  await verifyDatabaseConnection();
  await ensureOptionTable();

  const app = createApp();

  app.listen(env.port, () => {
    console.log(`[服务] 期权服务已启动，监听端口 ${env.port}`);
  });

  startOptionUpdateJob();
};

bootstrap().catch((error) => {
  console.error("[服务] 启动失败", error);
  process.exit(1);
});
