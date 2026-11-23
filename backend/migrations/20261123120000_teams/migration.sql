-- CreateTable
CREATE TABLE "teams" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "modified_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "teams_pkey" PRIMARY KEY ("id")
);

-- Not expressible in schema.prisma (hand-written):
-- names are unique case-insensitively, stored trimmed and non-empty.
CREATE UNIQUE INDEX "teams_name_lower_key" ON "teams" (lower("name"));
ALTER TABLE "teams" ADD CONSTRAINT "teams_name_trimmed" CHECK ("name" = btrim("name") AND "name" <> '');
