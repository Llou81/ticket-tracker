import type { ReactNode } from "react";
import { Link, NavLink } from "react-router-dom";
import { useCurrentUser } from "../auth";
import { UserMenu } from "./UserMenu";

export function Layout({ children }: { children: ReactNode }) {
  const { data: user } = useCurrentUser();

  return (
    <div className="app">
      <header className="header">
        <Link to="/" className="brand">
          Ticket Tracker
        </Link>
        {user && (
          <nav className="nav-main">
            <NavLink to="/" end>
              Board
            </NavLink>
            <NavLink to="/teams">Teams</NavLink>
          </nav>
        )}
        <nav className="nav">
          {user ? (
            <UserMenu user={user} />
          ) : (
            <>
              <Link to="/login">Log in</Link>
              <Link to="/signup">Sign up</Link>
            </>
          )}
        </nav>
      </header>
      <main className="main">{children}</main>
    </div>
  );
}
