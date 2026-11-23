# Ticket Tracker

A Kanban-style ticket tracker: React SPA → Node/Express API → PostgreSQL.
Requirements are in [docs/TASK.md](docs/TASK.md).

## Prerequisites

Docker with Docker Compose v2 (Docker Desktop on Windows/macOS, Docker Engine on Linux).
Nothing else needs to be installed on the host.

## Start

From the repository root:

```sh
docker compose up --build
```

Open http://localhost:8080. Database migrations run automatically on backend startup; the database starts
empty (no seed data).

Stop with `docker compose down`. Reset all data with `docker compose down -v`.

## Configuration

Every setting has a default, so no configuration is needed to start. To override, copy `.env.example` to `.env`
and edit it. `.env` is git-ignored; never commit real credentials.

| Variable | Default | Purpose |
|---|---|---|
| `APP_PORT` | `8080` | Host port the app is served on |
| `APP_BASE_URL` | `http://localhost:${APP_PORT}` | Public URL used in verification email links |
| `POSTGRES_DB` / `POSTGRES_USER` / `POSTGRES_PASSWORD` | `ticketing` / `ticketing` / `ticketing-local` | Local database container (not exposed to the host) |
| `SMTP_HOST` / `SMTP_PORT` | `relay1.dataart.com` / `25` | SMTP server for verification emails |
| `SMTP_SECURE` | `false` | `true` for implicit TLS (usually port 465); `false` for plain/STARTTLS |
| `SMTP_USER` / `SMTP_PASSWORD` | empty | Only if the SMTP server requires authentication |
| `SMTP_FROM` | `Ticket Tracker <no-reply@ticket-tracker.local>` | Sender address |

### Testing email locally without the relay

Mailpit catches all outgoing mail and shows it in a web UI. Add to `.env`:

```sh
COMPOSE_PROFILES=mail
SMTP_HOST=mailpit
SMTP_PORT=1025
```

Then `docker compose up --build` and open http://localhost:8025 to read verification emails.

If sending fails, the account is still created and the user can request a new verification email from the
"check your email" or verification-result screen.

## Tests

```sh
docker compose --profile test run --rm --build backend-test
docker compose --profile test down
```

Tests run inside Docker against a separate, throwaway PostgreSQL database. Before the suite runs, the test
database is rebuilt from migrations and checked to contain no application data. Email sending is stubbed.

## Layout

```
compose.yaml      db, backend, frontend (+ test services)
backend/          Express API: src/ (routes, services), migrations/ (Prisma), tests/
frontend/         React SPA: src/ (pages, components, api client); served by nginx, which proxies /api
docs/TASK.md      requirements
```
