import * as argon2 from "argon2";
import { vi } from "vitest";
import { prisma } from "../src/db";
import { mailer, type MailMessage } from "../src/services/mailer";

/** Empties every application table (keeps migration metadata). */
export async function resetDb() {
  const tables = await prisma.$queryRaw<{ tablename: string }[]>`
    SELECT tablename FROM pg_tables
    WHERE schemaname = 'public' AND tablename <> '_prisma_migrations'`;
  if (tables.length === 0) return;
  const list = tables.map((t) => `"${t.tablename}"`).join(", ");
  await prisma.$executeRawUnsafe(`TRUNCATE ${list} RESTART IDENTITY CASCADE`);
}

/** Replaces SMTP delivery with an in-memory outbox. */
export function captureMail() {
  const outbox: MailMessage[] = [];
  const spy = vi.spyOn(mailer, "send").mockImplementation(async (message) => {
    outbox.push(message);
  });
  return { outbox, spy };
}

/** Inserts a user directly (bypassing sign-up email). */
export async function createUser(email: string, password: string, { verified = true } = {}) {
  return prisma.user.create({
    data: {
      email,
      passwordHash: await argon2.hash(password, { type: argon2.argon2id }),
      emailVerifiedAt: verified ? new Date() : null,
    },
  });
}

/** Pulls the raw verification token out of an email's link. */
export function tokenFrom(message: MailMessage): string {
  const match = message.text.match(/verify-email\?token=([^\s]+)/);
  if (!match) throw new Error("No verification link in email");
  return decodeURIComponent(match[1]);
}
