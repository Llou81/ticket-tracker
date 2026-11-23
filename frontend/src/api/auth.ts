import { post } from "./client";

export interface SignUpResult {
  email: string;
  verificationEmailSent: boolean;
}

export const signUp = (email: string, password: string) =>
  post<SignUpResult>("/auth/signup", { email, password });

export const verifyEmail = (token: string) =>
  post<{ status: "verified" | "already_verified" }>("/auth/verify-email", { token });

export const resendVerification = (target: { token: string } | { email: string }) =>
  post<{ message: string }>("/auth/resend-verification", target);
