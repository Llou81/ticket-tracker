# Ticket Tracker

A small Kanban-style ticket tracker: teams, epics, tickets, comments and a drag-and-drop board.
Three tiers: **React SPA** (served by nginx) → **Node/Express API** → **PostgreSQL**.
Requirements are in [docs/TASK.md](docs/TASK.md).

## Prerequisites

- Docker with Docker Compose v2 (Docker Desktop on Windows/macOS, Docker Engine + compose plugin on Linux).
- Nothing else: no Node, PostgreSQL or other runtime is needed on the host.
- Port `8080` free (configurable, see below).

## Start

From the repository root:

```sh
docker compose up --build
```

Open **http://localhost:8080**. The first build takes a few minutes.

- Database migrations run automatically when the backend starts. A fresh database contains only the schema
  and migration metadata — **no users, teams or tickets**. Create everything through the UI or API.
- Data lives in the `db-data` Docker volume and survives restarts.
- Stop with `docker compose down`. Delete all data with `docker compose down -v`.

> **Email outside the DataArt network:** verification emails go through `relay1.dataart.com` by default, which is
> usually reachable only from the DataArt network. Anywhere else, enable the built-in mail catcher before the first
> start (see [Email without the corporate relay](#email-without-the-corporate-relay)) — it takes three lines in `.env`.

## First steps

1. **Sign up** with an email and a password (8+ characters).
2. Open the **verification link** from the email (valid 24 hours, single use). If it expired or never arrived,
   use *Send a new verification email* on the check-email, verification-result or login screen.
3. **Log in.**
4. Create a team under **Teams**, optionally epics under **Epics**.
5. On the **Board**, pick the team, click **New ticket**, and drag cards between columns.
   Click a card (or press Enter on it) to view, edit, delete or comment.

Keyboard on the board: Tab to a card, **Space** to pick it up, **←/→** to change column, **Space/Enter** to drop,
**Esc** to cancel.

## Configuration

Every setting has a default, so nothing needs configuring to start. To override, copy `.env.example` to `.env`
and edit it. `.env` is git-ignored — never commit real credentials.

| Variable | Default | Purpose |
|---|---|---|
| `APP_PORT` | `8080` | Host port the app is served on |
| `APP_BASE_URL` | `http://localhost:${APP_PORT}` | Public URL used in verification links. Set it if users reach the app under another host name. An `https://` URL also enables `Secure` cookies. |
| `POSTGRES_DB` / `POSTGRES_USER` / `POSTGRES_PASSWORD` | `ticketing` / `ticketing` / `ticketing-local` | Local database container (not exposed to the host) |
| `SMTP_HOST` / `SMTP_PORT` | `relay1.dataart.com` / `25` | SMTP server for verification emails |
| `SMTP_SECURE` | `false` | `true` for implicit TLS (usually port 465); `false` for plain/STARTTLS |
| `SMTP_USER` / `SMTP_PASSWORD` | empty | Only if the SMTP server requires authentication |
| `SMTP_FROM` | `Ticket Tracker <no-reply@ticket-tracker.local>` | Sender address (the relay may require a domain it accepts) |
| `MAILPIT_UI_PORT` | `8025` | Host port of the optional Mailpit UI |

The `POSTGRES_*` defaults exist only so a clean checkout starts with zero configuration. They protect a database
container that is not published to the host; set your own values in `.env` for anything beyond local use.
Changing `POSTGRES_*` after the first start requires `docker compose down -v` (the volume keeps the old credentials).

### Email without the corporate relay

`relay1.dataart.com` is typically reachable only from the DataArt network. To test anywhere else, catch all
outgoing mail in **Mailpit** by adding to `.env`:

```sh
COMPOSE_PROFILES=mail
SMTP_HOST=mailpit
SMTP_PORT=1025
```

Run `docker compose up --build` and read verification emails at **http://localhost:8025**.

If sending fails, the account is still created; the screen says so and offers to resend.

## Tests

```sh
docker compose --profile test run --rm --build backend-test     # full suite
docker compose --profile test run --rm --build backend-test npx vitest run tests/tickets.test.ts -t "modifiedAt"
docker compose --profile test down                              # stop the test database
```

Tests run inside Docker (Vitest + Supertest) against a separate, throwaway PostgreSQL database. Before the suite
runs, that database is rebuilt from the migrations and checked to contain no application data. Email sending is
stubbed. Coverage includes:

- **Business rules:** auth and verification tokens, sessions, team/epic/ticket/comment rules, `modified_at`
  semantics, 409 conflicts, epic-must-match-team (including a database trigger).
- **End-to-end API flow** (`tests/e2e-flow.test.ts`): sign up → verify → log in → team → epic → tickets →
  move → reload → comment → log out.

## Architecture

```
browser ──► nginx (frontend container, :8080)
              ├── /         static SPA (React, Vite build)
              └── /api/*    reverse proxy ──► backend (Express, :3000, internal) ──► PostgreSQL (db, internal)
```

```
compose.yaml          db, backend, frontend (+ mailpit and test profiles)
backend/
  schema.prisma       data model
  migrations/         SQL migrations, applied on startup (some constraints/triggers hand-written)
  src/routes/         HTTP layer: validation (zod), status codes
  src/services/       business rules
  src/middleware/     session auth, same-origin check
  tests/              Vitest + Supertest
frontend/src/
  pages/              screens (board, ticket, teams, epics, auth)
  components/         Kanban board, forms, dialogs, user menu
  api/                typed API client
docs/TASK.md          requirements
```

Key behaviour:

- **Auth:** email + password (Argon2id). Accounts must verify their email first. Sessions are random tokens in
  an `httpOnly`, `SameSite=Lax` cookie (stored hashed, 7-day sliding expiry); nothing sensitive goes in URLs
  except the single-use verification token. Cross-origin writes are rejected.
- **Integrity:** enforced in the database as well as the API — foreign keys block deleting teams/epics that are
  in use (HTTP 409), deleting a ticket cascades to its comments, case-insensitive unique team names and emails,
  non-blank text checks, and a trigger keeping a ticket's epic within the ticket's team.
- **Timestamps:** UTC, ISO-8601 in the API. A ticket's `modifiedAt` changes only when a field or its state
  actually changes — not on no-op saves and not when comments are added. Board columns sort by it, newest first.

### API overview

All endpoints are under `/api`, take and return JSON, and require a session except where marked public.
Errors look like `{ "error": "message", "code": "machine_code", "fields": { "field": "message" } }`.

| Method & path | Notes |
|---|---|
| `GET /health` | public; API + database readiness |
| `POST /auth/signup`, `/auth/verify-email`, `/auth/resend-verification`, `/auth/login`, `/auth/logout` | public |
| `GET /auth/me` | current user |
| `GET/POST /teams`, `GET/PATCH/DELETE /teams/:id` | list includes `epicCount`, `ticketCount`; delete in use → 409 |
| `GET/POST /epics` (`?teamId=`), `GET/PATCH/DELETE /epics/:id` | team fixed at creation; delete in use → 409 |
| `GET /tickets?teamId=`, `POST /tickets`, `GET/PATCH/DELETE /tickets/:id` | `type`: bug, feature, fix; `state`: new, ready_for_implementation, in_progress, ready_for_acceptance, done |
| `GET/POST /tickets/:id/comments` | oldest first; comments are immutable |

## Troubleshooting

- **Port already in use:** set `APP_PORT` (and `MAILPIT_UI_PORT`) in `.env`.
- **No verification email:** check `docker compose logs backend` for SMTP errors; outside the DataArt network
  use the Mailpit setup above.
- **Start over with an empty database:** `docker compose down -v && docker compose up --build`.
