# Ticket Tracker: notes for Claude

## Source of truth
Full task: docs/TASK.md. Follow it exactly; ask before deviating.
Out of scope (do NOT build): sprints, story points, roles/admins, team membership,
SSO/OAuth, attachments, notifications, real-time updates, custom workflows.

## Stack
- Frontend: React 18 + Vite + TypeScript, React Router, TanStack Query, @dnd-kit;
            built and served by nginx, which proxies /api to the backend (same origin)
- Backend:  Node 24 LTS + TypeScript, Express, zod, Prisma (migrations), argon2, nodemailer;
            cookie sessions stored in Postgres
- Database: PostgreSQL 16 in its own container
- Tests:    Vitest + Supertest against a separate test DB, run inside Docker
- Mail dev: Mailpit (optional Compose profile) for local SMTP testing

## Commands
- Start everything:  docker compose up --build      (from repo root)
- Fresh database:    docker compose down -v
- Backend logs:      docker compose logs -f backend
- Run tests:         docker compose --profile test run --rm --build backend-test
- Single test:       docker compose --profile test run --rm --build backend-test npx vitest run tests/<file>.test.ts -t "<name>"
                     (vitest global setup resets the test DB from migrations and asserts it is empty)
- New migration:     edit backend/schema.prisma, then generate SQL with
                     docker compose --profile test run --rm --build backend-test npx prisma migrate diff --from-migrations migrations --to-schema-datamodel schema.prisma --shadow-database-url postgresql://test:test@db-test:5432/ticketing_test --script
                     and save it as backend/migrations/<timestamp>_<name>/migration.sql
- Mail catcher:      COMPOSE_PROFILES=mail, SMTP_HOST=mailpit, SMTP_PORT=1025 in .env → UI at http://localhost:8025
- Stop test DB:      docker compose --profile test down
- Lockfiles (no host Node): docker run --rm -v "<abs path>/backend:/app" -w /app node:24-bookworm-slim npm install --package-lock-only
Nothing may be required on the host except Docker + Compose.

## Domain rules (non-negotiable)
- Ticket type enum:  bug | feature | fix
- Ticket state enum: new | ready_for_implementation | in_progress |
                     ready_for_acceptance | done   (UI shows labels with spaces)
- Backend validates every enum value and every reference. Never trust the client.
- A ticket's epic must be null or belong to the SAME team as the ticket (backend-enforced).
- Epic team is fixed at creation.
- Delete team with tickets/epics, or epic referenced by tickets  ->  HTTP 409, no cascade.
- Delete ticket  ->  also deletes its comments (after UI confirmation).
- modified_at changes ONLY on a real field/state change. Not on no-op saves, not on comments.
- Board columns sorted by modified_at desc. Comments oldest first, immutable.
- Timestamps set by server, UTC, ISO-8601 in the API.

## Auth rules
- Emails trimmed, compared case-insensitively, unique.
- Passwords >= 8 chars, hashed with Argon2id. Never logged or stored in plain text.
- Email verification required before using the app. Tokens: 24h expiry, single use,
  issuing a new one invalidates older unused ones. Success -> login screen.
- Only sign-up, login, verify, resend (and static files / health) are public.
- Session IDs / bearer tokens never in URLs (the verification link is the only exception).

## Config & secrets
- All config via env vars; keep .env.example complete and README in sync.
- SMTP host/port/user/password/TLS/from configurable; must work with relay1.dataart.com.
- Never commit .env or any secret. No hard-coded passwords.

## Database
- Schema via automated migrations on startup.
- NO seed/sample data on the default startup path. A fresh DB contains only schema
  + migration metadata.

## How to work
- Work in small vertical slices. After each slice: run the stack and tests, show me
  the output, then stop for review. Don't commit unless asked.
- Don't add dependencies or features beyond the task without asking.
- Shell scripts use LF line endings (.gitattributes: * text=auto eol=lf).
- Show loading, empty, success and error states in the UI.