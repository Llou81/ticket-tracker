import type { RequestHandler } from "express";
import { HttpError } from "../errors";

const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

/**
 * CSRF defense in depth (on top of SameSite=Lax cookies): browsers send an Origin header on
 * cross-origin writes, so reject state-changing requests whose Origin host differs from the Host.
 * Requests without Origin (curl, tests) are not browser-initiated cross-site requests and pass.
 */
export const sameOrigin: RequestHandler = (req, _res, next) => {
  if (SAFE_METHODS.has(req.method)) return next();
  const origin = req.headers.origin;
  if (!origin) return next();
  let originHost: string | null = null;
  try {
    originHost = new URL(origin).host;
  } catch {
    // malformed Origin → rejected below
  }
  if (originHost !== req.headers.host) {
    throw new HttpError(403, "Cross-origin request blocked.", "bad_origin");
  }
  next();
};
