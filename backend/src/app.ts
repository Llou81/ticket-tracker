import express from "express";
import { errorHandler } from "./errors";
import { requireAuth } from "./middleware/auth";
import { sameOrigin } from "./middleware/sameOrigin";
import { authRouter } from "./routes/auth";
import { epicsRouter } from "./routes/epics";
import { healthRouter } from "./routes/health";
import { teamsRouter } from "./routes/teams";

export function createApp() {
  const app = express();
  app.disable("x-powered-by");
  app.use(express.json({ limit: "100kb" }));
  app.use("/api", sameOrigin);

  // Public routes: health, sign-up, login/logout, verification, resend.
  // (/api/auth/me applies requireAuth itself.)
  app.use("/api/health", healthRouter);
  app.use("/api/auth", authRouter);

  // Everything below requires a verified user's session.
  app.use("/api", requireAuth);
  app.use("/api/teams", teamsRouter);
  app.use("/api/epics", epicsRouter);

  app.use("/api", (_req, res) => {
    res.status(404).json({ error: "Not found" });
  });

  app.use(errorHandler);
  return app;
}
