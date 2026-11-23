import type { TicketState, TicketType } from "../tickets";
import { api, post } from "./client";

/** Board/list item (no body). */
export interface TicketSummary {
  id: string;
  teamId: string;
  epicId: string | null;
  epicTitle: string | null;
  type: TicketType;
  state: TicketState;
  title: string;
  createdAt: string;
  modifiedAt: string;
}

export interface Ticket extends TicketSummary {
  teamName: string;
  body: string;
  createdBy: { id: string; email: string };
}

export interface TicketInput {
  teamId: string;
  epicId: string | null;
  type: TicketType;
  state: TicketState;
  title: string;
  body: string;
}

export const TICKETS_KEY = ["tickets"] as const;
export const ticketListKey = (teamId: string) => [...TICKETS_KEY, "list", teamId] as const;
export const ticketKey = (id: string) => [...TICKETS_KEY, "detail", id] as const;

export const listTickets = (teamId: string) =>
  api<TicketSummary[]>(`/tickets?teamId=${encodeURIComponent(teamId)}`);

export const getTicket = (id: string) => api<Ticket>(`/tickets/${id}`);

export const createTicket = (input: TicketInput) => post<Ticket>("/tickets", input);

export const updateTicket = (id: string, changes: Partial<TicketInput>) =>
  api<Ticket>(`/tickets/${id}`, { method: "PATCH", body: JSON.stringify(changes) });

export const deleteTicket = (id: string) => api<null>(`/tickets/${id}`, { method: "DELETE" });
