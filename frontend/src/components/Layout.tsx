import type { ReactNode } from "react";
import { Link } from "react-router-dom";

export function Layout({ children }: { children: ReactNode }) {
  return (
    <div className="app">
      <header className="header">
        <Link to="/" className="brand">
          Ticket Tracker
        </Link>
      </header>
      <main className="main">{children}</main>
    </div>
  );
}
