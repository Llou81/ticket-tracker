import express from "express";
import { errorHandler } from "./errors";
import { authRouter } from "./routes/auth";
import { healthRouter } from "./routes/health";

export function createApp() {
  const app = express();
  app.disable("x-powered-by");
  app.use(express.json({ limit: "100kb" }));

  // Public routes.
  app.use("/api/health", healthRouter);
  app.use("/api/auth", authRouter);

  app.use("/api", (_req, res) => {
    res.status(404).json({ error: "Not found" });
  });

  app.use(errorHandler);
  return app;
}
