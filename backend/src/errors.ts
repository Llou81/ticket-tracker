import { Prisma } from "@prisma/client";
import type { ErrorRequestHandler } from "express";
import { ZodError } from "zod";

/** An error with an HTTP status and a user-facing message. `code` lets the UI branch on specific cases. */
export class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
    public code?: string,
    public fields?: Record<string, string>,
  ) {
    super(message);
  }
}

/** 400 for a single invalid field, in the same shape as schema validation errors. */
export function fieldError(field: string, message: string) {
  return new HttpError(400, "Please correct the highlighted fields.", "validation_failed", { [field]: message });
}

export const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
  if (err instanceof HttpError) {
    res.status(err.status).json({
      error: err.message,
      ...(err.code && { code: err.code }),
      ...(err.fields && { fields: err.fields }),
    });
    return;
  }
  if (err instanceof ZodError) {
    const fields: Record<string, string> = {};
    for (const issue of err.issues) {
      const key = issue.path.join(".") || "_";
      fields[key] ??= issue.message;
    }
    res.status(400).json({ error: "Please correct the highlighted fields.", code: "validation_failed", fields });
    return;
  }
  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    // Safety nets; services should normally throw a specific HttpError first.
    if (err.code === "P2003") {
      res.status(409).json({ error: "This record is still referenced by other records.", code: "conflict" });
      return;
    }
    if (err.code === "P2025") {
      res.status(404).json({ error: "Record not found.", code: "not_found" });
      return;
    }
  }
  if (err?.type === "entity.parse.failed") {
    res.status(400).json({ error: "Request body is not valid JSON.", code: "invalid_json" });
    return;
  }
  console.error(err);
  res.status(500).json({ error: "Internal server error" });
};
