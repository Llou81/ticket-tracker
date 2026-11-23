import { Router } from "express";
import { z } from "zod";
import { currentUser } from "../middleware/auth";
import { addComment, listComments } from "../services/comments";
import { createTicket, deleteTicket, getTicket, listTickets, updateTicket } from "../services/tickets";
import { parseId, reference, requiredText } from "../util/validation";

export const ticketsRouter = Router();

export const TICKET_TYPES = ["bug", "feature", "fix"] as const;
export const TICKET_STATES = [
  "new",
  "ready_for_implementation",
  "in_progress",
  "ready_for_acceptance",
  "done",
] as const;

const enumOf = <T extends readonly [string, ...string[]]>(label: string, values: T) =>
  z.enum(values, { errorMap: () => ({ message: `${label} must be one of: ${values.join(", ")}.` }) });

const type = enumOf("Type", TICKET_TYPES);
const state = enumOf("State", TICKET_STATES);
const title = requiredText("Title", 1000);
// Body is stored as entered (Markdown indentation matters) but must contain non-whitespace.
const body = z
  .string({ required_error: "Body is required.", invalid_type_error: "Body must be text." })
  .max(200_000, "Body must be at most 200000 characters.")
  .refine((s) => s.trim() !== "", "Body must not be empty.");
const epicId = z
  .string({ invalid_type_error: "Epic not found." })
  .uuid("Epic not found.")
  .nullable();

const ticketId = (raw: string) => parseId(raw, "Ticket not found.");

ticketsRouter.get("/", async (req, res) => {
  const { teamId } = z.object({ teamId: reference("Team") }).parse(req.query);
  res.json(await listTickets(teamId));
});

ticketsRouter.post("/", async (req, res) => {
  const input = z
    .object({
      teamId: reference("Team"),
      epicId: epicId.optional().transform((v) => v ?? null),
      type,
      state: state.default("new"),
      title,
      body,
    })
    .parse(req.body);
  res.status(201).json(await createTicket(input, currentUser(res).id));
});

ticketsRouter.get("/:id", async (req, res) => {
  res.json(await getTicket(ticketId(req.params.id)));
});

ticketsRouter.patch("/:id", async (req, res) => {
  const id = ticketId(req.params.id);
  const changes = z
    .object({
      teamId: reference("Team").optional(),
      epicId: epicId.optional(), // absent = unchanged, null = clear
      type: type.optional(),
      state: state.optional(),
      title: title.optional(),
      body: body.optional(),
    })
    .parse(req.body);
  res.json(await updateTicket(id, changes));
});

ticketsRouter.delete("/:id", async (req, res) => {
  await deleteTicket(ticketId(req.params.id));
  res.status(204).end();
});

// Comments are immutable: list and add only.
const commentBody = z
  .string({ required_error: "Comment is required.", invalid_type_error: "Comment must be text." })
  .max(50_000, "Comment must be at most 50000 characters.")
  .refine((s) => s.trim() !== "", "Comment must not be empty.");

ticketsRouter.get("/:id/comments", async (req, res) => {
  res.json(await listComments(ticketId(req.params.id)));
});

ticketsRouter.post("/:id/comments", async (req, res) => {
  const id = ticketId(req.params.id);
  const { body } = z.object({ body: commentBody }).parse(req.body);
  res.status(201).json(await addComment(id, currentUser(res).id, body));
});
