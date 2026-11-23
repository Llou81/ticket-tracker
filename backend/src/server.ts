import { createApp } from "./app";
import { prisma } from "./db";

const port = Number(process.env.PORT ?? 3000);

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
