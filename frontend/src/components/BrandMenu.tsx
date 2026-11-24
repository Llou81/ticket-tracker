import { useCallback, useRef, useState } from "react";
import { Link, NavLink } from "react-router-dom";
import { useDismiss } from "./useDismiss";

/** The app logo: a ticket-shaped mark plus the wordmark. */
function Logo() {
  return (
    <>
      <span className="brand-mark" aria-hidden="true">
        <svg viewBox="0 0 24 24" width="18" height="18">
          <path
            d="M3 7a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v2a2 2 0 0 0 0 6v2a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-2a2 2 0 0 0 0-6z"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinejoin="round"
          />
          <path d="M8.5 12l2.3 2.3L15.5 9.7" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </span>
      <span className="brand-text">
        Ticket<span className="brand-accent">Tracker</span>
      </span>
    </>
  );
}

/** Header logo. Signed-in users get a dropdown with the main sections; otherwise it links home. */
export function BrandMenu({ signedIn }: { signedIn: boolean }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const close = useCallback(() => setOpen(false), []);
  useDismiss(ref, open, close);

  if (!signedIn) {
    return (
      <Link to="/" className="brand">
        <Logo />
      </Link>
    );
  }

  return (
    <div className="brand-menu" ref={ref}>
      <button type="button" className="brand" aria-haspopup="menu" aria-expanded={open} onClick={() => setOpen(!open)}>
        <Logo />
        <span className="brand-caret" aria-hidden="true">▾</span>
      </button>
      {open && (
        <nav className="menu menu-left" role="menu" aria-label="Main">
          <NavLink to="/" end role="menuitem" className="menu-item" onClick={close}>
            Board
          </NavLink>
          <NavLink to="/epics" role="menuitem" className="menu-item" onClick={close}>
            Epics
          </NavLink>
          <NavLink to="/teams" role="menuitem" className="menu-item" onClick={close}>
            Teams
          </NavLink>
        </nav>
      )}
    </div>
  );
}
