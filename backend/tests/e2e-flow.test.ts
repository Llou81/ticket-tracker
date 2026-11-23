import request from "supertest";
import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import { createApp } from "../src/app";
import { prisma } from "../src/db";
import { captureMail, resetDb, tokenFrom } from "./helpers";

/**
 * The whole user journey through the HTTP API, the way the SPA drives it:
 * sign up → verification email → verify → log in → team → epic → ticket → drag to another
 * state → "refresh" → comment → log out.
 */
const app = createApp();

beforeEach(async () => {
  vi.restoreAllMocks();
  await resetDb();
});

afterAll(async () => {
  await prisma.$disconnect();
});

describe("end-to-end API flow", () => {
  it("takes a new user from sign-up to a moved, commented ticket", async () => {
    const mail = captureMail();
    const browser = request.agent(app); // keeps cookies like a browser tab
    const origin = { Origin: "http://localhost:8080", Host: "localhost:8080" };

    // 1. Sign up; the account is unusable until verified.
    const signup = await browser.post("/api/auth/signup").set(origin).send({ email: "Qa@Example.com", password: "s3cret-pass" });
    expect(signup.status).toBe(201);
    const blocked = await browser.post("/api/auth/login").set(origin).send({ email: "qa@example.com", password: "s3cret-pass" });
    expect(blocked.status).toBe(403);
    expect((await browser.get("/api/teams")).status).toBe(401);

    // 2. Verify through the emailed link, then log in.
    expect(mail.outbox).toHaveLength(1);
    const verify = await browser.post("/api/auth/verify-email").set(origin).send({ token: tokenFrom(mail.outbox[0]) });
    expect(verify.body.status).toBe("verified");
    const login = await browser.post("/api/auth/login").set(origin).send({ email: "qa@example.com", password: "s3cret-pass" });
    expect(login.status).toBe(200);
    expect((await browser.get("/api/auth/me")).body.user.email).toBe("qa@example.com");

    // 3. Set up a team and an epic; create two tickets.
    const team = (await browser.post("/api/teams").set(origin).send({ name: "Payments" })).body;
    const epic = (await browser.post("/api/epics").set(origin).send({ teamId: team.id, title: "Checkout" })).body;
    const first = (
      await browser
        .post("/api/tickets")
        .set(origin)
        .send({ teamId: team.id, epicId: epic.id, type: "bug", title: "Card declined", body: "Steps to reproduce" })
    ).body;
    await new Promise((r) => setTimeout(r, 10));
    const second = (
      await browser.post("/api/tickets").set(origin).send({ teamId: team.id, type: "feature", title: "Apple Pay", body: "Add it" })
    ).body;
    expect(first.createdBy.email).toBe("qa@example.com");

    let board = (await browser.get(`/api/tickets?teamId=${team.id}`)).body;
    expect(board.map((t: { id: string }) => t.id)).toEqual([second.id, first.id]);

    // 4. Drag the older ticket to "in_progress": the state persists and it moves to the top.
    await new Promise((r) => setTimeout(r, 10));
    const moved = await browser.patch(`/api/tickets/${first.id}`).set(origin).send({ state: "in_progress" });
    expect(moved.status).toBe(200);

    // 5. "Refresh the page": a fresh load reflects the move.
    board = (await browser.get(`/api/tickets?teamId=${team.id}`)).body;
    expect(board[0]).toMatchObject({ id: first.id, state: "in_progress", epicTitle: "Checkout" });
    expect(board[1]).toMatchObject({ id: second.id, state: "new" });

    // 6. Comment; the ticket's modifiedAt and board order stay put.
    const comment = await browser.post(`/api/tickets/${second.id}/comments`).set(origin).send({ body: "On it" });
    expect(comment.body.author.email).toBe("qa@example.com");
    board = (await browser.get(`/api/tickets?teamId=${team.id}`)).body;
    expect(board.map((t: { id: string }) => t.id)).toEqual([first.id, second.id]);

    // 7. Referenced records are protected.
    expect((await browser.delete(`/api/epics/${epic.id}`).set(origin)).status).toBe(409);
    expect((await browser.delete(`/api/teams/${team.id}`).set(origin)).status).toBe(409);

    // 8. Log out: the session is gone.
    expect((await browser.post("/api/auth/logout").set(origin)).status).toBe(204);
    expect((await browser.get(`/api/tickets?teamId=${team.id}`)).status).toBe(401);
  });
});
