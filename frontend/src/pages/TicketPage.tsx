import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useLocation, useNavigate, useParams } from "react-router-dom";
import { listTeams, TEAMS_KEY } from "../api/teams";
import { deleteTicket, getTicket, ticketKey, TICKETS_KEY, updateTicket, type Ticket } from "../api/tickets";
import { Comments } from "../components/Comments";
import { ConfirmDialog } from "../components/ConfirmDialog";
import { TicketForm } from "../components/TicketForm";
import { formatDateTime } from "../format";
import { STATE_LABELS, TYPE_LABELS } from "../tickets";

export function TicketPage() {
  const { id = "" } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [notice, setNotice] = useState<string | null>((location.state as { notice?: string } | null)?.notice ?? null);

  const ticket = useQuery({ queryKey: ticketKey(id), queryFn: () => getTicket(id) });
  const teams = useQuery({ queryKey: TEAMS_KEY, queryFn: listTeams, enabled: editing });

  const save = useMutation({
    mutationFn: (values: Parameters<typeof updateTicket>[1]) => updateTicket(id, values),
    onSuccess: (updated) => {
      queryClient.setQueryData(ticketKey(id), updated);
      queryClient.invalidateQueries({ queryKey: [...TICKETS_KEY, "list"] });
      queryClient.invalidateQueries({ queryKey: TEAMS_KEY });
      setEditing(false);
      setNotice("Changes saved.");
    },
  });

  const remove = useMutation({
    mutationFn: () => deleteTicket(id),
    onSuccess: () => {
      const teamId = ticket.data?.teamId;
      queryClient.removeQueries({ queryKey: ticketKey(id) });
      queryClient.invalidateQueries({ queryKey: TICKETS_KEY });
      queryClient.invalidateQueries({ queryKey: TEAMS_KEY });
      navigate(teamId ? `/?team=${teamId}` : "/", { replace: true, state: { notice: "Ticket deleted." } });
    },
  });

  if (ticket.isPending) return <p className="muted">Loading ticket…</p>;
  if (ticket.isError) {
    return (
      <div className="page narrow-page">
        <p className="notice error">{ticket.error.message}</p>
        <Link to="/">← Back to board</Link>
      </div>
    );
  }

  const t = ticket.data;

  return (
    <div className="page narrow-page">
      <p>
        <Link to={`/?team=${t.teamId}`}>← Back to {t.teamName} board</Link>
      </p>
      {notice && !editing && <p className="notice success">{notice}</p>}

      <div className="card">
        {editing ? (
          <>
            <h1>Edit ticket</h1>
            {teams.isPending ? (
              <p className="muted">Loading…</p>
            ) : teams.isError ? (
              <p className="notice error">Could not load teams: {teams.error.message}</p>
            ) : (
              <TicketForm
                initial={{ teamId: t.teamId, epicId: t.epicId, type: t.type, state: t.state, title: t.title, body: t.body }}
                teams={teams.data}
                submitLabel="Save changes"
                pending={save.isPending}
                error={save.error}
                onSubmit={(values) => save.mutate(values)}
                onCancel={() => {
                  save.reset();
                  setEditing(false);
                }}
              />
            )}
          </>
        ) : (
          <TicketDetails
            ticket={t}
            onEdit={() => {
              setNotice(null);
              setEditing(true);
            }}
            onDelete={() => {
              remove.reset();
              setConfirmDelete(true);
            }}
          />
        )}
      </div>

      {!editing && <Comments ticketId={t.id} />}

      {confirmDelete && (
        <ConfirmDialog
          title="Delete ticket?"
          confirmLabel="Delete ticket"
          pending={remove.isPending}
          error={remove.isError ? remove.error.message : null}
          onConfirm={() => remove.mutate()}
          onCancel={() => setConfirmDelete(false)}
        >
          <p>
            Delete <strong>{t.title}</strong>? Its comments will be deleted too. This cannot be undone.
          </p>
        </ConfirmDialog>
      )}
    </div>
  );
}

function TicketDetails({ ticket: t, onEdit, onDelete }: { ticket: Ticket; onEdit: () => void; onDelete: () => void }) {
  return (
    <>
      <div className="ticket-header">
        <h1>{t.title}</h1>
        <div className="ticket-actions">
          <button type="button" onClick={onEdit}>
            Edit
          </button>
          <button type="button" className="secondary danger-text" onClick={onDelete}>
            Delete
          </button>
        </div>
      </div>

      <dl className="meta">
        <div>
          <dt>State</dt>
          <dd>
            <span className={`badge state-${t.state}`}>{STATE_LABELS[t.state]}</span>
          </dd>
        </div>
        <div>
          <dt>Type</dt>
          <dd>
            <span className={`badge type-${t.type}`}>{TYPE_LABELS[t.type]}</span>
          </dd>
        </div>
        <div>
          <dt>Team</dt>
          <dd>{t.teamName}</dd>
        </div>
        <div>
          <dt>Epic</dt>
          <dd>{t.epicTitle ?? <span className="muted">None</span>}</dd>
        </div>
        <div>
          <dt>Created by</dt>
          <dd>{t.createdBy.email}</dd>
        </div>
        <div>
          <dt>Created</dt>
          <dd>{formatDateTime(t.createdAt)}</dd>
        </div>
        <div>
          <dt>Modified</dt>
          <dd>{formatDateTime(t.modifiedAt)}</dd>
        </div>
      </dl>

      <div className="ticket-body">{t.body}</div>
    </>
  );
}
