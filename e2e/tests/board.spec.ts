import { expect, test, type APIRequestContext, type Page } from "@playwright/test";

/**
 * Browser flow in real Chromium: sign up → verification email (Mailpit) → verify → log in, then the Kanban board:
 * pointer and keyboard drag, persistence across reload, cancel, no-op drop, failed-move rollback, open, filters;
 * then the header's brand menu and logging out.
 * Runs against the isolated stack from compose.e2e.yaml (fresh database, mail captured by Mailpit).
 */

const MAILPIT = process.env.MAILPIT_URL ?? "http://mailpit:8025";
const EMAIL = `e2e-${Date.now()}@example.com`;
const PASSWORD = "e2e-password-123";

test.describe.configure({ mode: "serial" });

let page: Page;
let teamId: string;
const ids: Record<string, string> = {};
const pageErrors: string[] = [];

/** API call with the session cookie of the browser context and a same-origin Origin header. */
function api(request: APIRequestContext, method: string, path: string, data?: unknown) {
  return request.fetch(`/api${path}`, { method, data, headers: { Origin: new URL(page.url()).origin } });
}

const column = (label: string) => page.locator(`section.column[aria-label="${label}"]`);
const card = (title: string) => page.locator(".column .card-ticket", { hasText: title });
const columnOf = (title: string) =>
  card(title).evaluate((el) => el.closest("section.column")?.getAttribute("aria-label"));
const firstTitleIn = (label: string) => column(label).locator(".card-title").first();
const patchOf = (title: string) =>
  page.waitForResponse((r) => r.url().endsWith(`/api/tickets/${ids[title]}`) && r.request().method() === "PATCH");

async function pointerDrag(title: string, toLabel: string) {
  const from = (await card(title).boundingBox())!;
  const to = (await column(toLabel).boundingBox())!;
  await page.mouse.move(from.x + from.width / 2, from.y + from.height / 2);
  await page.mouse.down();
  await page.mouse.move(from.x + from.width / 2 + 10, from.y + from.height / 2, { steps: 3 }); // pass activation distance
  await page.mouse.move(to.x + to.width / 2, to.y + 80, { steps: 15 });
  await page.mouse.up();
}

/** Records whether any PATCH is sent while `action` runs. */
async function sendsPatch(action: () => Promise<void>) {
  let sent = false;
  const listener = (r: { method(): string }) => {
    if (r.method() === "PATCH") sent = true;
  };
  page.on("request", listener);
  await action();
  await page.waitForTimeout(500);
  page.off("request", listener);
  return sent;
}

async function verificationLink(email: string): Promise<string> {
  for (let i = 0; i < 40; i++) {
    const search = await fetch(`${MAILPIT}/api/v1/search?query=${encodeURIComponent(`to:"${email}"`)}`);
    const { messages } = (await search.json()) as { messages: { ID: string }[] };
    if (messages.length > 0) {
      const message = (await (await fetch(`${MAILPIT}/api/v1/message/${messages[0].ID}`)).json()) as { Text: string };
      const link = message.Text.match(/https?:\/\/\S+\/verify-email\?token=\S+/)?.[0];
      if (link) return link;
    }
    await new Promise((r) => setTimeout(r, 250));
  }
  throw new Error(`No verification email for ${email}`);
}

test.beforeAll(async ({ browser }) => {
  page = await browser.newPage();
  page.on("pageerror", (e) => pageErrors.push(String(e)));
});

test.afterAll(async () => {
  await page.close();
});

test("sign up, verify by email, and log in", async () => {
  await page.goto("/signup");
  await page.getByLabel("Email").fill(EMAIL);
  await page.getByLabel("Password").fill(PASSWORD);
  await page.getByRole("button", { name: "Sign up" }).click();
  await expect(page.getByRole("heading", { name: "Verify your email" })).toBeVisible();

  // Unverified accounts can't log in yet.
  await page.goto("/login");
  await page.getByLabel("Email").fill(EMAIL);
  await page.getByLabel("Password").fill(PASSWORD);
  await page.getByRole("button", { name: "Log in" }).click();
  await expect(page.getByText("Please verify your email address before logging in.")).toBeVisible();

  // The emailed link verifies and lands on the login screen.
  await page.goto(await verificationLink(EMAIL));
  await expect(page.getByText("Your email is verified. You can now log in.")).toBeVisible();
  await page.getByLabel("Email").fill(EMAIL);
  await page.getByLabel("Password").fill(PASSWORD);
  await page.getByRole("button", { name: "Log in" }).click();
  await expect(page.getByRole("button", { name: `${EMAIL} ▾` })).toBeVisible();
});

test("board shows tickets in their state columns", async () => {
  // Unique per run, so the suite can be re-run without resetting the stack.
  const team = await (await api(page.request, "POST", "/teams", { name: `E2E Board ${Date.now()}` })).json();
  teamId = team.id;
  const tickets: [string, string, string][] = [
    ["Drag A", "new", "bug"],
    ["Drag B", "new", "feature"],
    ["Drag C", "in_progress", "fix"],
    ["Drag D", "in_progress", "bug"],
  ];
  for (const [title, state, type] of tickets) {
    const res = await api(page.request, "POST", "/tickets", { teamId, title, state, type, body: "e2e" });
    expect(res.status()).toBe(201);
    ids[title] = (await res.json()).id;
  }

  await page.goto(`/?team=${teamId}`);
  await expect(card("Drag A")).toBeVisible();
  await expect(page.locator("section.column")).toHaveCount(5);
  expect(await columnOf("Drag A")).toBe("New");
  expect(await columnOf("Drag C")).toBe("In progress");
});

test("pointer drag persists the new state, also after reload", async () => {
  const saved = patchOf("Drag A");
  await pointerDrag("Drag A", "In progress");
  expect((await saved).status()).toBe(200);
  expect(await columnOf("Drag A")).toBe("In progress");
  await expect(firstTitleIn("In progress")).toHaveText("Drag A"); // most recently modified first

  await page.reload();
  await expect(card("Drag A")).toBeVisible();
  expect(await columnOf("Drag A")).toBe("In progress");
  await expect(firstTitleIn("In progress")).toHaveText("Drag A");
});

test("keyboard drag: Space, arrow, Space", async () => {
  const saved = patchOf("Drag B");
  await card("Drag B").focus();
  await page.keyboard.press("Space");
  await page.keyboard.press("ArrowRight");
  await page.keyboard.press("Space");
  expect((await saved).status()).toBe(200);
  expect(await columnOf("Drag B")).toBe("Ready for implementation");
  expect(new URL(page.url()).pathname).toBe("/"); // dropping does not open the ticket
});

test("Escape cancels a drag and dropping on the same column is a no-op", async () => {
  const cancelled = await sendsPatch(async () => {
    await card("Drag D").focus();
    await page.keyboard.press("Space");
    await page.keyboard.press("ArrowRight");
    await page.keyboard.press("Escape");
  });
  expect(cancelled).toBe(false);
  expect(await columnOf("Drag D")).toBe("In progress");

  expect(await sendsPatch(() => pointerDrag("Drag D", "In progress"))).toBe(false);
});

test("a failed move returns the card and shows an error", async () => {
  // Delete the ticket behind the board's back; the board still shows it.
  expect((await api(page.request, "DELETE", `/tickets/${ids["Drag C"]}`)).status()).toBe(204);

  const failed = patchOf("Drag C");
  await pointerDrag("Drag C", "Done");
  expect((await failed).status()).toBe(404);
  await expect(page.getByRole("alert")).toContainText('Could not move "Drag C" to Done');
  await expect(page.getByRole("alert")).toContainText("returned to In progress");
  await expect(column("Done").locator(".card-ticket", { hasText: "Drag C" })).toHaveCount(0);
});

test("clicking a card opens the ticket", async () => {
  await card("Drag A").click();
  await expect(page).toHaveURL(/\/tickets\//);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Drag A");
  await page.goBack();
  await expect(card("Drag A")).toBeVisible();
});

test("filters: title search and type", async () => {
  await page.getByPlaceholder("Search titles…").fill("DRAG a");
  await expect(page.locator(".column .card-ticket")).toHaveCount(1);
  await page.getByRole("button", { name: "Clear filters" }).first().click();

  await page.getByLabel("Type").selectOption("feature");
  await expect(page.locator(".column .card-ticket")).toHaveCount(1);
  await expect(card("Drag B")).toBeVisible();
  await page.getByRole("button", { name: "Clear filters" }).first().click();
  await expect(page.locator(".column .card-ticket")).toHaveCount(3);
});

test("brand menu navigates between sections", async () => {
  await page.getByRole("button", { name: /Ticket\s*Tracker/ }).click();
  await page.getByRole("menuitem", { name: "Teams" }).click();
  await expect(page).toHaveURL(/\/teams$/);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Teams");
  await expect(page.getByRole("menuitem")).toHaveCount(0); // menu closed after navigating
});

test("logging out swaps the header to Log in / Sign up", async () => {
  await page.getByRole("button", { name: `${EMAIL} ▾` }).click();
  await page.getByRole("menuitem", { name: "Log out" }).click();
  await expect(page).toHaveURL(/\/login$/);
  await expect(page.getByText("You have been logged out.")).toBeVisible();
  const header = page.locator("header");
  await expect(header.getByRole("link", { name: "Log in" })).toBeVisible();
  await expect(header.getByRole("link", { name: "Sign up" })).toBeVisible();
  await expect(header.getByRole("button", { name: `${EMAIL} ▾` })).toHaveCount(0);
  await expect(header.getByRole("button", { name: /Ticket\s*Tracker/ })).toHaveCount(0);
  await expect(page.getByText("You have been logged out.")).toBeHidden({ timeout: 5000 }); // auto-hides after 3s
});

test("resend verification explains verified and unregistered addresses", async () => {
  await page.getByRole("button", { name: "Resend verification email" }).click();
  const form = page.locator("form.resend");
  await form.getByLabel("Email").fill(EMAIL);
  await form.getByRole("button", { name: "Send a new verification email" }).click();
  await expect(form.getByRole("alert")).toContainText("This email address is already verified.");
  await expect(form.getByRole("alert").getByRole("link", { name: "Log in" })).toBeVisible();

  await form.getByLabel("Email").fill(`nobody-${Date.now()}@example.com`);
  await expect(form.getByRole("alert")).toHaveCount(0); // editing clears the previous result
  await form.getByRole("button", { name: "Send a new verification email" }).click();
  await expect(form.getByRole("alert")).toContainText("This email address is not registered.");
  await expect(form.getByRole("alert").getByRole("link", { name: "Sign up" })).toBeVisible();
});

test("no uncaught JavaScript errors", () => {
  expect(pageErrors).toEqual([]);
});
