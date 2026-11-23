import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { listTeams, TEAMS_KEY } from "../api/teams";
import { createTicket, ticketKey, TICKETS_KEY } from "../api/tickets";
import { TicketForm } from "../components/TicketForm";

export function NewTicketPage() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const teams = useQuery({ queryKey: TEAMS_KEY, queryFn: listTeams });

  const create = useMutation({
    mutationFn: createTicket,
    onSuccess: (ticket) => {
      queryClient.setQueryData(ticketKey(ticket.id), ticket);
      queryClient.invalidateQueries({ queryKey: TICKETS_KEY });
      queryClient.invalidateQueries({ queryKey: TEAMS_KEY });
      navigate(`/tickets/${ticket.id}`, { replace: true, state: { notice: "Ticket created." } });
    },
  });

  if (teams.isPending) return <p className="muted">Loading…</p>;
  if (teams.isError) return <p className="notice error">Could not load teams: {teams.error.message}</p>;
  if (teams.data.length === 0) {
    return (
      <div className="page">
        <h1>New ticket</h1>
        <div className="empty">
          Tickets belong to a team. <Link to="/teams">Create a team</Link> first.
        </div>
      </div>
    );
  }

  const requestedTeam = params.get("team");
  const teamId = teams.data.some((t) => t.id === requestedTeam) ? requestedTeam! : teams.data[0].id;
  const backTo = `/?team=${teamId}`;

  return (
    <div className="page narrow-page">
      <p>
        <Link to={backTo}>← Back to board</Link>
      </p>
      <div className="card">
        <h1>New ticket</h1>
        <TicketForm
          initial={{ teamId, epicId: null, type: "feature", state: "new", title: "", body: "" }}
          teams={teams.data}
          submitLabel="Create ticket"
          pending={create.isPending}
          error={create.error}
          onSubmit={(values) => create.mutate(values)}
          onCancel={() => navigate(backTo)}
        />
      </div>
    </div>
  );
}
