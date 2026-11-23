import { api, post } from "./client";

export interface Epic {
  id: string;
  teamId: string;
  teamName: string;
  title: string;
  description: string | null;
  createdAt: string;
  modifiedAt: string;
}

export const EPICS_KEY = ["epics"] as const;

export const listEpics = (teamId?: string) =>
  api<Epic[]>(teamId ? `/epics?teamId=${encodeURIComponent(teamId)}` : "/epics");

export const createEpic = (input: { teamId: string; title: string; description: string }) =>
  post<Epic>("/epics", input);

export const updateEpic = (id: string, changes: { title: string; description: string }) =>
  api<Epic>(`/epics/${id}`, { method: "PATCH", body: JSON.stringify(changes) });

export const deleteEpic = (id: string) => api<null>(`/epics/${id}`, { method: "DELETE" });
