import { useCallback, useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate } from "react-router-dom";
import { EPICS_KEY, listEpics } from "../api/epics";
import { listTeams, TEAMS_KEY } from "../api/teams";
import { listTickets, ticketKey, ticketListKey, updateTicket, type TicketSummary } from "../api/tickets";
import { KanbanBoard } from "../components/KanbanBoard";
import { STATE_LABELS, TICKET_STATES, TICKET_TYPES, TYPE_LABELS, type TicketState, type TicketType } from "../tickets";
import { useFlashNotice } from "../useFlashNotice";
import { useSelectedTeam } from "../useSelectedTeam";

const ALL = "";
const NO_EPIC = "__none__";

/** Most recently modified first (ties: newest created, then id for stability). */
function byRecency(a: TicketSummary, b: TicketSummary) {
  return (
    b.modifiedAt.localeCompare(a.modifiedAt) || b.createdAt.localeCompare(a.createdAt) || a.id.localeCompare(b.id)
  );
}

const emptyColumns = () =>
  Object.fromEntries(TICKET_STATES.map((s) => [s, [] as TicketSummary[]])) as Record<TicketState, TicketSummary[]>;

export function BoardPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const teams = useQuery({ queryKey: TEAMS_KEY, queryFn: listTeams });
  const [team, selectTeam] = useSelectedTeam(teams.data);
  const teamId = team?.id ?? "";
  const listKey = ticketListKey(teamId);

  const tickets = useQuery({ queryKey: listKey, queryFn: () => listTickets(teamId), enabled: !!teamId });
  const epics = useQuery({ queryKey: [...EPICS_KEY, teamId], queryFn: () => listEpics(teamId), enabled: !!teamId });

  const [typeFilter, setTypeFilter] = useState<TicketType | typeof ALL>(ALL);
  const [epicFilter, setEpicFilter] = useState<string>(ALL);
  const [search, setSearch] = useState("");
  const [notice, setNotice] = useFlashNotice();
  const [moveError, setMoveError] = useState<string | null>(null);
  const [savingIds, setSavingIds] = useState<ReadonlySet<string>>(new Set());

  // Epics are per team, so an epic filter can't carry over to another team.
  useEffect(() => setEpicFilter(ALL), [teamId]);

  const setSaving = (id: string, saving: boolean) =>
    setSavingIds((prev) => {
      const next = new Set(prev);
      if (saving) next.add(id);
      else next.delete(id);
      return next;
    });

  const move = useMutation({
    mutationFn: ({ ticket, to }: { ticket: TicketSummary; to: TicketState }) => updateTicket(ticket.id, { state: to }),
    onMutate: async ({ ticket, to }) => {
      setMoveError(null);
      setNotice(null);
      setSaving(ticket.id, true);
      await queryClient.cancelQueries({ queryKey: listKey });
      // Optimistic: move the card now (to the top of its new column).
      queryClient.setQueryData<TicketSummary[]>(listKey, (old) =>
        old?.map((t) => (t.id === ticket.id ? { ...t, state: to, modifiedAt: new Date().toISOString() } : t)),
      );
      return { previous: ticket };
    },
    onError: (err, { ticket, to }, ctx) => {
      // Roll back only this card, so concurrent moves of other cards are unaffected.
      queryClient.setQueryData<TicketSummary[]>(listKey, (old) =>
        old?.map((t) => (t.id === ticket.id && ctx ? ctx.previous : t)),
      );
      setMoveError(
        `Could not move "${ticket.title}" to ${STATE_LABELS[to]}: ${err.message} The card was returned to ${STATE_LABELS[ticket.state]}.`,
      );
      queryClient.invalidateQueries({ queryKey: listKey });
    },
    onSuccess: (updated) => {
      queryClient.setQueryData<TicketSummary[]>(listKey, (old) =>
        old?.map((t) => (t.id === updated.id ? { ...t, state: updated.state, modifiedAt: updated.modifiedAt } : t)),
      );
      queryClient.setQueryData(ticketKey(updated.id), updated);
    },
    onSettled: (_d, _e, { ticket }) => setSaving(ticket.id, false),
  });

  const { mutate: moveTicket } = move; // stable across renders
  const onMove = useCallback((ticket: TicketSummary, to: TicketState) => moveTicket({ ticket, to }), [moveTicket]);
  const onOpen = useCallback((ticket: TicketSummary) => navigate(`/tickets/${ticket.id}`), [navigate]);

  const { columns, totals, shown } = useMemo(() => {
    const columns = emptyColumns();
    const totals = Object.fromEntries(TICKET_STATES.map((s) => [s, 0])) as Record<TicketState, number>;
    const q = search.trim().toLowerCase();
    let shown = 0;
    for (const t of tickets.data ?? []) {
      totals[t.state]++;
      if (typeFilter !== ALL && t.type !== typeFilter) continue;
      if (epicFilter === NO_EPIC ? t.epicId !== null : epicFilter !== ALL && t.epicId !== epicFilter) continue;
      if (q && !t.title.toLowerCase().includes(q)) continue;
      columns[t.state].push(t);
      shown++;
    }
    for (const s of TICKET_STATES) columns[s].sort(byRecency);
    return { columns, totals, shown };
  }, [tickets.data, typeFilter, epicFilter, search]);

  const filtersActive = typeFilter !== ALL || epicFilter !== ALL || search.trim() !== "";
  const clearFilters = () => {
    setTypeFilter(ALL);
    setEpicFilter(ALL);
    setSearch("");
  };

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

  const total = tickets.data?.length ?? 0;

  return (
    <div className="board-page">
      <div className="page-header">
        <h1>{team.name} board</h1>
        <Link className="button" to={`/tickets/new?team=${team.id}`}>
          New ticket
        </Link>
      </div>

      <div className="toolbar" role="search">
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
        <label className="field inline">
          <span>Type</span>
          <select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value as TicketType | typeof ALL)}>
            <option value={ALL}>All types</option>
            {TICKET_TYPES.map((t) => (
              <option key={t} value={t}>
                {TYPE_LABELS[t]}
              </option>
            ))}
          </select>
        </label>
        <label className="field inline">
          <span>Epic</span>
          <select value={epicFilter} onChange={(e) => setEpicFilter(e.target.value)} disabled={epics.isPending}>
            <option value={ALL}>{epics.isPending ? "Loading…" : "All epics"}</option>
            <option value={NO_EPIC}>No epic</option>
            {epics.data?.map((e) => (
              <option key={e.id} value={e.id}>
                {e.title}
              </option>
            ))}
          </select>
          {epics.isError && <small className="error">Could not load epics.</small>}
        </label>
        <label className="field inline grow">
          <span className="sr-only">Search titles</span>
          <input
            type="search"
            placeholder="Search titles…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </label>
        {filtersActive && (
          <button type="button" className="secondary small" onClick={clearFilters}>
            Clear filters
          </button>
        )}
      </div>

      {moveError && (
        <div className="notice error dismissible" role="alert">
          <span>{moveError}</span>
          <button type="button" className="link" onClick={() => setMoveError(null)} aria-label="Dismiss">
            ✕
          </button>
        </div>
      )}
      {notice && <p className="notice success">{notice}</p>}

      {tickets.isPending ? (
        <p className="muted">Loading tickets…</p>
      ) : tickets.isError ? (
        <p className="notice error">Could not load tickets: {tickets.error.message}</p>
      ) : (
        <>
          {total === 0 && (
            <p className="muted">
              No tickets for {team.name} yet. <Link to={`/tickets/new?team=${team.id}`}>Create the first one.</Link>
            </p>
          )}
          {total > 0 && filtersActive && (
            <p className="muted" aria-live="polite">
              Showing {shown} of {total} tickets.{" "}
              {shown === 0 && (
                <button type="button" className="link" onClick={clearFilters}>
                  Clear filters
                </button>
              )}
            </p>
          )}
          <KanbanBoard columns={columns} totals={totals} savingIds={savingIds} onMove={onMove} onOpen={onOpen} />
        </>
      )}
    </div>
  );
}
