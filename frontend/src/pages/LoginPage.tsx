import { Link, useLocation } from "react-router-dom";

// Slice 1 placeholder: verification lands here. The login form arrives in slice 2.
export function LoginPage() {
  const notice = (useLocation().state as { notice?: string } | null)?.notice;

  return (
    <div className="card narrow">
      <h1>Log in</h1>
      {notice && <p className="notice success">{notice}</p>}
      <p className="muted">Login is not implemented yet.</p>
      <p className="muted">
        No account? <Link to="/signup">Sign up</Link>
      </p>
    </div>
  );
}
