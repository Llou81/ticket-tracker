-- CreateTable
CREATE TABLE "epics" (
    "id" UUID NOT NULL,
    "team_id" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "modified_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "epics_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "epics_team_id_idx" ON "epics"("team_id");

-- AddForeignKey: a team with epics cannot be deleted (no cascade).
ALTER TABLE "epics" ADD CONSTRAINT "epics_team_id_fkey" FOREIGN KEY ("team_id") REFERENCES "teams"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Not expressible in schema.prisma (hand-written):
ALTER TABLE "epics" ADD CONSTRAINT "epics_title_trimmed" CHECK ("title" = btrim("title") AND "title" <> '');
ALTER TABLE "epics" ADD CONSTRAINT "epics_description_trimmed"
    CHECK ("description" IS NULL OR ("description" = btrim("description") AND "description" <> ''));
