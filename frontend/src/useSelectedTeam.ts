import { useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import type { TeamListItem } from "./api/teams";

const STORAGE_KEY = "ticket-tracker:last-team";

function readStored(): string | null {
  try {
    return localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}

function store(id: string) {
  try {
    localStorage.setItem(STORAGE_KEY, id);
  } catch {
    // Storage unavailable (private mode etc.); the URL still carries the selection.
  }
}

/**
 * The board's selected team: ?team= in the URL, else the last team this browser used, else the first team.
 * (localStorage is only a per-viewer convenience; all data lives in the API.)
 */
export function useSelectedTeam(teams: TeamListItem[] | undefined) {
  const [params, setParams] = useSearchParams();
  const requested = params.get("team");

  let selected: TeamListItem | undefined;
  if (teams && teams.length > 0) {
    selected =
      teams.find((t) => t.id === requested) ?? teams.find((t) => t.id === readStored()) ?? teams[0];
  }

  useEffect(() => {
    if (selected) store(selected.id);
  }, [selected]);

  const select = (teamId: string) => setParams({ team: teamId }, { replace: true });
  return [selected, select] as const;
}
