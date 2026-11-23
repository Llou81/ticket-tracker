import { useState, type FormEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useSearchParams } from "react-router-dom";
import { ApiError } from "../api/client";
import { createEpic, deleteEpic, EPICS_KEY, listEpics, updateEpic, type Epic } from "../api/epics";
import { listTeams, TEAMS_KEY, type TeamListItem } from "../api/teams";
import { ConfirmDialog } from "../components/ConfirmDialog";
import { Modal } from "../components/Modal";
import { formatDateTime } from "../format";

const inUseReason = (epic: Epic) =>
  `Cannot delete: ${epic.ticketCount} ticket${epic.ticketCount === 1 ? " references" : "s reference"} this epic.`;

type Editing ={ mode: "create" } | { mode: "edit"; epic: Epic };

export function EpicsPage() {
  const queryClient = useQueryClient();
  const [params, setParams] = useSearchParams();
  const teamFilter = params.get("team") ?? "";
  const teams = useQuery({ queryKey: TEAMS_KEY, queryFn: listTeams });
  const epics = useQuery({ queryKey: [...EPICS_KEY, teamFilter], queryFn: () => listEpics(teamFilter || undefined) });

  const [notice, setNotice] = useState<string | null>(null);
  const [editing, setEditing] = useState<Editing | null>(null);
  const [deleting, setDeleting] = useState<Epic | null>(null);

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: EPICS_KEY });
    queryClient.invalidateQueries({ queryKey: TEAMS_KEY }); // epic counts
  };

  const remove = useMutation({
    mutationFn: (epic: Epic) => deleteEpic(epic.id),
    onSuccess: (_d, epic) => {
      setDeleting(null);
      setNotice(`Epic "${epic.title}" deleted.`);
      refresh();
    },
  });

  if (teams.isPending) return <p className="muted">Loading…</p>;
  if (teams.isError) return <p className="notice error">Could not load teams: {teams.error.message}</p>;

  if (teams.data.length === 0) {
    return (
      <div className="page">
        <h1>Epics</h1>
        <div className="empty">
          Epics belong to a team. <Link to="/teams">Create a team</Link> first.
        </div>
      </div>
    );
  }

  return (
    <div className="page">
      <div className="page-header">
        <h1>Epics</h1>
        <button type="button" onClick={() => setEditing({ mode: "create" })}>
          New epic
        </button>
      </div>

      <div className="toolbar">
        <label className="field inline">
          <span>Team</span>
          <select
            value={teamFilter}
            onChange={(e) => setParams(e.target.value ? { team: e.target.value } : {}, { replace: true })}
          >
            <option value="">All teams</option>
            {teams.data.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
        </label>
      </div>

      {notice && <p className="notice success">{notice}</p>}

      {epics.isPending ? (
        <p className="muted">Loading epics…</p>
      ) : epics.isError ? (
        <p className="notice error">Could not load epics: {epics.error.message}</p>
      ) : epics.data.length === 0 ? (
        <div className="empty">No epics {teamFilter ? "for this team " : ""}yet.</div>
      ) : (
        <table className="table">
          <thead>
            <tr>
              <th>Title</th>
              <th>Team</th>
              <th>Description</th>
              <th>Tickets</th>
              <th>Modified</th>
              <th aria-label="Actions" />
            </tr>
          </thead>
          <tbody>
            {epics.data.map((epic) => (
              <tr key={epic.id}>
                <td>{epic.title}</td>
                <td>{epic.teamName}</td>
                <td className="muted clamp" title={epic.description ?? undefined}>
                  {epic.description ?? "—"}
                </td>
                <td>{epic.ticketCount}</td>
                <td className="muted nowrap">{formatDateTime(epic.modifiedAt)}</td>
                <td className="actions">
                  <button type="button" className="secondary small" onClick={() => setEditing({ mode: "edit", epic })}>
                    Edit
                  </button>
                  <span title={epic.ticketCount > 0 ? inUseReason(epic) : undefined}>
                    <button
                      type="button"
                      className="secondary small danger-text"
                      disabled={epic.ticketCount > 0}
                      aria-label={epic.ticketCount > 0 ? `Delete (${inUseReason(epic)})` : undefined}
                      onClick={() => {
                        remove.reset();
                        setDeleting(epic);
                      }}
                    >
                      Delete
                    </button>
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {editing && (
        <EpicFormModal
          editing={editing}
          teams={teams.data}
          defaultTeamId={teamFilter}
          onClose={() => setEditing(null)}
          onSaved={(epic) => {
            setEditing(null);
            setNotice(editing.mode === "create" ? `Epic "${epic.title}" created.` : `Epic "${epic.title}" saved.`);
            refresh();
          }}
        />
      )}

      {deleting && (
        <ConfirmDialog
          title="Delete epic?"
          confirmLabel="Delete epic"
          pending={remove.isPending}
          error={remove.isError ? remove.error.message : null}
          onConfirm={() => remove.mutate(deleting)}
          onCancel={() => setDeleting(null)}
        >
          <p>
            Delete <strong>{deleting.title}</strong> from {deleting.teamName}? This cannot be undone.
          </p>
        </ConfirmDialog>
      )}
    </div>
  );
}

function EpicFormModal({
  editing,
  teams,
  defaultTeamId,
  onClose,
  onSaved,
}: {
  editing: Editing;
  teams: TeamListItem[];
  defaultTeamId: string;
  onClose: () => void;
  onSaved: (epic: Epic) => void;
}) {
  const existing = editing.mode === "edit" ? editing.epic : null;
  const [teamId, setTeamId] = useState(existing?.teamId ?? (defaultTeamId || teams[0]?.id || ""));
  const [title, setTitle] = useState(existing?.title ?? "");
  const [description, setDescription] = useState(existing?.description ?? "");

  const save = useMutation({
    mutationFn: () =>
      existing ? updateEpic(existing.id, { title, description }) : createEpic({ teamId, title, description }),
    onSuccess: onSaved,
  });

  const fields = save.error instanceof ApiError ? save.error.fields : undefined;
  const titleBlank = title.trim() === "";

  function submit(e: FormEvent) {
    e.preventDefault();
    if (titleBlank || !teamId) return;
    save.mutate();
  }

  return (
    <Modal title={existing ? "Edit epic" : "New epic"} onClose={onClose} busy={save.isPending} wide>
      <form onSubmit={submit}>
        <label className="field">
          <span>Team</span>
          {existing ? (
            <>
              <input value={existing.teamName} disabled />
              <small className="muted">An epic's team cannot be changed.</small>
            </>
          ) : (
            <select value={teamId} onChange={(e) => setTeamId(e.target.value)} required>
              {teams.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
          )}
          {fields?.teamId && <small className="error">{fields.teamId}</small>}
        </label>
        <label className="field">
          <span>Title</span>
          <input autoFocus value={title} onChange={(e) => setTitle(e.target.value)} aria-invalid={!!fields?.title} />
          {fields?.title && <small className="error">{fields.title}</small>}
        </label>
        <label className="field">
          <span>
            Description <span className="muted">(optional)</span>
          </span>
          <textarea rows={5} value={description} onChange={(e) => setDescription(e.target.value)} />
          {fields?.description && <small className="error">{fields.description}</small>}
        </label>
        {save.isError && !fields && <p className="notice error">{save.error.message}</p>}
        <div className="dialog-actions">
          <button type="button" className="secondary" onClick={onClose} disabled={save.isPending}>
            Cancel
          </button>
          <button type="submit" disabled={save.isPending || titleBlank}>
            {save.isPending ? "Saving…" : existing ? "Save" : "Create epic"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
