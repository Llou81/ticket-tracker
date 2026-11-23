import { createHash, randomBytes } from "node:crypto";
import * as argon2 from "argon2";
import { Prisma, type User } from "@prisma/client";
import { config } from "../config";
import { prisma } from "../db";
import { HttpError } from "../errors";
import { mailer } from "./mailer";

export const VERIFICATION_TOKEN_TTL_MS = 24 * 60 * 60 * 1000;

export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

/** Creates an unverified account and emails a verification link. Email must already be normalized. */
export async function signUp(email: string, password: string) {
  const passwordHash = await argon2.hash(password, { type: argon2.argon2id });
  let user: User;
  try {
    user = await prisma.user.create({ data: { email, passwordHash } });
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      throw new HttpError(409, "An account with this email already exists.", "email_taken");
    }
    throw err;
  }
  const verificationEmailSent = await issueVerificationToken(user);
  return { email: user.email, verificationEmailSent };
}

export type VerifyResult = "verified" | "already_verified";

export async function verifyEmail(token: string): Promise<VerifyResult> {
  const now = new Date();
  return prisma.$transaction(async (tx) => {
    const record = await tx.emailVerificationToken.findUnique({
      where: { tokenHash: hashToken(token) },
      include: { user: true },
    });
    if (!record) {
      throw new HttpError(400, "This verification link is invalid.", "token_invalid");
    }
    if (record.user.emailVerifiedAt) return "already_verified";
    if (record.usedAt || record.invalidatedAt) {
      throw new HttpError(400, "This verification link is no longer valid. Request a new one.", "token_invalid");
    }
    if (record.expiresAt <= now) {
      throw new HttpError(410, "This verification link has expired. Request a new one.", "token_expired");
    }
    // Conditional update makes the token single-use even under concurrent requests.
    const { count } = await tx.emailVerificationToken.updateMany({
      where: { id: record.id, usedAt: null, invalidatedAt: null },
      data: { usedAt: now },
    });
    if (count === 0) {
      throw new HttpError(400, "This verification link is no longer valid. Request a new one.", "token_invalid");
    }
    await tx.user.update({ where: { id: record.userId }, data: { emailVerifiedAt: now } });
    return "verified";
  });
}

/** Resend using a previous (possibly expired or superseded) token from a verification link. */
export async function resendByToken(token: string): Promise<void> {
  const record = await prisma.emailVerificationToken.findUnique({
    where: { tokenHash: hashToken(token) },
    include: { user: true },
  });
  if (!record) {
    throw new HttpError(400, "This verification link is invalid.", "token_invalid");
  }
  if (record.user.emailVerifiedAt) {
    throw new HttpError(409, "This email address is already verified. You can log in.", "already_verified");
  }
  await issueOrFail(record.user);
}

/** Resend by email address. Responds the same whether or not the account exists. */
export async function resendByEmail(email: string): Promise<void> {
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user || user.emailVerifiedAt) return;
  await issueOrFail(user);
}

async function issueOrFail(user: User) {
  const sent = await issueVerificationToken(user);
  if (!sent) {
    throw new HttpError(503, "The verification email could not be sent. Please try again later.", "email_send_failed");
  }
}

/** Invalidates earlier unused tokens, stores a new one, and emails it. Returns whether the email was sent. */
async function issueVerificationToken(user: User): Promise<boolean> {
  const token = randomBytes(32).toString("base64url");
  const now = new Date();
  await prisma.$transaction([
    prisma.emailVerificationToken.updateMany({
      where: { userId: user.id, usedAt: null, invalidatedAt: null },
      data: { invalidatedAt: now },
    }),
    prisma.emailVerificationToken.create({
      data: {
        userId: user.id,
        tokenHash: hashToken(token),
        expiresAt: new Date(now.getTime() + VERIFICATION_TOKEN_TTL_MS),
      },
    }),
  ]);

  const link = `${config.appBaseUrl}/verify-email?token=${encodeURIComponent(token)}`;
  try {
    await mailer.send({
      to: user.email,
      subject: "Verify your Ticket Tracker account",
      text:
        `Welcome to Ticket Tracker!\n\n` +
        `Confirm your email address by opening this link:\n${link}\n\n` +
        `The link expires in 24 hours and can be used once. ` +
        `If you did not sign up, you can ignore this email.\n`,
    });
    return true;
  } catch (err) {
    console.error("Failed to send verification email:", err instanceof Error ? err.message : err);
    return false;
  }
}
