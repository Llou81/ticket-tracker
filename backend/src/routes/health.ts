import { Router } from "express";
import { prisma } from "../db";

export const healthRouter = Router();

// Public: liveness + database readiness.
healthRouter.get("/", async (_req, res) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    res.json({ status: "ok", database: "ok" });
  } catch {
    res.status(503).json({ status: "error", database: "unavailable" });
  }
});
