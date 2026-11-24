import { useState, type FormEvent } from "react";
import { useMutation } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { resendVerification } from "../api/auth";
import { ApiError } from "../api/client";

/**
 * Lets an unverified user request a new verification email.
 * With a `token` (from an expired/old link) it is a single button; otherwise an email form.
 * Verified and unregistered addresses get a specific message with a link to log in / sign up.
 */
export function ResendVerification({ token, initialEmail = "" }: { token?: string; initialEmail?: string }) {
  const [email, setEmail] = useState(initialEmail);
  const [useEmail, setUseEmail] = useState(!token);
  const resend = useMutation({ mutationFn: resendVerification });

  if (resend.isSuccess) {
    return (
      <p className="notice success" role="status">
        A new verification email has been sent to <strong>{resend.data.email}</strong>. Check your inbox.
      </p>
    );
  }

  function submit(e: FormEvent) {
    e.preventDefault();
    resend.mutate(useEmail ? { email } : { token: token! });
  }

  const code = resend.error instanceof ApiError ? resend.error.code : undefined;

  return (
    <form className="resend" onSubmit={submit}>
      {useEmail && (
        <label className="field">
          <span>Email</span>
          <input
            type="email"
            required
            value={email}
            onChange={(e) => {
              setEmail(e.target.value);
              if (resend.isError) resend.reset(); // the old result no longer applies to the edited address
            }}
            autoComplete="email"
          />
        </label>
      )}
      <button type="submit" className="secondary" disabled={resend.isPending}>
        {resend.isPending ? "Sending…" : "Send a new verification email"}
      </button>
      {resend.isError && (
        <p className={`notice ${code === "already_verified" ? "info" : "error"}`} role="alert">
          {resend.error.message}{" "}
          {code === "already_verified" && <Link to="/login">Log in</Link>}
          {code === "email_not_registered" && <Link to="/signup">Sign up</Link>}
        </p>
      )}
      {token && !useEmail && (
        <button type="button" className="link" onClick={() => setUseEmail(true)}>
          Use my email address instead
        </button>
      )}
    </form>
  );
}
