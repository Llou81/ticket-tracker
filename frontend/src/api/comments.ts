import { api, post } from "./client";

export interface Comment {
  id: string;
  ticketId: string;
  body: string;
  createdAt: string;
  author: { id: string; email: string };
}

export const commentsKey = (ticketId: string) => ["tickets", "comments", ticketId] as const;

export const listComments = (ticketId: string) => api<Comment[]>(`/tickets/${ticketId}/comments`);

export const addComment = (ticketId: string, body: string) =>
  post<Comment>(`/tickets/${ticketId}/comments`, { body });
