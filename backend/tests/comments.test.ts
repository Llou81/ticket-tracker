import request from "supertest";
import type TestAgent from "supertest/lib/agent";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { createApp } from "../src/app";
import { prisma } from "../src/db";
import { createUser, loggedInAgent, resetDb } from "./helpers";

const app = createApp();
let agent: TestAgent;
let ticket: { id: string; modifiedAt: string; teamId: string };

const ISO_UTC = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;
const sleep = () => new Promise((r) => setTimeout(r, 10));

beforeEach(async () => {
  await resetDb();
  agent = await loggedInAgent(app, "alice@example.com");
  const team = (await agent.post("/api/teams").send({ name: "Alpha" })).body;
  ticket = (await agent.post("/api/tickets").send({ teamId: team.id, type: "bug", title: "T", body: "B" })).body;
});

afterAll(async () => {
  await prisma.$disconnect();
});

const comments = (id = ticket.id) => `/api/tickets/${id}/comments`;

describe("comments", () => {
  it("require authentication", async () => {
    expect((await request(app).get(comments())).status).toBe(401);
    expect((await request(app).post(comments()).send({ body: "x" })).status).toBe(401);
  });

  it("are created with the author and a UTC timestamp", async () => {
    const res = await agent.post(comments()).send({ body: "Looks good\n\n- point" });
    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({
      ticketId: ticket.id,
      body: "Looks good\n\n- point",
      author: { email: "alice@example.com" },
    });
    expect(res.body.createdAt).toMatch(ISO_UTC);
  });

  it("are listed oldest first, with each author", async () => {
    await agent.post(comments()).send({ body: "first" });
    await sleep();

    await createUser("bob@example.com", "bob-password");
    const bob = request.agent(app);
    await bob.post("/api/auth/login").send({ email: "bob@example.com", password: "bob-password" });
    await bob.post(comments()).send({ body: "second" });
    await sleep();
    await agent.post(comments()).send({ body: "third" });

    const res = await agent.get(comments());
    expect(res.status).toBe(200);
    expect(res.body.map((c: { body: string; author: { email: string } }) => [c.body, c.author.email])).toEqual([
      ["first", "alice@example.com"],
      ["second", "bob@example.com"],
      ["third", "alice@example.com"],
    ]);
  });

  it("reject empty and whitespace-only bodies", async () => {
    for (const body of ["", "  \n\t ", undefined]) {
      const res = await agent.post(comments()).send({ body });
      expect(res.status).toBe(400);
      expect(res.body.fields.body).toBeDefined();
    }
    expect(await prisma.comment.count()).toBe(0);
  });

  it("do not change the ticket's modifiedAt or its board position", async () => {
    const other = (
      await agent.post("/api/tickets").send({ teamId: ticket.teamId, type: "fix", title: "Newer", body: "B" })
    ).body;
    await sleep();
    await agent.post(comments()).send({ body: "a comment" });

    const after = await agent.get(`/api/tickets/${ticket.id}`);
    expect(after.body.modifiedAt).toBe(ticket.modifiedAt);

    const board = await agent.get(`/api/tickets?teamId=${ticket.teamId}`);
    expect(board.body.map((t: { id: string }) => t.id)).toEqual([other.id, ticket.id]);
  });

  it("return 404 for unknown tickets", async () => {
    const missing = "00000000-0000-0000-0000-000000000000";
    expect((await agent.get(comments(missing))).status).toBe(404);
    expect((await agent.post(comments(missing)).send({ body: "x" })).status).toBe(404);
  });

  it("cannot be edited or deleted (immutable)", async () => {
    const c = (await agent.post(comments()).send({ body: "fixed" })).body;
    expect((await agent.patch(`${comments()}/${c.id}`).send({ body: "changed" })).status).toBe(404);
    expect((await agent.delete(`${comments()}/${c.id}`)).status).toBe(404);
    expect((await prisma.comment.findUniqueOrThrow({ where: { id: c.id } })).body).toBe("fixed");
  });

  it("are deleted together with their ticket", async () => {
    await agent.post(comments()).send({ body: "one" });
    await agent.post(comments()).send({ body: "two" });
    expect(await prisma.comment.count()).toBe(2);

    expect((await agent.delete(`/api/tickets/${ticket.id}`)).status).toBe(204);
    expect(await prisma.comment.count()).toBe(0);
  });
});
