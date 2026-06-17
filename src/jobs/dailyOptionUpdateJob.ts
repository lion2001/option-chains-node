import cron from "node-cron";

import { env } from "../config/env";
import { runDailyOptionUpdate } from "../services/optionChainService";

let running = false;

export const triggerOptionUpdate = async (targetSymbols?: string[]) => {
  if (running) {
    throw new Error("期权更新任务正在执行中，请稍后重试。");
  }

  running = true;

  try {
    return await runDailyOptionUpdate(targetSymbols);
  } finally {
    running = false;
  }
};

export const startOptionUpdateJob = (): void => {
  cron.schedule(env.optionUpdateCron, async () => {
    try {
      const result = await triggerOptionUpdate();
      console.log("[定时任务] 期权更新执行完成", result);
    } catch (error) {
      console.error("[定时任务] 期权更新执行失败", error);
    }
  });

  console.log(`[定时任务] 已启动期权更新调度 cron=${env.optionUpdateCron}`);
};
