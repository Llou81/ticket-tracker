import { prisma } from "../db";
import { fieldError, HttpError } from "../errors";

const NOT_FOUND = "Epic not found.";

export interface EpicDto {
  id: string;
  teamId: string;
  teamName: string;
  title: string;
  description: string | null;
  createdAt: Date;
  modifiedAt: Date;
  /** Tickets referencing this epic; the UI disables Delete while > 0. */
  ticketCount: number;
}

const include = { team: { select: { name: true } }, _count: { select: { tickets: true } } } as const;

function toDto(epic: {
  id: string;
  teamId: string;
  title: string;
  description: string | null;
  createdAt: Date;
  modifiedAt: Date;
  team: { name: string };
  _count: { tickets: number };
}): EpicDto {
  const { team, _count, ...rest } = epic;
  return { ...rest, teamName: team.name, ticketCount: _count.tickets };
}

/** All epics (optionally of one team), ordered by title ignoring case. */
export async function listEpics(teamId?: string): Promise<EpicDto[]> {
  const epics = await prisma.epic.findMany({ where: teamId ? { teamId } : undefined, include });
  return epics
    .map(toDto)
    .sort((a, b) => a.title.localeCompare(b.title, undefined, { sensitivity: "base" }) || a.id.localeCompare(b.id));
}

export async function getEpic(id: string): Promise<EpicDto> {
  const epic = await prisma.epic.findUnique({ where: { id }, include });
  if (!epic) throw new HttpError(404, NOT_FOUND, "not_found");
  return toDto(epic);
}

/** Inputs must already be trimmed; an empty description must be passed as null. */
export async function createEpic(input: { teamId: string; title: string; description: string | null }) {
  const team = await prisma.team.findUnique({ where: { id: input.teamId } });
  if (!team) throw fieldError("teamId", "Team not found.");
  const epic = await prisma.epic.create({ data: input, include });
  return toDto(epic);
}

/**
 * Updates title/description. The team can't change: a different teamId is rejected.
 * Saving unchanged values does not advance modifiedAt.
 */
export async function updateEpic(
  id: string,
  changes: { teamId?: string; title?: string; description?: string | null },
): Promise<EpicDto> {
  const epic = await getEpic(id);
  if (changes.teamId !== undefined && changes.teamId !== epic.teamId) {
    throw new HttpError(400, "An epic's team cannot be changed.", "epic_team_immutable");
  }
  const data: { title?: string; description?: string | null } = {};
  if (changes.title !== undefined && changes.title !== epic.title) data.title = changes.title;
  if (changes.description !== undefined && changes.description !== epic.description) {
    data.description = changes.description;
  }
  if (Object.keys(data).length === 0) return epic;

  const updated = await prisma.epic.update({ where: { id }, data: { ...data, modifiedAt: new Date() }, include });
  return toDto(updated);
}

/** Refuses (409) while tickets reference the epic. A RESTRICT foreign key backs this up against races. */
export async function deleteEpic(id: string): Promise<void> {
  const epic = await getEpic(id);
  if (epic.ticketCount > 0) {
    const n = epic.ticketCount;
    throw new HttpError(
      409,
      `Epic "${epic.title}" cannot be deleted because ${n} ticket${n === 1 ? " references" : "s reference"} it. ` +
        `Remove the epic from ${n === 1 ? "that ticket" : "those tickets"} first.`,
      "epic_in_use",
    );
  }
  const { count } = await prisma.epic.deleteMany({ where: { id } });
  if (count === 0) throw new HttpError(404, NOT_FOUND, "not_found");
}
