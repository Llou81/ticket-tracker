import { useState, type FormEvent } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { logIn } from "../api/auth";
import { ApiError } from "../api/client";
import { CURRENT_USER_KEY } from "../auth";
import { ResendVerification } from "../components/ResendVerification";

export function LoginPage() {
  const location = useLocation();
  const state = location.state as { notice?: string; from?: string } | null;
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const login = useMutation({
    mutationFn: () => logIn(email, password),
    onSuccess: (user) => {
      queryClient.setQueryData(CURRENT_USER_KEY, user);
      navigate(state?.from ?? "/", { replace: true });
    },
  });

  const error = login.error instanceof ApiError ? login.error : null;
  const notVerified = error?.code === "email_not_verified";

  function submit(e: FormEvent) {
    e.preventDefault();
    login.mutate();
  }

  return (
    <div className="card narrow">
      <h1>Log in</h1>
      {state?.notice && !login.isError && <p className="notice success">{state.notice}</p>}
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
      {notVerified && (
        <div className="section">
          <p className="muted">Didn't get the verification email, or the link expired?</p>
          <ResendVerification initialEmail={email} />
        </div>
      )}
      <p className="muted">
        No account? <Link to="/signup">Sign up</Link>
      </p>
    </div>
  );
}
