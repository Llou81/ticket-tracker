import request from "supertest";
import type TestAgent from "supertest/lib/agent";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { createApp } from "../src/app";
import { prisma } from "../src/db";
import { loggedInAgent, resetDb } from "./helpers";

const app = createApp();
let agent: TestAgent;

const ISO_UTC = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;

beforeEach(async () => {
  await resetDb();
  agent = await loggedInAgent(app);
});

afterAll(async () => {
  await prisma.$disconnect();
});

const createTeam = (name: unknown) => agent.post("/api/teams").send({ name });

describe("teams", () => {
  it("require authentication", async () => {
    expect((await request(app).get("/api/teams")).status).toBe(401);
    expect((await request(app).post("/api/teams").send({ name: "X" })).status).toBe(401);
  });

  it("create a team with a trimmed name and UTC ISO timestamps", async () => {
    const res = await createTeam("  Platform  ");
    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({ id: expect.any(String), name: "Platform" });
    expect(res.body.createdAt).toMatch(ISO_UTC);
    expect(res.body.modifiedAt).toMatch(ISO_UTC);
  });

  it("reject empty, whitespace-only and non-string names", async () => {
    for (const name of ["", "   ", undefined, 42]) {
      const res = await createTeam(name);
      expect(res.status).toBe(400);
      expect(res.body.fields.name).toBeDefined();
    }
    expect(await prisma.team.count()).toBe(0);
  });

  it("enforce case-insensitive unique names on create", async () => {
    await createTeam("Platform");
    const res = await createTeam(" PLATFORM ");
    expect(res.status).toBe(409);
    expect(res.body.code).toBe("team_name_taken");
  });

  it("list teams alphabetically, ignoring case", async () => {
    for (const name of ["beta", "Alpha", "Gamma"]) await createTeam(name);
    const res = await agent.get("/api/teams");
    expect(res.status).toBe(200);
    expect(res.body.map((t: { name: string }) => t.name)).toEqual(["Alpha", "beta", "Gamma"]);
  });

  it("return an empty list when there are no teams", async () => {
    const res = await agent.get("/api/teams");
    expect(res.body).toEqual([]);
  });
});

describe("renaming a team", () => {
  it("updates the name and advances modifiedAt", async () => {
    const team = (await createTeam("Old")).body;
    await new Promise((r) => setTimeout(r, 10));
    const res = await agent.patch(`/api/teams/${team.id}`).send({ name: "New" });
    expect(res.status).toBe(200);
    expect(res.body.name).toBe("New");
    expect(res.body.createdAt).toBe(team.createdAt);
    expect(new Date(res.body.modifiedAt).getTime()).toBeGreaterThan(new Date(team.modifiedAt).getTime());
  });

  it("does not advance modifiedAt when the name is unchanged", async () => {
    const team = (await createTeam("Same")).body;
    await new Promise((r) => setTimeout(r, 10));
    const res = await agent.patch(`/api/teams/${team.id}`).send({ name: "  Same " });
    expect(res.status).toBe(200);
    expect(res.body.modifiedAt).toBe(team.modifiedAt);
  });

  it("allows changing only the case of its own name", async () => {
    const team = (await createTeam("platform")).body;
    const res = await agent.patch(`/api/teams/${team.id}`).send({ name: "Platform" });
    expect(res.status).toBe(200);
    expect(res.body.name).toBe("Platform");
  });

  it("rejects a name used by another team, ignoring case", async () => {
    await createTeam("Taken");
    const team = (await createTeam("Mine")).body;
    const res = await agent.patch(`/api/teams/${team.id}`).send({ name: "taken" });
    expect(res.status).toBe(409);
    expect(res.body.code).toBe("team_name_taken");
  });

  it("returns 404 for unknown or malformed ids", async () => {
    const missing = await agent.patch("/api/teams/00000000-0000-0000-0000-000000000000").send({ name: "X" });
    expect(missing.status).toBe(404);
    expect((await agent.get("/api/teams/not-a-uuid")).status).toBe(404);
  });
});

describe("deleting a team", () => {
  it("removes it; a second delete is 404", async () => {
    const team = (await createTeam("Temp")).body;
    expect((await agent.delete(`/api/teams/${team.id}`)).status).toBe(204);
    expect((await agent.get(`/api/teams/${team.id}`)).status).toBe(404);
    expect((await agent.delete(`/api/teams/${team.id}`)).status).toBe(404);
  });
});
