import { useEffect, useRef } from "react";
import { useMutation } from "@tanstack/react-query";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { verifyEmail } from "../api/auth";
import { ApiError } from "../api/client";
import { ResendVerification } from "../components/ResendVerification";

export function VerifyEmailPage() {
  const token = useSearchParams()[0].get("token") ?? "";
  const navigate = useNavigate();
  const started = useRef(false);

  const verify = useMutation({
    mutationFn: verifyEmail,
    onSuccess: ({ status }) =>
      navigate("/login", {
        replace: true,
        state: {
          notice:
            status === "verified"
              ? "Your email is verified. You can now log in."
              : "Your email was already verified. You can log in.",
        },
      }),
  });

  // Tokens are single-use: make sure we only submit once (StrictMode runs effects twice in dev).
  useEffect(() => {
    if (!token || started.current) return;
    started.current = true;
    verify.mutate(token);
  }, [token, verify]);

  if (!token) {
    return (
      <div className="card narrow">
        <h1>Verification link incomplete</h1>
        <p>This link is missing its token. Request a new verification email:</p>
        <ResendVerification />
      </div>
    );
  }

  if (verify.isError) {
    const code = verify.error instanceof ApiError ? verify.error.code : undefined;
    const canRetryWithToken = code === "token_expired" || code === "token_invalid";
    return (
      <div className="card narrow">
        <h1>{code === "token_expired" ? "Link expired" : "Verification failed"}</h1>
        <p className="notice error">{verify.error.message}</p>
        <ResendVerification token={canRetryWithToken ? token : undefined} />
        <p className="muted">
          <Link to="/login">Back to log in</Link>
        </p>
      </div>
    );
  }

  return (
    <div className="card narrow">
      <h1>Verifying your email…</h1>
      <p className="muted">One moment.</p>
    </div>
  );
}
