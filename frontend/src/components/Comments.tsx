import { useState, type FormEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ApiError } from "../api/client";
import { addComment, commentsKey, listComments, type Comment } from "../api/comments";
import { formatDateTime } from "../format";

/** Chronological (oldest first), immutable comments with an add form at the bottom. */
export function Comments({ ticketId }: { ticketId: string }) {
  const queryClient = useQueryClient();
  const key = commentsKey(ticketId);
  const comments = useQuery({ queryKey: key, queryFn: () => listComments(ticketId) });
  const [body, setBody] = useState("");
  const [added, setAdded] = useState(false);

  const add = useMutation({
    mutationFn: () => addComment(ticketId, body),
    onSuccess: (comment) => {
      // Append locally; the ticket itself is unchanged (comments don't affect modifiedAt).
      queryClient.setQueryData<Comment[]>(key, (old) => [...(old ?? []), comment]);
      setBody("");
      setAdded(true);
    },
  });

  const blank = body.trim() === "";
  const fieldError = add.error instanceof ApiError ? add.error.fields?.body : undefined;

  function submit(e: FormEvent) {
    e.preventDefault();
    if (blank) return;
    setAdded(false);
    add.mutate();
  }

  return (
    <section className="card comments" aria-labelledby="comments-heading">
      <h2 id="comments-heading">
        Comments{comments.data && comments.data.length > 0 && <span className="muted"> ({comments.data.length})</span>}
      </h2>

      {comments.isPending ? (
        <p className="muted">Loading comments…</p>
      ) : comments.isError ? (
        <p className="notice error">Could not load comments: {comments.error.message}</p>
      ) : comments.data.length === 0 ? (
        <p className="muted">No comments yet.</p>
      ) : (
        <ol className="comment-list">
          {comments.data.map((c) => (
            <li key={c.id} className="comment">
              <div className="comment-meta">
                <strong>{c.author.email}</strong>
                <time dateTime={c.createdAt} className="muted">
                  {formatDateTime(c.createdAt)}
                </time>
              </div>
              <div className="comment-body">{c.body}</div>
            </li>
          ))}
        </ol>
      )}

      <form onSubmit={submit} className="comment-form">
        <label className="field">
          <span className="sr-only">Add a comment</span>
          <textarea
            rows={3}
            placeholder="Add a comment…"
            value={body}
            onChange={(e) => {
              setBody(e.target.value);
              setAdded(false);
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) submit(e);
            }}
            aria-invalid={!!fieldError}
          />
          {fieldError && <small className="error">{fieldError}</small>}
        </label>
        {add.isError && !fieldError && <p className="notice error">{add.error.message}</p>}
        {added && !add.isPending && <p className="notice success">Comment added.</p>}
        <div className="form-actions">
          <small className="muted">Ctrl+Enter to post</small>
          <button type="submit" disabled={blank || add.isPending}>
            {add.isPending ? "Posting…" : "Add comment"}
          </button>
        </div>
      </form>
    </section>
  );
}
