import express, { type ErrorRequestHandler } from "express";
import { healthRouter } from "./routes/health";

export function createApp() {
  const app = express();
  app.disable("x-powered-by");
  app.use(express.json());

  app.use("/api/health", healthRouter);

  app.use("/api", (_req, res) => {
    res.status(404).json({ error: "Not found" });
  });

  const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  };
  app.use(errorHandler);

  return app;
}
