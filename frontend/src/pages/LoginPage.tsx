import { useState, type FormEvent } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { logIn } from "../api/auth";
import { ApiError } from "../api/client";
import { CURRENT_USER_KEY } from "../auth";
import { ResendVerification } from "../components/ResendVerification";
import { useFlashNotice } from "../useFlashNotice";

export function LoginPage() {
  const from = (useLocation().state as { from?: string } | null)?.from;
  const [notice] = useFlashNotice();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showResend, setShowResend] = useState(false);

  const login = useMutation({
    mutationFn: () => logIn(email, password),
    onSuccess: (user) => {
      queryClient.setQueryData(CURRENT_USER_KEY, user);
      navigate(from ?? "/", { replace: true });
    },
    onError: (err) => {
      if (err instanceof ApiError && err.code === "email_not_verified") setShowResend(true);
    },
  });

  const error = login.error instanceof ApiError ? login.error : null;

  function submit(e: FormEvent) {
    e.preventDefault();
    login.mutate();
  }

  return (
    <div className="card narrow">
      <h1>Log in</h1>
      {notice && !login.isError && <p className="notice success">{notice}</p>}
      <form onSubmit={submit}>
        <label className="field">
          <span>Email</span>
          <input type="email" required autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} />
          {error?.fields?.email && <small className="error">{error.fields.email}</small>}
        </label>
        <label className="field">
          <span>Password</span>
          <input
            type="password"
            required
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </label>
        {login.isError && !error?.fields && <p className="notice error">{login.error.message}</p>}
        <button type="submit" disabled={login.isPending}>
          {login.isPending ? "Logging in…" : "Log in"}
        </button>
      </form>

      <div className="section">
        {showResend ? (
          <>
            <p className="muted">Didn't get the verification email, or the link expired?</p>
            <ResendVerification initialEmail={email} />
          </>
        ) : (
          <button type="button" className="link" onClick={() => setShowResend(true)}>
            Resend verification email
          </button>
        )}
      </div>

      <p className="muted">
        No account? <Link to="/signup">Sign up</Link>
      </p>
    </div>
  );
}
