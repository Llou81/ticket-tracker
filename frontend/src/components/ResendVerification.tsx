import { useState, type FormEvent } from "react";
import { useMutation } from "@tanstack/react-query";
import { resendVerification } from "../api/auth";

/**
 * Lets an unverified user request a new verification email.
 * With a `token` (from an expired/old link) it is a single button; otherwise an email form.
 */
export function ResendVerification({ token, initialEmail = "" }: { token?: string; initialEmail?: string }) {
  const [email, setEmail] = useState(initialEmail);
  const [useEmail, setUseEmail] = useState(!token);
  const resend = useMutation({ mutationFn: resendVerification });

  if (resend.isSuccess) {
    return <p className="notice success">A new verification email is on its way. Check your inbox.</p>;
  }

  function submit(e: FormEvent) {
    e.preventDefault();
    resend.mutate(useEmail ? { email } : { token: token! });
  }

  return (
    <form className="resend" onSubmit={submit}>
      {useEmail && (
        <label className="field">
          <span>Email</span>
          <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" />
        </label>
      )}
      <button type="submit" className="secondary" disabled={resend.isPending}>
        {resend.isPending ? "Sending…" : "Send a new verification email"}
      </button>
      {resend.isError && <p className="notice error">{resend.error.message}</p>}
      {token && !useEmail && (
        <button type="button" className="link" onClick={() => setUseEmail(true)}>
          Use my email address instead
        </button>
      )}
    </form>
  );
}
