import { createApp } from "./app";
import { config } from "./config";
import { prisma } from "./db";

const port = config.port;

const server = createApp().listen(port, () => {
  console.log(`API listening on port ${port}`);
});

function shutdown() {
  server.close(() => {
    prisma.$disconnect().finally(() => process.exit(0));
  });
}

process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);
