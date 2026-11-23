import { useState, type FormEvent } from "react";
import { useMutation } from "@tanstack/react-query";
import { Link, useNavigate } from "react-router-dom";
import { signUp } from "../api/auth";
import { ApiError } from "../api/client";

export function SignUpPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [localError, setLocalError] = useState<string | null>(null);

  const mutation = useMutation({
    mutationFn: () => signUp(email, password),
    onSuccess: (result) => navigate("/check-email", { state: result }),
  });

  const fields = mutation.error instanceof ApiError ? mutation.error.fields : undefined;

  function submit(e: FormEvent) {
    e.preventDefault();
    if (password.length < 8) {
      setLocalError("Password must be at least 8 characters.");
      return;
    }
    setLocalError(null);
    mutation.mutate();
  }

  return (
    <div className="card narrow">
      <h1>Create an account</h1>
      <form onSubmit={submit} noValidate>
        <label className="field">
          <span>Email</span>
          <input
            type="email"
            required
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            aria-invalid={!!fields?.email}
          />
          {fields?.email && <small className="error">{fields.email}</small>}
        </label>
        <label className="field">
          <span>Password</span>
          <input
            type="password"
            required
            minLength={8}
            autoComplete="new-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            aria-invalid={!!(localError || fields?.password)}
          />
          <small className={localError || fields?.password ? "error" : "muted"}>
            {localError ?? fields?.password ?? "At least 8 characters."}
          </small>
        </label>
        {mutation.isError && !fields && <p className="notice error">{mutation.error.message}</p>}
        <button type="submit" disabled={mutation.isPending}>
          {mutation.isPending ? "Creating account…" : "Sign up"}
        </button>
      </form>
      <p className="muted">
        Already have an account? <Link to="/login">Log in</Link>
      </p>
    </div>
  );
}
