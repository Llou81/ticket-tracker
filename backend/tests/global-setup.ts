import { execSync } from "node:child_process";
import { PrismaClient } from "@prisma/client";

/**
 * Rebuilds the test database from migrations, then asserts it holds no application data.
 * This doubles as the "fresh database has schema + migration metadata only" check.
 */
export default async function setup() {
  execSync("npx prisma migrate reset --force --skip-seed --skip-generate", { stdio: "inherit" });

  const prisma = new PrismaClient();
  try {
    const tables = await prisma.$queryRaw<{ tablename: string }[]>`
      SELECT tablename FROM pg_tables
      WHERE schemaname = 'public' AND tablename <> '_prisma_migrations'`;
    for (const { tablename } of tables) {
      const [{ count }] = await prisma.$queryRawUnsafe<{ count: bigint }[]>(
        `SELECT count(*) AS count FROM "${tablename}"`,
      );
      if (count !== 0n) {
        throw new Error(`Fresh database is not empty: "${tablename}" has ${count} rows after migrations`);
      }
    }
  } finally {
    await prisma.$disconnect();
  }
}
