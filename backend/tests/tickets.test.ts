import request from "supertest";
import type TestAgent from "supertest/lib/agent";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { createApp } from "../src/app";
import { prisma } from "../src/db";
import { loggedInAgent, resetDb } from "./helpers";

const app = createApp();
let agent: TestAgent;
let teamA: { id: string };
let teamB: { id: string };
let epicA: { id: string; title: string };
let epicB: { id: string };

const ISO_UTC = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;
const sleep = () => new Promise((r) => setTimeout(r, 10));

beforeEach(async () => {
  await resetDb();
  agent = await loggedInAgent(app, "author@example.com");
  teamA = (await agent.post("/api/teams").send({ name: "Alpha" })).body;
  teamB = (await agent.post("/api/teams").send({ name: "Beta" })).body;
  epicA = (await agent.post("/api/epics").send({ teamId: teamA.id, title: "Epic A" })).body;
  epicB = (await agent.post("/api/epics").send({ teamId: teamB.id, title: "Epic B" })).body;
});

afterAll(async () => {
  await prisma.$disconnect();
});

const createTicket = (overrides: object = {}) =>
  agent.post("/api/tickets").send({ teamId: teamA.id, type: "bug", title: "Broken", body: "Steps...", ...overrides });
const patch = (id: string, body: object) => agent.patch(`/api/tickets/${id}`).send(body);

describe("creating tickets", () => {
  it("requires authentication", async () => {
    expect((await request(app).post("/api/tickets").send({})).status).toBe(401);
  });

  it("creates a ticket: state defaults to new, creator and UTC timestamps set by the server", async () => {
    const res = await createTicket({ title: "  Login fails  ", body: "  indented\n\ncode  " });
    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({
      teamId: teamA.id,
      teamName: "Alpha",
      type: "bug",
      state: "new",
      epicId: null,
      epicTitle: null,
      title: "Login fails",
      body: "  indented\n\ncode  ", // body kept as entered
      createdBy: { email: "author@example.com" },
    });
    expect(res.body.createdAt).toMatch(ISO_UTC);
    expect(res.body.modifiedAt).toBe(res.body.createdAt);
  });

  it("accepts an explicit state and a same-team epic", async () => {
    const res = await createTicket({ state: "in_progress", type: "feature", epicId: epicA.id });
    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({ state: "in_progress", type: "feature", epicId: epicA.id, epicTitle: "Epic A" });
  });

  it("validates enums, required text, and references", async () => {
    const cases: [object, string][] = [
      [{ type: "story" }, "type"],
      [{ state: "blocked" }, "state"],
      [{ title: "   " }, "title"],
      [{ body: " \n\t " }, "body"],
      [{ body: undefined }, "body"],
      [{ teamId: "00000000-0000-0000-0000-000000000000" }, "teamId"],
      [{ epicId: "00000000-0000-0000-0000-000000000000" }, "epicId"],
      [{ epicId: "not-a-uuid" }, "epicId"],
    ];
    for (const [overrides, field] of cases) {
      const res = await createTicket(overrides);
      expect(res.status, JSON.stringify(overrides)).toBe(400);
      expect(res.body.fields?.[field], JSON.stringify(overrides)).toBeDefined();
    }
    expect(await prisma.ticket.count()).toBe(0);
  });

  it("rejects an epic from another team", async () => {
    const res = await createTicket({ epicId: epicB.id });
    expect(res.status).toBe(400);
    expect(res.body.fields.epicId).toMatch(/different team/);
  });
});

describe("reading tickets", () => {
  it("returns all fields including creator, team and epic", async () => {
    const created = (await createTicket({ epicId: epicA.id })).body;
    const res = await agent.get(`/api/tickets/${created.id}`);
    expect(res.status).toBe(200);
    expect(res.body).toEqual(created);
  });

  it("lists a team's tickets most recently modified first, without other teams' tickets", async () => {
    const first = (await createTicket({ title: "First" })).body;
    await sleep();
    await createTicket({ title: "Second" });
    await createTicket({ teamId: teamB.id, title: "Other team" });
    await sleep();
    await patch(first.id, { state: "done" }); // moves First to the top

    const res = await agent.get(`/api/tickets?teamId=${teamA.id}`);
    expect(res.status).toBe(200);
    expect(res.body.map((t: { title: string }) => t.title)).toEqual(["First", "Second"]);
    expect(res.body[0]).not.toHaveProperty("body");
  });

  it("requires a valid teamId to list", async () => {
    expect((await agent.get("/api/tickets")).status).toBe(400);
    expect((await agent.get("/api/tickets?teamId=00000000-0000-0000-0000-000000000000")).status).toBe(404);
  });

  it("returns 404 for unknown tickets", async () => {
    expect((await agent.get("/api/tickets/00000000-0000-0000-0000-000000000000")).status).toBe(404);
  });
});

describe("editing tickets", () => {
  it("advances modifiedAt on a real change", async () => {
    const t = (await createTicket()).body;
    await sleep();
    const res = await patch(t.id, { state: "in_progress" });
    expect(res.status).toBe(200);
    expect(res.body.state).toBe("in_progress");
    expect(res.body.createdAt).toBe(t.createdAt);
    expect(new Date(res.body.modifiedAt) > new Date(t.modifiedAt)).toBe(true);
  });

  it("does not advance modifiedAt when saving unchanged values", async () => {
    const t = (await createTicket({ epicId: epicA.id })).body;
    await sleep();
    const res = await patch(t.id, {
      teamId: t.teamId,
      epicId: t.epicId,
      type: t.type,
      state: t.state,
      title: `  ${t.title} `,
      body: t.body,
    });
    expect(res.status).toBe(200);
    expect(res.body.modifiedAt).toBe(t.modifiedAt);
  });

  it("rejects changing the team while keeping the old team's epic", async () => {
    const t = (await createTicket({ epicId: epicA.id })).body;
    const res = await patch(t.id, { teamId: teamB.id });
    expect(res.status).toBe(400);
    expect(res.body.fields.epicId).toMatch(/different team/);
    expect((await agent.get(`/api/tickets/${t.id}`)).body.teamId).toBe(teamA.id);
  });

  it("allows changing the team when the epic is cleared or replaced", async () => {
    const t = (await createTicket({ epicId: epicA.id })).body;
    const cleared = await patch(t.id, { teamId: teamB.id, epicId: null });
    expect(cleared.status).toBe(200);
    expect(cleared.body).toMatchObject({ teamId: teamB.id, epicId: null });

    const replaced = await patch(t.id, { teamId: teamA.id, epicId: epicA.id });
    expect(replaced.body).toMatchObject({ teamId: teamA.id, epicId: epicA.id });
  });

  it("validates enum values on update", async () => {
    const t = (await createTicket()).body;
    const res = await patch(t.id, { state: "Done" });
    expect(res.status).toBe(400);
    expect(res.body.fields.state).toContain("ready_for_implementation");
  });
});

describe("deleting", () => {
  it("deletes a ticket; a second delete is 404", async () => {
    const t = (await createTicket()).body;
    expect((await agent.delete(`/api/tickets/${t.id}`)).status).toBe(204);
    expect((await agent.delete(`/api/tickets/${t.id}`)).status).toBe(404);
  });

  it("refuses with 409 to delete an epic referenced by tickets, and reports the count", async () => {
    await createTicket({ epicId: epicA.id });
    const epics = await agent.get(`/api/epics?teamId=${teamA.id}`);
    expect(epics.body[0].ticketCount).toBe(1);

    const res = await agent.delete(`/api/epics/${epicA.id}`);
    expect(res.status).toBe(409);
    expect(res.body.code).toBe("epic_in_use");
  });

  it("refuses with 409 to delete a team with tickets, and reports the count", async () => {
    await agent.delete(`/api/epics/${epicB.id}`);
    await createTicket({ teamId: teamB.id });
    const teams = await agent.get("/api/teams");
    expect(teams.body.find((t: { id: string }) => t.id === teamB.id).ticketCount).toBe(1);

    const res = await agent.delete(`/api/teams/${teamB.id}`);
    expect(res.status).toBe(409);
    expect(res.body.error).toContain("1 ticket");
  });
});

describe("database integrity", () => {
  it("rejects a cross-team epic even when the service layer is bypassed", async () => {
    const user = await prisma.user.findFirstOrThrow();
    await expect(
      prisma.ticket.create({
        data: { teamId: teamA.id, epicId: epicB.id, type: "bug", title: "X", body: "Y", createdById: user.id },
      }),
    ).rejects.toThrow(/does not belong to team/);
  });
});
