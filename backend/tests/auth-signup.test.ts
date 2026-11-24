import request from "supertest";
import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import { createApp } from "../src/app";
import { prisma } from "../src/db";
import { mailer } from "../src/services/mailer";
import { captureMail, resetDb, tokenFrom } from "./helpers";

const app = createApp();
const signUp = (email: string, password = "correct-horse") =>
  request(app).post("/api/auth/signup").send({ email, password });
const verify = (token: string) => request(app).post("/api/auth/verify-email").send({ token });
const resend = (body: object) => request(app).post("/api/auth/resend-verification").send(body);

let mail: ReturnType<typeof captureMail>;

beforeEach(async () => {
  vi.restoreAllMocks();
  await resetDb();
  mail = captureMail();
});

afterAll(async () => {
  await prisma.$disconnect();
});

describe("sign-up", () => {
  it("creates an unverified user with an Argon2id hash and emails a verification link", async () => {
    const res = await signUp("  Alice@Example.COM ");
    expect(res.status).toBe(201);
    expect(res.body).toEqual({ email: "alice@example.com", verificationEmailSent: true });

    const user = await prisma.user.findUniqueOrThrow({ where: { email: "alice@example.com" } });
    expect(user.emailVerifiedAt).toBeNull();
    expect(user.passwordHash).toMatch(/^\$argon2id\$/);
    expect(user.passwordHash).not.toContain("correct-horse");

    expect(mail.outbox).toHaveLength(1);
    expect(mail.outbox[0].to).toBe("alice@example.com");
    expect(mail.outbox[0].text).toContain("http://localhost:8080/verify-email?token=");
  });

  it("rejects a duplicate email regardless of case and whitespace", async () => {
    await signUp("bob@example.com");
    const res = await signUp(" BOB@example.com");
    expect(res.status).toBe(409);
    expect(res.body.code).toBe("email_taken");
  });

  it("validates email and password length", async () => {
    const res = await request(app).post("/api/auth/signup").send({ email: "not-an-email", password: "short" });
    expect(res.status).toBe(400);
    expect(res.body.fields).toMatchObject({
      email: "Enter a valid email address.",
      password: "Password must be at least 8 characters.",
    });
    expect(await prisma.user.count()).toBe(0);
  });

  it("still creates the account when the email cannot be sent", async () => {
    vi.spyOn(mailer, "send").mockRejectedValue(new Error("SMTP down"));
    vi.spyOn(console, "error").mockImplementation(() => {});
    const res = await signUp("carol@example.com");
    expect(res.status).toBe(201);
    expect(res.body.verificationEmailSent).toBe(false);
    expect(await prisma.user.count()).toBe(1);
  });
});

describe("email verification", () => {
  it("verifies once; reusing the link reports already verified", async () => {
    await signUp("dave@example.com");
    const token = tokenFrom(mail.outbox[0]);

    const first = await verify(token);
    expect(first.status).toBe(200);
    expect(first.body.status).toBe("verified");
    const user = await prisma.user.findUniqueOrThrow({ where: { email: "dave@example.com" } });
    expect(user.emailVerifiedAt).not.toBeNull();

    const second = await verify(token);
    expect(second.status).toBe(200);
    expect(second.body.status).toBe("already_verified");
  });

  it("rejects an expired token with 410 and allows resending from it", async () => {
    await signUp("erin@example.com");
    const token = tokenFrom(mail.outbox[0]);
    await prisma.emailVerificationToken.updateMany({ data: { expiresAt: new Date(Date.now() - 1000) } });

    const res = await verify(token);
    expect(res.status).toBe(410);
    expect(res.body.code).toBe("token_expired");

    const again = await resend({ token });
    expect(again.status).toBe(202);
    expect(mail.outbox).toHaveLength(2);
    expect((await verify(tokenFrom(mail.outbox[1]))).body.status).toBe("verified");
  });

  it("issuing a new token invalidates earlier unused ones", async () => {
    await signUp("frank@example.com");
    const oldToken = tokenFrom(mail.outbox[0]);
    await resend({ email: "FRANK@example.com" });
    const newToken = tokenFrom(mail.outbox[1]);

    const old = await verify(oldToken);
    expect(old.status).toBe(400);
    expect(old.body.code).toBe("token_invalid");

    expect((await verify(newToken)).body.status).toBe("verified");
  });

  it("rejects unknown tokens", async () => {
    const res = await verify("nope");
    expect(res.status).toBe(400);
    expect(res.body.code).toBe("token_invalid");
  });
});

describe("resend verification", () => {
  it("sends a new link to an existing unverified account and says where", async () => {
    await signUp("hank@example.com");
    const res = await resend({ email: "  HANK@example.com " });
    expect(res.status).toBe(202);
    expect(res.body).toEqual({
      email: "hank@example.com",
      message: "A new verification email has been sent to hank@example.com.",
    });
    expect(mail.outbox).toHaveLength(2);
    expect(mail.outbox[1].to).toBe("hank@example.com");
    expect((await verify(tokenFrom(mail.outbox[1]))).body.status).toBe("verified");
  });

  it("reports an unregistered email and sends nothing", async () => {
    const res = await resend({ email: "ghost@example.com" });
    expect(res.status).toBe(404);
    expect(res.body.code).toBe("email_not_registered");
    expect(res.body.error).toBe("This email address is not registered. Sign up to create an account.");
    expect(mail.outbox).toHaveLength(0);
  });

  it("reports an already-verified email (by address or old link) and sends nothing", async () => {
    await signUp("gina@example.com");
    const token = tokenFrom(mail.outbox[0]);
    await verify(token);

    const byEmail = await resend({ email: "Gina@Example.com" });
    expect(byEmail.status).toBe(409);
    expect(byEmail.body.code).toBe("already_verified");
    expect(byEmail.body.error).toBe("This email address is already verified. You can log in.");

    const byToken = await resend({ token });
    expect(byToken.status).toBe(409);
    expect(byToken.body.code).toBe("already_verified");

    expect(mail.outbox).toHaveLength(1);
  });

  it("validates the email address", async () => {
    const res = await resend({ email: "not-an-email" });
    expect(res.status).toBe(400);
    expect(mail.outbox).toHaveLength(0);
  });

  it("reports a send failure with 503", async () => {
    await signUp("ivan@example.com");
    vi.spyOn(mailer, "send").mockRejectedValue(new Error("SMTP down"));
    vi.spyOn(console, "error").mockImplementation(() => {});
    const res = await resend({ email: "ivan@example.com" });
    expect(res.status).toBe(503);
    expect(res.body.code).toBe("email_send_failed");
  });
});
