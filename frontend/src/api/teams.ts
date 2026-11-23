import { api, post } from "./client";

export interface Team {
  id: string;
  name: string;
  createdAt: string;
  modifiedAt: string;
}

export interface TeamListItem extends Team {
  epicCount: number;
}

export const TEAMS_KEY = ["teams"] as const;

export const listTeams = () => api<TeamListItem[]>("/teams");

export const createTeam = (name: string) => post<Team>("/teams", { name });

export const renameTeam = (id: string, name: string) =>
  api<Team>(`/teams/${id}`, { method: "PATCH", body: JSON.stringify({ name }) });

export const deleteTeam = (id: string) => api<null>(`/teams/${id}`, { method: "DELETE" });
