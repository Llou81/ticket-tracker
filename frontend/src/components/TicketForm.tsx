import { useState, type FormEvent } from "react";
import { useQuery } from "@tanstack/react-query";
import { ApiError } from "../api/client";
import { EPICS_KEY, listEpics } from "../api/epics";
import type { TicketInput } from "../api/tickets";
import type { TeamListItem } from "../api/teams";
import { STATE_LABELS, TICKET_STATES, TICKET_TYPES, TYPE_LABELS } from "../tickets";

interface Props {
  initial: TicketInput;
  teams: TeamListItem[];
  submitLabel: string;
  pending: boolean;
  error: Error | null;
  onSubmit: (values: TicketInput) => void;
  onCancel: () => void;
}

/** Create/edit form. Changing the team clears the epic, since epics belong to one team. */
export function TicketForm({ initial, teams, submitLabel, pending, error, onSubmit, onCancel }: Props) {
  const [values, setValues] = useState<TicketInput>(initial);
  const epics = useQuery({
    queryKey: [...EPICS_KEY, values.teamId],
    queryFn: () => listEpics(values.teamId),
    enabled: !!values.teamId,
  });

  const fields = error instanceof ApiError ? error.fields : undefined;
  const set = <K extends keyof TicketInput>(key: K, value: TicketInput[K]) => setValues((v) => ({ ...v, [key]: value }));

  const titleBlank = values.title.trim() === "";
  const bodyBlank = values.body.trim() === "";

  function submit(e: FormEvent) {
    e.preventDefault();
    if (titleBlank || bodyBlank || !values.teamId) return;
    onSubmit(values);
  }

  return (
    <form className="ticket-form" onSubmit={submit}>
      <label className="field">
        <span>Title</span>
        <input autoFocus value={values.title} onChange={(e) => set("title", e.target.value)} aria-invalid={!!fields?.title} />
        {fields?.title && <small className="error">{fields.title}</small>}
      </label>

      <div className="form-grid">
        <label className="field">
          <span>Team</span>
          <select
            value={values.teamId}
            onChange={(e) => setValues((v) => ({ ...v, teamId: e.target.value, epicId: null }))}
          >
            {teams.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
          {fields?.teamId && <small className="error">{fields.teamId}</small>}
        </label>

        <label className="field">
          <span>Epic</span>
          <select
            value={values.epicId ?? ""}
            onChange={(e) => set("epicId", e.target.value || null)}
            disabled={epics.isPending}
            aria-invalid={!!fields?.epicId}
          >
            <option value="">{epics.isPending ? "Loading…" : "No epic"}</option>
            {epics.data?.map((epic) => (
              <option key={epic.id} value={epic.id}>
                {epic.title}
              </option>
            ))}
          </select>
          {epics.isError && <small className="error">Could not load epics.</small>}
          {fields?.epicId && <small className="error">{fields.epicId}</small>}
        </label>

        <label className="field">
          <span>Type</span>
          <select value={values.type} onChange={(e) => set("type", e.target.value as TicketInput["type"])}>
            {TICKET_TYPES.map((t) => (
              <option key={t} value={t}>
                {TYPE_LABELS[t]}
              </option>
            ))}
          </select>
          {fields?.type && <small className="error">{fields.type}</small>}
        </label>

        <label className="field">
          <span>State</span>
          <select value={values.state} onChange={(e) => set("state", e.target.value as TicketInput["state"])}>
            {TICKET_STATES.map((s) => (
              <option key={s} value={s}>
                {STATE_LABELS[s]}
              </option>
            ))}
          </select>
          {fields?.state && <small className="error">{fields.state}</small>}
        </label>
      </div>

      <label className="field">
        <span>
          Body <span className="muted">(plain text or Markdown)</span>
        </span>
        <textarea rows={10} value={values.body} onChange={(e) => set("body", e.target.value)} aria-invalid={!!fields?.body} />
        {fields?.body && <small className="error">{fields.body}</small>}
      </label>

      {error && !fields && <p className="notice error">{error.message}</p>}

      <div className="form-actions">
        <button type="button" className="secondary" onClick={onCancel} disabled={pending}>
          Cancel
        </button>
        <button type="submit" disabled={pending || titleBlank || bodyBlank}>
          {pending ? "Saving…" : submitLabel}
        </button>
      </div>
      {(titleBlank || bodyBlank) && <p className="muted hint">Title and body are required.</p>}
    </form>
  );
}
