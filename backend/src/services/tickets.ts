import type { Prisma, TicketState, TicketType } from "@prisma/client";
import { prisma } from "../db";
import { fieldError, HttpError } from "../errors";

const NOT_FOUND = "Ticket not found.";

export interface TicketInput {
  teamId: string;
  epicId: string | null;
  type: TicketType;
  state: TicketState;
  title: string;
  body: string;
}

const detailInclude = {
  team: { select: { id: true, name: true } },
  epic: { select: { id: true, title: true } },
  createdBy: { select: { id: true, email: true } },
} satisfies Prisma.TicketInclude;

type TicketWithRelations = Prisma.TicketGetPayload<{ include: typeof detailInclude }>;

/** Full ticket for the details view. */
function toDetail(t: TicketWithRelations) {
  return {
    id: t.id,
    teamId: t.teamId,
    teamName: t.team.name,
    epicId: t.epicId,
    epicTitle: t.epic?.title ?? null,
    type: t.type,
    state: t.state,
    title: t.title,
    body: t.body,
    createdBy: t.createdBy,
    createdAt: t.createdAt,
    modifiedAt: t.modifiedAt,
  };
}

/** A team's tickets for the board, most recently modified first. Bodies are omitted to keep it light. */
export async function listTickets(teamId: string) {
  const team = await prisma.team.findUnique({ where: { id: teamId } });
  if (!team) throw new HttpError(404, "Team not found.", "not_found");
  const tickets = await prisma.ticket.findMany({
    where: { teamId },
    orderBy: [{ modifiedAt: "desc" }, { createdAt: "desc" }, { id: "asc" }],
    select: {
      id: true,
      teamId: true,
      epicId: true,
      type: true,
      state: true,
      title: true,
      createdAt: true,
      modifiedAt: true,
      epic: { select: { title: true } },
    },
  });
  return tickets.map(({ epic, ...t }) => ({ ...t, epicTitle: epic?.title ?? null }));
}

export async function getTicket(id: string) {
  const ticket = await prisma.ticket.findUnique({ where: { id }, include: detailInclude });
  if (!ticket) throw new HttpError(404, NOT_FOUND, "not_found");
  return toDetail(ticket);
}

export async function createTicket(input: TicketInput, createdById: string) {
  await assertTeamExists(input.teamId);
  await assertEpicFitsTeam(input.epicId, input.teamId);
  const ticket = await prisma.ticket.create({ data: { ...input, createdById }, include: detailInclude });
  return toDetail(ticket);
}

/**
 * Applies the given changes. modifiedAt advances only if a value actually differs.
 * The resulting team/epic combination must be consistent: changing the team while keeping an epic
 * of the old team is rejected (the client must clear or replace the epic).
 */
export async function updateTicket(id: string, changes: Partial<TicketInput>) {
  const current = await prisma.ticket.findUnique({ where: { id } });
  if (!current) throw new HttpError(404, NOT_FOUND, "not_found");

  const data: Partial<TicketInput> = {};
  for (const key of Object.keys(changes) as (keyof TicketInput)[]) {
    const value = changes[key];
    if (value !== undefined && value !== current[key]) {
      (data as Record<string, unknown>)[key] = value;
    }
  }
  if (Object.keys(data).length === 0) return getTicket(id);

  const teamId = data.teamId ?? current.teamId;
  const epicId = data.epicId !== undefined ? data.epicId : current.epicId;
  if (data.teamId !== undefined) await assertTeamExists(teamId);
  if (data.teamId !== undefined || data.epicId !== undefined) await assertEpicFitsTeam(epicId, teamId);

  const ticket = await prisma.ticket.update({
    where: { id },
    data: { ...data, modifiedAt: new Date() },
    include: detailInclude,
  });
  return toDetail(ticket);
}

export async function deleteTicket(id: string): Promise<void> {
  const { count } = await prisma.ticket.deleteMany({ where: { id } });
  if (count === 0) throw new HttpError(404, NOT_FOUND, "not_found");
}

async function assertTeamExists(teamId: string) {
  const team = await prisma.team.findUnique({ where: { id: teamId }, select: { id: true } });
  if (!team) throw fieldError("teamId", "Team not found.");
}

async function assertEpicFitsTeam(epicId: string | null, teamId: string) {
  if (epicId === null) return;
  const epic = await prisma.epic.findUnique({ where: { id: epicId }, select: { teamId: true } });
  if (!epic) throw fieldError("epicId", "Epic not found.");
  if (epic.teamId !== teamId) {
    throw fieldError("epicId", "This epic belongs to a different team. Choose an epic of the ticket's team, or none.");
  }
}
