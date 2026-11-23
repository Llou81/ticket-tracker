import type { ReactNode } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useCurrentUser } from "../auth";

function Loading() {
  return <p className="muted">Loading…</p>;
}

function LoadError({ message }: { message: string }) {
  return <p className="notice error">Could not reach the server: {message}</p>;
}

/** Renders children only for a logged-in user; otherwise redirects to /login and comes back afterwards. */
export function RequireAuth({ children }: { children: ReactNode }) {
  const me = useCurrentUser();
  const location = useLocation();
  if (me.isPending) return <Loading />;
  if (me.isError) return <LoadError message={me.error.message} />;
  if (!me.data) return <Navigate to="/login" replace state={{ from: location.pathname + location.search }} />;
  return children;
}

/** For login/sign-up: a logged-in user is sent to the app instead. */
export function PublicOnly({ children }: { children: ReactNode }) {
  const me = useCurrentUser();
  if (me.isPending) return <Loading />;
  if (me.data) return <Navigate to="/" replace />;
  return children;
}
