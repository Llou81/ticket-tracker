import { prisma } from "../db";
import { HttpError } from "../errors";

const select = {
  id: true,
  ticketId: true,
  body: true,
  createdAt: true,
  author: { select: { id: true, email: true } },
} as const;

async function assertTicketExists(ticketId: string) {
  const ticket = await prisma.ticket.findUnique({ where: { id: ticketId }, select: { id: true } });
  if (!ticket) throw new HttpError(404, "Ticket not found.", "not_found");
}

/** A ticket's comments, oldest first. */
export async function listComments(ticketId: string) {
  await assertTicketExists(ticketId);
  return prisma.comment.findMany({
    where: { ticketId },
    orderBy: [{ createdAt: "asc" }, { id: "asc" }],
    select,
  });
}

/** Adds a comment. Deliberately does not touch the ticket's modifiedAt (board order must not change). */
export async function addComment(ticketId: string, authorId: string, body: string) {
  await assertTicketExists(ticketId);
  return prisma.comment.create({ data: { ticketId, authorId, body }, select });
}
