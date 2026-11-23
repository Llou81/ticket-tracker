import request from "supertest";
import type TestAgent from "supertest/lib/agent";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { createApp } from "../src/app";
import { prisma } from "../src/db";
import { loggedInAgent, resetDb } from "./helpers";

const app = createApp();
let agent: TestAgent;
let teamA: { id: string; name: string };
let teamB: { id: string; name: string };

beforeEach(async () => {
  await resetDb();
  agent = await loggedInAgent(app);
  teamA = (await agent.post("/api/teams").send({ name: "Alpha" })).body;
  teamB = (await agent.post("/api/teams").send({ name: "Beta" })).body;
});

afterAll(async () => {
  await prisma.$disconnect();
});

const createEpic = (body: object) => agent.post("/api/epics").send(body);
const sleep = () => new Promise((r) => setTimeout(r, 10));

describe("creating epics", () => {
  it("requires authentication", async () => {
    expect((await request(app).get("/api/epics")).status).toBe(401);
  });

  it("creates an epic with trimmed fields; empty description becomes null", async () => {
    const res = await createEpic({ teamId: teamA.id, title: "  Checkout  ", description: "   " });
    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({ teamId: teamA.id, teamName: "Alpha", title: "Checkout", description: null });
    expect(res.body.createdAt).toBe(res.body.modifiedAt);
  });

  it("rejects a blank title and a missing, malformed or unknown team", async () => {
    const blank = await createEpic({ teamId: teamA.id, title: "  " });
    expect(blank.status).toBe(400);
    expect(blank.body.fields.title).toBeDefined();

    for (const teamId of [undefined, "nope", "00000000-0000-0000-0000-000000000000"]) {
      const res = await createEpic({ teamId, title: "X" });
      expect(res.status).toBe(400);
      expect(res.body.fields.teamId).toBeDefined();
    }
    expect(await prisma.epic.count()).toBe(0);
  });
});

describe("listing epics", () => {
  it("lists all epics or one team's, sorted by title ignoring case", async () => {
    await createEpic({ teamId: teamA.id, title: "zeta" });
    await createEpic({ teamId: teamB.id, title: "Beta epic" });
    await createEpic({ teamId: teamA.id, title: "Alpha epic" });

    const all = await agent.get("/api/epics");
    expect(all.body.map((e: { title: string }) => e.title)).toEqual(["Alpha epic", "Beta epic", "zeta"]);

    const onlyA = await agent.get(`/api/epics?teamId=${teamA.id}`);
    expect(onlyA.body.map((e: { title: string }) => e.title)).toEqual(["Alpha epic", "zeta"]);
  });
});

describe("editing epics", () => {
  it("updates title and description and advances modifiedAt", async () => {
    const epic = (await createEpic({ teamId: teamA.id, title: "Old", description: "d" })).body;
    await sleep();
    const res = await agent.patch(`/api/epics/${epic.id}`).send({ title: "New", description: "More detail" });
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ title: "New", description: "More detail", createdAt: epic.createdAt });
    expect(new Date(res.body.modifiedAt) > new Date(epic.modifiedAt)).toBe(true);
  });

  it("does not advance modifiedAt when nothing changes", async () => {
    const epic = (await createEpic({ teamId: teamA.id, title: "Same", description: "Text" })).body;
    await sleep();
    const res = await agent
      .patch(`/api/epics/${epic.id}`)
      .send({ teamId: teamA.id, title: " Same ", description: "Text " });
    expect(res.status).toBe(200);
    expect(res.body.modifiedAt).toBe(epic.modifiedAt);
  });

  it("keeps the description when it is omitted and clears it with null", async () => {
    const epic = (await createEpic({ teamId: teamA.id, title: "T", description: "Keep me" })).body;
    expect((await agent.patch(`/api/epics/${epic.id}`).send({ title: "T2" })).body.description).toBe("Keep me");
    expect((await agent.patch(`/api/epics/${epic.id}`).send({ description: null })).body.description).toBeNull();
  });

  it("refuses to move an epic to another team", async () => {
    const epic = (await createEpic({ teamId: teamA.id, title: "Pinned" })).body;
    const res = await agent.patch(`/api/epics/${epic.id}`).send({ teamId: teamB.id });
    expect(res.status).toBe(400);
    expect(res.body.code).toBe("epic_team_immutable");
    expect((await prisma.epic.findUniqueOrThrow({ where: { id: epic.id } })).teamId).toBe(teamA.id);
  });

  it("returns 404 for unknown epics", async () => {
    const res = await agent.patch("/api/epics/00000000-0000-0000-0000-000000000000").send({ title: "X" });
    expect(res.status).toBe(404);
  });
});

describe("deleting", () => {
  it("deletes an epic; a second delete is 404", async () => {
    const epic = (await createEpic({ teamId: teamA.id, title: "Temp" })).body;
    expect((await agent.delete(`/api/epics/${epic.id}`)).status).toBe(204);
    expect((await agent.delete(`/api/epics/${epic.id}`)).status).toBe(404);
  });

  it("refuses with 409 to delete a team that has epics, and reports the count in the list", async () => {
    await createEpic({ teamId: teamA.id, title: "Blocks deletion" });

    const teams = await agent.get("/api/teams");
    expect(teams.body.find((t: { id: string }) => t.id === teamA.id).epicCount).toBe(1);
    expect(teams.body.find((t: { id: string }) => t.id === teamB.id).epicCount).toBe(0);

    const res = await agent.delete(`/api/teams/${teamA.id}`);
    expect(res.status).toBe(409);
    expect(res.body.code).toBe("team_in_use");
    expect(res.body.error).toContain("1 epic");
    expect(await prisma.team.count()).toBe(2);
  });
});
