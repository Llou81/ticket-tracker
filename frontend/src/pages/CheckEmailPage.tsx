import { Link, useLocation } from "react-router-dom";
import type { SignUpResult } from "../api/auth";
import { ResendVerification } from "../components/ResendVerification";

export function CheckEmailPage() {
  const result = useLocation().state as SignUpResult | null;

  return (
    <div className="card narrow">
      <h1>Verify your email</h1>
      {result?.verificationEmailSent === false ? (
        <p className="notice error">
          Your account was created, but we could not send the verification email to <strong>{result.email}</strong>.
          Try sending it again below.
        </p>
      ) : (
        <p>
          We sent a verification link to <strong>{result?.email ?? "your email address"}</strong>. Open it within 24
          hours to activate your account.
        </p>
      )}
      <p className="muted">Didn't get it?</p>
      <ResendVerification initialEmail={result?.email} />
      <p className="muted">
        Already verified? <Link to="/login">Log in</Link>
      </p>
    </div>
  );
}
