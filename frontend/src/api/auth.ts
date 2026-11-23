import { api, ApiError, post } from "./client";

export interface User {
  id: string;
  email: string;
}

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

export const logIn = (email: string, password: string) =>
  post<{ user: User }>("/auth/login", { email, password }).then((r) => r.user);

export const logOut = () => post<null>("/auth/logout", {});

/** The current user, or null when not logged in. */
export async function fetchCurrentUser(): Promise<User | null> {
  try {
    return (await api<{ user: User }>("/auth/me")).user;
  } catch (err) {
    if (err instanceof ApiError && err.status === 401) return null;
    throw err;
  }
}
