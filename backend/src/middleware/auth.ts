import type { Request, RequestHandler, Response } from "express";
import { config } from "../config";
import { HttpError } from "../errors";
import { getActiveSession } from "../services/sessions";

export const SESSION_COOKIE = "sid";

export interface AuthUser {
  id: string;
  email: string;
}

const cookieOptions = () =>
  ({ httpOnly: true, sameSite: "lax", secure: config.cookieSecure, path: "/" }) as const;

export function setSessionCookie(res: Response, token: string, expiresAt: Date) {
  res.cookie(SESSION_COOKIE, token, { ...cookieOptions(), expires: expiresAt });
}

export function clearSessionCookie(res: Response) {
  res.clearCookie(SESSION_COOKIE, cookieOptions());
}

export function readSessionToken(req: Request): string | undefined {
  const header = req.headers.cookie;
  if (!header) return undefined;
  for (const part of header.split(";")) {
    const eq = part.indexOf("=");
    if (eq > 0 && part.slice(0, eq).trim() === SESSION_COOKIE) {
      return decodeURIComponent(part.slice(eq + 1).trim()) || undefined;
    }
  }
  return undefined;
}

/** Rejects the request with 401 unless it carries a valid session of a verified user. */
export const requireAuth: RequestHandler = async (req, res, next) => {
  const token = readSessionToken(req);
  const session = token ? await getActiveSession(token) : null;
  if (!session) {
    if (token) clearSessionCookie(res);
    throw new HttpError(401, "Please log in to continue.", "unauthenticated");
  }
  if (session.refreshed) setSessionCookie(res, token!, session.expiresAt);
  res.locals.user = { id: session.user.id, email: session.user.email } satisfies AuthUser;
  next();
};

export function currentUser(res: Response): AuthUser {
  return res.locals.user as AuthUser;
}
