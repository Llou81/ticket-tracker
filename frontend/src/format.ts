const dateTime = new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" });

/** Formats an ISO-8601 UTC timestamp from the API in the viewer's local time zone. */
export function formatDateTime(iso: string): string {
  return dateTime.format(new Date(iso));
}
