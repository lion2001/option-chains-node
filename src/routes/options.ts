import { Request, Router } from "express";

import { triggerOptionUpdate } from "../jobs/dailyOptionUpdateJob";

export const optionRouter = Router();

const normalizeSymbolsFromRequest = (request: Request): string[] | undefined => {
  const symbols = request.body?.symbols;

  if (symbols === undefined) {
    return undefined;
  }

  if (!Array.isArray(symbols)) {
    throw new Error("请求体中的 symbols 必须是字符串数组。");
  }

  const normalized = Array.from(
    new Set(
      symbols
        .map((item) => (typeof item === "string" ? item.trim().toUpperCase() : ""))
        .filter(Boolean)
    )
  );

  if (normalized.length === 0) {
    throw new Error("请求体中的 symbols 不能为空。");
  }

  return normalized;
};

optionRouter.post("/update", async (request, response) => {
  try {
    const targetSymbols = normalizeSymbolsFromRequest(request);
    const summary = await triggerOptionUpdate(targetSymbols);
    response.json({
      success: true,
      summary
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "未知错误";
    const statusCode =
      message.includes("symbols 必须是字符串数组") || message.includes("symbols 不能为空")
        ? 400
        : 500;

    response.status(statusCode).json({
      success: false,
      message
    });
  }
});
