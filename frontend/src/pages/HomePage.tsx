import { useQuery } from "@tanstack/react-query";
import { Link, useLocation } from "react-router-dom";
import { listTeams, TEAMS_KEY } from "../api/teams";
import { listTickets, ticketListKey } from "../api/tickets";
import { formatDateTime } from "../format";
import { STATE_LABELS, TYPE_LABELS } from "../tickets";
import { useSelectedTeam } from "../useSelectedTeam";

// Interim ticket list for slice 5; becomes the Kanban board in slice 6.
export function HomePage() {
  const notice = (useLocation().state as { notice?: string } | null)?.notice;
  const teams = useQuery({ queryKey: TEAMS_KEY, queryFn: listTeams });
  const [team, selectTeam] = useSelectedTeam(teams.data);
  const tickets = useQuery({
    queryKey: ticketListKey(team?.id ?? ""),
    queryFn: () => listTickets(team!.id),
    enabled: !!team,
  });

  if (teams.isPending) return <p className="muted">Loading…</p>;
  if (teams.isError) return <p className="notice error">Could not load teams: {teams.error.message}</p>;
  if (!team) {
    return (
      <div className="page">
        <h1>Board</h1>
        <div className="empty">
          No teams yet. <Link to="/teams">Create a team</Link> to start adding tickets.
        </div>
      </div>
    );
  }

  return (
    <div className="page">
      <div className="page-header">
        <h1>Board</h1>
        <Link className="button" to={`/tickets/new?team=${team.id}`}>
          New ticket
        </Link>
      </div>

      <div className="toolbar">
        <label className="field inline">
          <span>Team</span>
          <select value={team.id} onChange={(e) => selectTeam(e.target.value)}>
            {teams.data.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
        </label>
      </div>

      {notice && <p className="notice success">{notice}</p>}

      {tickets.isPending ? (
        <p className="muted">Loading tickets…</p>
      ) : tickets.isError ? (
        <p className="notice error">Could not load tickets: {tickets.error.message}</p>
      ) : tickets.data.length === 0 ? (
        <div className="empty">No tickets for {team.name} yet.</div>
      ) : (
        <table className="table">
          <thead>
            <tr>
              <th>Title</th>
              <th>Type</th>
              <th>State</th>
              <th>Epic</th>
              <th>Modified</th>
            </tr>
          </thead>
          <tbody>
            {tickets.data.map((t) => (
              <tr key={t.id}>
                <td>
                  <Link to={`/tickets/${t.id}`}>{t.title}</Link>
                </td>
                <td>
                  <span className={`badge type-${t.type}`}>{TYPE_LABELS[t.type]}</span>
                </td>
                <td>{STATE_LABELS[t.state]}</td>
                <td className="muted">{t.epicTitle ?? "—"}</td>
                <td className="muted nowrap">{formatDateTime(t.modifiedAt)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
