import { z } from "zod";
import { HttpError } from "../errors";

/** Required text: trimmed, must not be empty afterwards. */
export const requiredText = (label: string, max: number) =>
  z
    .string({ required_error: `${label} is required.`, invalid_type_error: `${label} must be text.` })
    .trim()
    .min(1, `${label} must not be empty.`)
    .max(max, `${label} must be at most ${max} characters.`);

/** Parses a UUID route parameter; anything else is treated as a missing record. */
export function parseId(value: string, notFoundMessage: string): string {
  const result = z.string().uuid().safeParse(value);
  if (!result.success) throw new HttpError(404, notFoundMessage, "not_found");
  return result.data;
}
