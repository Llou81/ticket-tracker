import request from "supertest";
import { afterAll, describe, expect, it } from "vitest";
import { createApp } from "../src/app";
import { prisma } from "../src/db";

const app = createApp();

afterAll(async () => {
  await prisma.$disconnect();
});

describe("health", () => {
  it("reports API and database as ok", async () => {
    const res = await request(app).get("/api/health");
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ status: "ok", database: "ok" });
  });

  it("requires authentication for non-public API routes", async () => {
    const res = await request(app).get("/api/does-not-exist");
    expect(res.status).toBe(401);
    expect(res.body.code).toBe("unauthenticated");
  });
});
