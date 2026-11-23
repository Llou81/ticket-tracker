import { useState, type FormEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ApiError } from "../api/client";
import { Link } from "react-router-dom";
import {
  createTeam,
  deleteTeam,
  listTeams,
  renameTeam,
  TEAMS_KEY,
  type Team,
  type TeamListItem,
} from "../api/teams";
import { ConfirmDialog } from "../components/ConfirmDialog";
import { formatDateTime } from "../format";

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;
const inUse = (team: TeamListItem) => team.epicCount > 0 || team.ticketCount > 0;
const inUseReason = (team: TeamListItem) => {
  const parts = [team.epicCount > 0 && plural(team.epicCount, "epic"), team.ticketCount > 0 && plural(team.ticketCount, "ticket")];
  return `Cannot delete: this team has ${parts.filter(Boolean).join(" and ")}.`;
};

const fieldError = (err: unknown) =>
  err instanceof ApiError ? (err.fields?.name ?? err.message) : err instanceof Error ? err.message : null;

export function TeamsPage() {
  const queryClient = useQueryClient();
  const teams = useQuery({ queryKey: TEAMS_KEY, queryFn: listTeams });
  const [notice, setNotice] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<Team | null>(null);

  const refresh = () => queryClient.invalidateQueries({ queryKey: TEAMS_KEY });

  const remove = useMutation({
    mutationFn: (team: Team) => deleteTeam(team.id),
    onSuccess: (_data, team) => {
      setDeleting(null);
      setNotice(`Team "${team.name}" deleted.`);
      refresh();
    },
  });

  return (
    <div className="page">
      <div className="page-header">
        <h1>Teams</h1>
      </div>

      <CreateTeamForm
        onCreated={(team) => {
          setNotice(`Team "${team.name}" created.`);
          refresh();
        }}
      />

      {notice && <p className="notice success">{notice}</p>}

      {teams.isPending ? (
        <p className="muted">Loading teams…</p>
      ) : teams.isError ? (
        <p className="notice error">Could not load teams: {teams.error.message}</p>
      ) : teams.data.length === 0 ? (
        <div className="empty">No teams yet. Create the first one above.</div>
      ) : (
        <table className="table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Epics</th>
              <th>Tickets</th>
              <th>Created</th>
              <th>Modified</th>
              <th aria-label="Actions" />
            </tr>
          </thead>
          <tbody>
            {teams.data.map((team) =>
              editingId === team.id ? (
                <RenameRow
                  key={team.id}
                  team={team}
                  onDone={(renamed) => {
                    setEditingId(null);
                    if (renamed) {
                      setNotice(`Team renamed to "${renamed.name}".`);
                      refresh();
                    }
                  }}
                />
              ) : (
                <tr key={team.id}>
                  <td>{team.name}</td>
                  <td>
                    <Link to={`/epics?team=${team.id}`}>{team.epicCount}</Link>
                  </td>
                  <td>
                    <Link to={`/?team=${team.id}`}>{team.ticketCount}</Link>
                  </td>
                  <td className="muted">{formatDateTime(team.createdAt)}</td>
                  <td className="muted">{formatDateTime(team.modifiedAt)}</td>
                  <td className="actions">
                    <button type="button" className="secondary small" onClick={() => setEditingId(team.id)}>
                      Rename
                    </button>
                    <span title={inUse(team) ? inUseReason(team) : undefined}>
                      <button
                        type="button"
                        className="secondary small danger-text"
                        disabled={inUse(team)}
                        aria-label={inUse(team) ? `Delete (${inUseReason(team)})` : undefined}
                        onClick={() => {
                          remove.reset();
                          setDeleting(team);
                        }}
                      >
                        Delete
                      </button>
                    </span>
                    {inUse(team) && <small className="in-use-hint">{inUseReason(team)}</small>}
                  </td>
                </tr>
              ),
            )}
          </tbody>
        </table>
      )}

      {deleting && (
        <ConfirmDialog
          title="Delete team?"
          confirmLabel="Delete team"
          pending={remove.isPending}
          error={remove.isError ? remove.error.message : null}
          onConfirm={() => remove.mutate(deleting)}
          onCancel={() => setDeleting(null)}
        >
          <p>
            Delete <strong>{deleting.name}</strong>? This cannot be undone.
          </p>
        </ConfirmDialog>
      )}
    </div>
  );
}

function CreateTeamForm({ onCreated }: { onCreated: (team: Team) => void }) {
  const [name, setName] = useState("");
  const create = useMutation({
    mutationFn: () => createTeam(name),
    onSuccess: (team) => {
      setName("");
      onCreated(team);
    },
  });

  function submit(e: FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    create.mutate();
  }

  return (
    <form className="inline-form" onSubmit={submit}>
      <label className="field grow">
        <span>New team</span>
        <input
          value={name}
          onChange={(e) => {
            setName(e.target.value);
            if (create.isError) create.reset();
          }}
          placeholder="Team name"
          aria-invalid={create.isError}
        />
        {create.isError && <small className="error">{fieldError(create.error)}</small>}
      </label>
      <button type="submit" disabled={create.isPending || !name.trim()}>
        {create.isPending ? "Adding…" : "Add team"}
      </button>
    </form>
  );
}

function RenameRow({ team, onDone }: { team: Team; onDone: (renamed: Team | null) => void }) {
  const [name, setName] = useState(team.name);
  const rename = useMutation({
    mutationFn: () => renameTeam(team.id, name),
    onSuccess: (renamed) => onDone(renamed),
  });

  function submit(e: FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    rename.mutate();
  }

  return (
    <tr>
      <td colSpan={6}>
        <form className="inline-form" onSubmit={submit}>
          <label className="field grow">
            <span className="sr-only">Team name</span>
            <input
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => e.key === "Escape" && onDone(null)}
              aria-invalid={rename.isError}
            />
            {rename.isError && <small className="error">{fieldError(rename.error)}</small>}
            {!name.trim() && <small className="error">Team name must not be empty.</small>}
          </label>
          <button type="submit" disabled={rename.isPending || !name.trim()}>
            {rename.isPending ? "Saving…" : "Save"}
          </button>
          <button type="button" className="secondary" onClick={() => onDone(null)} disabled={rename.isPending}>
            Cancel
          </button>
        </form>
      </td>
    </tr>
  );
}
