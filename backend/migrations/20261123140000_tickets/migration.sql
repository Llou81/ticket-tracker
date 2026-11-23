-- CreateEnum
CREATE TYPE "ticket_type" AS ENUM ('bug', 'feature', 'fix');

-- CreateEnum
CREATE TYPE "ticket_state" AS ENUM ('new', 'ready_for_implementation', 'in_progress', 'ready_for_acceptance', 'done');

-- CreateTable
CREATE TABLE "tickets" (
    "id" UUID NOT NULL,
    "team_id" UUID NOT NULL,
    "epic_id" UUID,
    "type" "ticket_type" NOT NULL,
    "state" "ticket_state" NOT NULL DEFAULT 'new',
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "created_by" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "modified_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "tickets_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "tickets_team_id_modified_at_idx" ON "tickets"("team_id", "modified_at" DESC);

-- CreateIndex
CREATE INDEX "tickets_epic_id_idx" ON "tickets"("epic_id");

-- AddForeignKey: teams and epics with tickets cannot be deleted (no cascade).
ALTER TABLE "tickets" ADD CONSTRAINT "tickets_team_id_fkey" FOREIGN KEY ("team_id") REFERENCES "teams"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tickets" ADD CONSTRAINT "tickets_epic_id_fkey" FOREIGN KEY ("epic_id") REFERENCES "epics"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tickets" ADD CONSTRAINT "tickets_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Not expressible in schema.prisma (hand-written):
ALTER TABLE "tickets" ADD CONSTRAINT "tickets_title_trimmed" CHECK ("title" = btrim("title") AND "title" <> '');
ALTER TABLE "tickets" ADD CONSTRAINT "tickets_body_not_blank" CHECK (btrim("body", E' \t\r\n') <> '');

-- A ticket's epic must belong to the ticket's team. Epics never change team, so checking
-- tickets on write is sufficient.
CREATE FUNCTION "tickets_epic_same_team"() RETURNS trigger AS $$
BEGIN
    IF NEW."epic_id" IS NOT NULL AND NOT EXISTS (
        SELECT 1 FROM "epics" WHERE "id" = NEW."epic_id" AND "team_id" = NEW."team_id"
    ) THEN
        RAISE EXCEPTION 'epic % does not belong to team %', NEW."epic_id", NEW."team_id"
            USING ERRCODE = 'check_violation';
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "tickets_epic_same_team"
    BEFORE INSERT OR UPDATE OF "team_id", "epic_id" ON "tickets"
    FOR EACH ROW EXECUTE FUNCTION "tickets_epic_same_team"();
