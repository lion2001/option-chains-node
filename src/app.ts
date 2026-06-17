import express from "express";

import { healthRouter } from "./routes/health";
import { optionRouter } from "./routes/options";

export const createApp = () => {
  const app = express();

  app.use(express.json());
  app.use("/health", healthRouter);
  app.use("/api/options", optionRouter);

  return app;
};
