import { z } from "zod";
import { HttpError } from "../errors";

/** Required text: trimmed, must not be empty afterwards. */
export const requiredText = (label: string, max: number) =>
  z
    .string({ required_error: `${label} is required.`, invalid_type_error: `${label} must be text.` })
    .trim()
    .min(1, `${label} must not be empty.`)
    .max(max, `${label} must be at most ${max} characters.`);

/** Optional text: trimmed; empty or missing becomes null. */
export const optionalText = (label: string, max: number) =>
  z
    .string({ invalid_type_error: `${label} must be text.` })
    .trim()
    .max(max, `${label} must be at most ${max} characters.`)
    .nullish()
    .transform((v) => (v ? v : null));

/** A reference to another record by UUID (in a request body). */
export const reference = (label: string) =>
  z.string({ required_error: `${label} is required.`, invalid_type_error: `${label} is required.` }).uuid(`${label} not found.`);

/** Parses a UUID route parameter; anything else is treated as a missing record. */
export function parseId(value: string, notFoundMessage: string): string {
  const result = z.string().uuid().safeParse(value);
  if (!result.success) throw new HttpError(404, notFoundMessage, "not_found");
  return result.data;
}
