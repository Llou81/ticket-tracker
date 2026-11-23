import { Prisma, type Team } from "@prisma/client";
import { prisma } from "../db";
import { HttpError } from "../errors";

const NOT_FOUND = "Team not found.";

function isUniqueViolation(err: unknown) {
  return err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002";
}

function nameTaken(name: string) {
  return new HttpError(409, `A team named "${name}" already exists.`, "team_name_taken");
}

export type TeamWithCounts = Team & { epicCount: number; ticketCount: number };

/** Teams in case-insensitive alphabetical order, with usage counts so the UI can disable Delete. */
export async function listTeams(): Promise<TeamWithCounts[]> {
  return prisma.$queryRaw<TeamWithCounts[]>`
    SELECT t.id, t.name, t.created_at AS "createdAt", t.modified_at AS "modifiedAt",
           (SELECT count(*)::int FROM epics e WHERE e.team_id = t.id) AS "epicCount",
           (SELECT count(*)::int FROM tickets k WHERE k.team_id = t.id) AS "ticketCount"
    FROM teams t ORDER BY lower(t.name), t.name`;
}

export async function getTeam(id: string): Promise<Team> {
  const team = await prisma.team.findUnique({ where: { id } });
  if (!team) throw new HttpError(404, NOT_FOUND, "not_found");
  return team;
}

/** `name` must already be trimmed and non-empty. */
export async function createTeam(name: string): Promise<Team> {
  try {
    return await prisma.team.create({ data: { name } });
  } catch (err) {
    if (isUniqueViolation(err)) throw nameTaken(name);
    throw err;
  }
}

/** Renames a team. Saving an unchanged name does not advance modifiedAt. */
export async function renameTeam(id: string, name: string): Promise<Team> {
  const team = await getTeam(id);
  if (team.name === name) return team;
  try {
    return await prisma.team.update({ where: { id }, data: { name, modifiedAt: new Date() } });
  } catch (err) {
    if (isUniqueViolation(err)) throw nameTaken(name);
    throw err;
  }
}

/** Refuses (409) while the team has epics or tickets. RESTRICT foreign keys back this up against races. */
export async function deleteTeam(id: string): Promise<void> {
  const team = await getTeam(id);
  const [epics, tickets] = await Promise.all([
    prisma.epic.count({ where: { teamId: id } }),
    prisma.ticket.count({ where: { teamId: id } }),
  ]);
  if (epics > 0 || tickets > 0) {
    const parts = [epics > 0 && plural(epics, "epic"), tickets > 0 && plural(tickets, "ticket")].filter(Boolean);
    throw new HttpError(
      409,
      `Team "${team.name}" cannot be deleted because it has ${parts.join(" and ")}. Delete or move them first.`,
      "team_in_use",
    );
  }
  const { count } = await prisma.team.deleteMany({ where: { id } });
  if (count === 0) throw new HttpError(404, NOT_FOUND, "not_found");
}

function plural(n: number, word: string) {
  return `${n} ${word}${n === 1 ? "" : "s"}`;
}
