import { useEffect, useRef, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { logOut, type User } from "../api/auth";
import { CURRENT_USER_KEY } from "../auth";

/** Collapsed menu in the header showing the user's email; contains Log out. */
export function UserMenu({ user }: { user: User }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  const logout = useMutation({
    mutationFn: logOut,
    onSuccess: () => {
      queryClient.clear();
      queryClient.setQueryData(CURRENT_USER_KEY, null);
      navigate("/login", { replace: true, state: { notice: "You have been logged out." } });
    },
  });

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent | KeyboardEvent) => {
      if (e instanceof KeyboardEvent ? e.key === "Escape" : !ref.current?.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", close);
    return () => {
      document.removeEventListener("mousedown", close);
      document.removeEventListener("keydown", close);
    };
  }, [open]);

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
