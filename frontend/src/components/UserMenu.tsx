import { useCallback, useRef, useState } from "react";
import { flushSync } from "react-dom";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { logOut, type User } from "../api/auth";
import { CURRENT_USER_KEY } from "../auth";
import { useDismiss } from "./useDismiss";

/** Collapsed menu in the header showing the user's email; contains Log out. */
export function UserMenu({ user }: { user: User }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  const logout = useMutation({
    mutationFn: logOut,
    onSuccess: () => {
      // Update the user query in place rather than clear() it: the header stays mounted and
      // keeps observing that query object, so removing it would leave a stale signed-in header.
      queryClient.setQueryData(CURRENT_USER_KEY, null);
      // Commit the navigation right away; otherwise the current page's RequireAuth sees the null
      // user first and its own redirect to /login replaces this one (dropping the notice).
      flushSync(() => navigate("/login", { replace: true, state: { notice: "You have been logged out.", noticeTimeoutMs: 3000 } }));
      // Drop the previous user's cached data (after the pages using it have unmounted).
      queryClient.removeQueries({ predicate: (q) => q.queryKey[0] !== CURRENT_USER_KEY[0] });
    },
  });

  const close = useCallback(() => setOpen(false), []);
  useDismiss(ref, open, close);

  return (
    <div className="user-menu" ref={ref}>
      <button type="button" className="secondary" aria-haspopup="menu" aria-expanded={open} onClick={() => setOpen(!open)}>
        {user.email} ▾
      </button>
      {open && (
        <div className="menu" role="menu">
          <button type="button" role="menuitem" className="menu-item" disabled={logout.isPending} onClick={() => logout.mutate()}>
            {logout.isPending ? "Logging out…" : "Log out"}
          </button>
          {logout.isError && <p className="error menu-error">{logout.error.message}</p>}
        </div>
      )}
    </div>
  );
}
