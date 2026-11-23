import request from "supertest";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { createApp } from "../src/app";
import { prisma } from "../src/db";
import { createUser, resetDb } from "./helpers";

const app = createApp();
const PASSWORD = "correct-horse";

beforeEach(async () => {
  await resetDb();
});

afterAll(async () => {
  await prisma.$disconnect();
});

function sessionCookie(res: request.Response): string {
  const cookies = ([] as string[]).concat(res.headers["set-cookie"] ?? []);
  const sid = cookies.find((c) => c.startsWith("sid="));
  if (!sid) throw new Error("No session cookie set");
  return sid;
}

describe("login", () => {
  it("sets an httpOnly SameSite=Lax session cookie and /me returns the user", async () => {
    const user = await createUser("alice@example.com", PASSWORD);
    const agent = request.agent(app);

    const res = await agent.post("/api/auth/login").send({ email: " ALICE@example.com ", password: PASSWORD });
    expect(res.status).toBe(200);
    expect(res.body.user).toEqual({ id: user.id, email: "alice@example.com" });

    const cookie = sessionCookie(res);
    expect(cookie).toMatch(/HttpOnly/i);
    expect(cookie).toMatch(/SameSite=Lax/i);
    expect(res.text).not.toContain(cookie.split(";")[0].slice(4)); // token never in the body

    const me = await agent.get("/api/auth/me");
    expect(me.status).toBe(200);
    expect(me.body.user.email).toBe("alice@example.com");
  });

  it("stores only a hash of the session token", async () => {
    await createUser("hash@example.com", PASSWORD);
    const res = await request(app).post("/api/auth/login").send({ email: "hash@example.com", password: PASSWORD });
    const token = sessionCookie(res).split(";")[0].slice(4);
    const session = await prisma.session.findFirstOrThrow();
    expect(session.id).not.toBe(token);
    expect(session.id).toMatch(/^[0-9a-f]{64}$/);
  });

  it("returns the same 401 for a wrong password and an unknown email", async () => {
    await createUser("bob@example.com", PASSWORD);
    const wrong = await request(app).post("/api/auth/login").send({ email: "bob@example.com", password: "nope-nope" });
    const unknown = await request(app).post("/api/auth/login").send({ email: "who@example.com", password: PASSWORD });
    for (const res of [wrong, unknown]) {
      expect(res.status).toBe(401);
      expect(res.body).toEqual({ error: "Invalid email or password.", code: "invalid_credentials" });
      expect(res.headers["set-cookie"]).toBeUndefined();
    }
  });

  it("refuses unverified users with 403 and no session", async () => {
    await createUser("carol@example.com", PASSWORD, { verified: false });
    const res = await request(app).post("/api/auth/login").send({ email: "carol@example.com", password: PASSWORD });
    expect(res.status).toBe(403);
    expect(res.body.code).toBe("email_not_verified");
    expect(res.headers["set-cookie"]).toBeUndefined();
    expect(await prisma.session.count()).toBe(0);
  });
});

describe("protected routes", () => {
  it("reject requests without a session", async () => {
    const res = await request(app).get("/api/auth/me");
    expect(res.status).toBe(401);
    expect(res.body.code).toBe("unauthenticated");
  });

  it("reject a forged session cookie", async () => {
    const res = await request(app).get("/api/auth/me").set("Cookie", "sid=forged");
    expect(res.status).toBe(401);
  });

  it("reject an expired session and delete it", async () => {
    await createUser("dave@example.com", PASSWORD);
    const agent = request.agent(app);
    await agent.post("/api/auth/login").send({ email: "dave@example.com", password: PASSWORD });
    await prisma.session.updateMany({ data: { expiresAt: new Date(Date.now() - 1000) } });

    expect((await agent.get("/api/auth/me")).status).toBe(401);
    expect(await prisma.session.count()).toBe(0);
  });

  it("return 404 (not 401) for unknown routes once authenticated", async () => {
    await createUser("erin@example.com", PASSWORD);
    const agent = request.agent(app);
    await agent.post("/api/auth/login").send({ email: "erin@example.com", password: PASSWORD });
    expect((await agent.get("/api/does-not-exist")).status).toBe(404);
  });
});

describe("logout", () => {
  it("deletes the session so the cookie stops working", async () => {
    await createUser("frank@example.com", PASSWORD);
    const login = await request(app).post("/api/auth/login").send({ email: "frank@example.com", password: PASSWORD });
    const cookie = sessionCookie(login).split(";")[0];

    const out = await request(app).post("/api/auth/logout").set("Cookie", cookie);
    expect(out.status).toBe(204);
    expect(sessionCookie(out)).toMatch(/Expires=Thu, 01 Jan 1970/);
    expect(await prisma.session.count()).toBe(0);

    expect((await request(app).get("/api/auth/me").set("Cookie", cookie)).status).toBe(401);
  });
});

describe("cross-origin protection", () => {
  it("blocks state-changing requests from a foreign Origin", async () => {
    await createUser("gina@example.com", PASSWORD);
    const res = await request(app)
      .post("/api/auth/login")
      .set("Host", "localhost:8080")
      .set("Origin", "https://evil.example")
      .send({ email: "gina@example.com", password: PASSWORD });
    expect(res.status).toBe(403);
    expect(res.body.code).toBe("bad_origin");
  });

  it("handles the opaque 'Origin: null' using Sec-Fetch-Site", async () => {
    await createUser("ivy@example.com", PASSWORD);
    const login = (fetchSite: string) =>
      request(app)
        .post("/api/auth/login")
        .set("Host", "localhost:8080")
        .set("Origin", "null")
        .set("Sec-Fetch-Site", fetchSite)
        .send({ email: "ivy@example.com", password: PASSWORD });
    expect((await login("same-origin")).status).toBe(200);
    expect((await login("cross-site")).status).toBe(403);
  });

  it("allows same-origin requests", async () => {
    await createUser("hank@example.com", PASSWORD);
    const res = await request(app)
      .post("/api/auth/login")
      .set("Host", "localhost:8080")
      .set("Origin", "http://localhost:8080")
      .send({ email: "hank@example.com", password: PASSWORD });
    expect(res.status).toBe(200);
  });
});
