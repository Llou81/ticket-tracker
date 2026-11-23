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

export async function listTeams(): Promise<Team[]> {
  // Case-insensitive alphabetical order.
  return prisma.$queryRaw<Team[]>`
    SELECT id, name, created_at AS "createdAt", modified_at AS "modifiedAt"
    FROM teams ORDER BY lower(name), name`;
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

export async function deleteTeam(id: string): Promise<void> {
  // Teams with epics or tickets are protected by RESTRICT foreign keys (added with those tables);
  // the error handler maps that violation to 409.
  const { count } = await prisma.team.deleteMany({ where: { id } });
  if (count === 0) throw new HttpError(404, NOT_FOUND, "not_found");
}
