# Hackathon Task: Ticketing System

Condensed from *Hackathon_Ticketing_System_Requirements_v4 1.docx* (Participant Requirements Specification).
The original document also contains 5 low-fidelity reference wireframes (board, auth screens, ticket details,
team management, epic management); they show information hierarchy, not a mandatory visual design.

Build a small, working **Kanban-style ticket tracker** as a **three-tier SPA backed by an RDBMS**.
Mandatory scope: authentication, teams, epics, tickets, comments, and a draggable Kanban board.
Scrum, sprints, SSO, and advanced project-management features are out of scope.

## 1. Objective
Registered users organize work tickets by team and move them through a fixed Kanban workflow. Must demonstrate a
functional UI, server-side business logic, and persistent relational storage.

## 2. Required Architecture
- SPA frontend; backend exposing an HTTP API; RDBMS for all persistent data.
- Clear separation of presentation, application/API, and persistence tiers. Frontend and backend may be separate
  containers, or the backend may serve the compiled SPA, as long as the three logical tiers stay separated.
- Dedicated server-based RDBMS container (e.g. PostgreSQL).
- Languages/frameworks unrestricted; must be cross-platform.
- From a clean checkout, the whole solution starts from the repo root with `docker compose up --build`. No
  host-installed frontend, backend, or DB runtime may be required beyond Docker Compose. QA must be able to run it
  on a clean Windows, macOS, or Linux laptop.

## 3. User Accounts and Authentication
- Sign-up with email + password. Emails are trimmed, compared case-insensitively, and unique.
- Log in / log out with local credentials (no SSO / external IdP).
- Passwords: min 8 characters, never stored in plain text, hashed with an established algorithm (e.g. Argon2id).
- After sign-up, send a verification email through a **configurable SMTP service**; must support `relay1.dataart.com`.
- A new account cannot use the main application until its email is verified.
- Verification links/tokens expire after **24 hours** and are **single-use**. Successful verification leads to the
  login screen (no auto-login required).
- An unverified user can request a new verification email from the login or verification-result screen. Issuing a
  new token invalidates earlier unused tokens.
- All business screens and API endpoints require authentication, **except** sign-up, login, email verification, and
  verification-email resend. Static frontend assets and optional health/readiness endpoints may be public.

## 4. Teams
- Tickets are grouped by team. Authenticated users can list, create, rename, and delete teams.
- Fields: identifier, name, created timestamp, modified timestamp.
- Name non-empty after trimming, unique case-insensitively.
- Cannot delete a team while it contains tickets or epics; UI shows a clear validation message. No cascading delete.
- No ownership/membership: all verified users can view and manage all teams.

## 5. Epics
- Each epic belongs to exactly one team, chosen at creation and **immutable** afterwards (no moving between teams).
- Separate screen for epic CRUD (create, list, edit, delete).
- Fields: identifier, team reference, title, optional description, created timestamp, modified timestamp.
- Title non-empty after trimming.
- A ticket may optionally reference one epic (drop-down), and only an epic of the **same team**; the backend must
  enforce this.
- Cannot delete an epic while tickets reference it; UI shows a clear validation message.

## 6. Tickets

| Field | Required | Allowed values / type | Notes |
|---|---|---|---|
| ID | Yes | System-generated | Stable and unique. |
| Team | Yes | Team reference | Determines the board. Must reference an existing team. |
| Type | Yes | `bug` \| `feature` \| `fix` | Exactly these values; labels only, no workflow differences. |
| State | Yes | `new` \| `ready_for_implementation` \| `in_progress` \| `ready_for_acceptance` \| `done` | Canonical API values; UI shows human-readable labels with spaces. Fixed workflow. |
| Epic | No | Epic reference | From the ticket's team's epics; null or same-team epic. |
| Title | Yes | Text | Non-empty after trimming; no mandatory max length. |
| Body | Yes | Long text | Non-empty; plain text or Markdown; no rich text required; no mandatory max length. |
| Created at | Yes | Timestamp | Set by server in UTC on creation. |
| Modified at | Yes | Timestamp | Set by server in UTC whenever ticket fields or state change. Adding a comment does **not** change it. |
| Created by | Yes | User reference | Set from the authenticated user. |

Operations:
- Create; open and view all fields (including created by / created at / modified at).
- Edit type, team, epic, title, body, and state.
- Modified timestamp reflects the latest **actual** change; saving unchanged values must not advance it.
- When a ticket's team changes, the UI clears/replaces the selected epic; the backend rejects an epic from another team.
- Delete after explicit confirmation; deleting a ticket deletes its comments.
- Drag-and-drop state changes are persisted immediately.
- Backend validates all enum values and references (client-side validation alone is insufficient).

## 7. Comments
- Authenticated users add comments to a ticket.
- Fields: identifier, ticket reference, author, body, created timestamp. Body non-empty.
- Displayed chronologically, oldest first.
- Adding a comment does not update ticket modified-at (so board ordering doesn't change).
- Immutable in mandatory scope (edit/delete is a stretch feature).

## 8. Kanban Board
- Primary screen: board for one selected team.
- Exactly five columns, one per state, in workflow order.
- Cards show at least title and type; showing the epic is recommended.
- Drag a card to another column → state changes and is persisted via the API.
- If the update fails, the card returns to its previous column and the UI shows an error.
- Any state → any state is allowed (no sequential enforcement).
- Within a column: most recently modified first. No custom manual ordering required.
- Clear way to create a ticket and open an existing ticket.
- Filters: ticket type, epic, and case-insensitive substring search on title; combined with AND; client- or server-side.
- Must remain usable with at least **100 tickets** on one board.

## 9. API and Persistence Expectations
- All create/update/delete go through the backend API and persist in the RDBMS; browser local storage is never the
  system of record.
- Referential integrity via DB constraints and/or server-side validation.
- Meaningful HTTP status codes and error messages for validation failures, auth failures, missing records, and
  conflicts. Deleting a team with tickets/epics, or an epic referenced by tickets → **409 Conflict**.
- IDs: UUIDs or DB-generated numbers. API timestamps: ISO-8601 in UTC.
- Cookie sessions or bearer tokens are both fine. Session IDs / access / bearer tokens must **not** be in URLs
  (the single-use verification token may be).
- No concurrent-edit detection required; last successful write wins.
- Schema creation automated via migrations or equivalent repeatable initialization.
- After migrations, a fresh DB contains **no** users, teams, epics, tickets, or comments (migration metadata allowed).
  Default startup must not load sample/seed data; QA creates data via the UI or API.

## 10. Minimum Screens
Sign-up; email verification result; verification-email resend action (unverified / expired token); login; Kanban
board with team selector; ticket create/edit/details view; team management; epic management.

## 11. Non-Functional Requirements
- **Security:** protect authenticated endpoints, hash passwords, validate input, keep credentials and SMTP secrets out
  of source control.
- **Reliability:** browser refresh or app restart must not lose persisted data.
- **Usability:** loading, empty, success, and error states where applicable.
- **Compatibility:** current desktop Chrome, Edge, or Firefox.
- **Maintainability:** README with prerequisites, configuration, startup commands.
- **Testing:** automated tests covering at least one backend business flow and at least one frontend or API flow.

## 12. Out of Scope
- Scrum: sprints, backlogs, story points, velocity, burndown, sprint planning.
- SSO, OAuth, corporate identity, social login.
- Fine-grained roles, admins, team membership, private teams, per-ticket access control.
- Attachments, notifications, mentions, watchers, audit history, real-time multi-user updates.
- Custom workflows, custom ticket types, subtasks, dependencies, time tracking, reporting dashboards.
- Production deployment, high availability, production-grade mail infrastructure.

## 13. Definition of Done
- [ ] A user can sign up, receive a verification email through the configured SMTP service, verify, and log in.
- [ ] Teams and epics can be managed through the UI and persist in the database.
- [ ] A verified user can create, view, edit, and delete tickets.
- [ ] A user can add comments and see their author and timestamp.
- [ ] The board shows tickets in the correct state columns for the selected team.
- [ ] Dragging a ticket to another column updates the server and stays correct after a page refresh.
- [ ] The app starts from a clean checkout with `docker compose up --build` from the repo root.
- [ ] No hard-coded user password or committed secret.
- [ ] A fresh database has schema and migration metadata only; no preloaded application data.
- [ ] QA can create all test/demo data through the UI or API without manual DB edits.

## 14. Optional Stretch Features
Password reset; edit/delete own comments; ticket activity history; virtualized rendering for large boards.

## 15. Reference Wireframes (in source docx)
1. Kanban board (primary screen) 2. Login, sign-up, email verification 3. Ticket details, editing, comments
4. Team management 5. Epic management.
The header's collapsed user menu is expected to include **Log out**. Disabled delete controls indicate records that
cannot currently be deleted because they are referenced.
