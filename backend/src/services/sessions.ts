import type { User } from "@prisma/client";
import { prisma } from "../db";
import { hashToken, randomToken } from "../util/tokens";

export const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000;
/** Sliding expiry: extend at most once per this interval to avoid a write on every request. */
const REFRESH_INTERVAL_MS = 24 * 60 * 60 * 1000;

export async function createSession(userId: string) {
  const token = randomToken();
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS);
  await prisma.session.create({ data: { id: hashToken(token), userId, expiresAt } });
  return { token, expiresAt };
}

export interface ActiveSession {
  user: User;
  expiresAt: Date;
  /** True when the expiry was extended and the cookie should be re-issued. */
  refreshed: boolean;
}

export async function getActiveSession(token: string): Promise<ActiveSession | null> {
  const id = hashToken(token);
  const session = await prisma.session.findUnique({ where: { id }, include: { user: true } });
  if (!session) return null;

  const now = Date.now();
  if (session.expiresAt.getTime() <= now) {
    await prisma.session.deleteMany({ where: { id } });
    return null;
  }
  if (!session.user.emailVerifiedAt) return null;

  if (session.expiresAt.getTime() - now < SESSION_TTL_MS - REFRESH_INTERVAL_MS) {
    const expiresAt = new Date(now + SESSION_TTL_MS);
    await prisma.session.update({ where: { id }, data: { expiresAt } });
    return { user: session.user, expiresAt, refreshed: true };
  }
  return { user: session.user, expiresAt: session.expiresAt, refreshed: false };
}

export async function deleteSession(token: string) {
  await prisma.session.deleteMany({ where: { id: hashToken(token) } });
}
