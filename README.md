# nest-strict-starter

NestJS backend and Drizzle database package in a pnpm + Turbo monorepo.

## Run locally

Requires Node.js 22 or newer, pnpm 10, and Docker with Compose.

```bash
pnpm install
pnpm run setup
pnpm run dev
```

`setup` copies the root `.env.example` to `.env` if needed, sets `DATABASE_URL` from the PostgreSQL settings, starts PostgreSQL, waits for it to be healthy, and applies migrations. It keeps an existing `.env` and stops if its `DATABASE_URL` points to a different database. Edit the root `.env` to change local credentials or ports; the backend and migration commands use that one file. `pnpm install` is the dependency command; there is no `pnpm run install` script.

`pnpm run dev` starts the backend at `http://localhost:3000` by default. Stop it with Ctrl+C. Turbo also runs the `dev` script of each workspace package, so a future UI package will join the same command. Run `pnpm check` to verify types, lint, formatting, configured dependencies, and existing tests.

## Current backend layout

| Path                        | Responsibility                                                                      |
| --------------------------- | ----------------------------------------------------------------------------------- |
| `apps/backend/src/api/`     | HTTP bootstrap, controllers, Zod DTOs, validation, response mapping, and API wiring |
| `apps/backend/src/modules/` | Business use cases and feature-owned errors, ports, and adapters                    |
| `apps/backend/src/common/`  | Infrastructure shared by HTTP and the future worker                                 |
| `apps/backend/src/worker/`  | Planned queue-job application; not implemented yet                                  |
| `packages/database/`        | Drizzle schema, client types, and migrations                                        |

The backend structure and dependency rules are maintained in [`apps/backend/AGENTS.md`](apps/backend/AGENTS.md). Cross-package and quality rules are in [`AGENTS.md`](AGENTS.md). `pnpm check` runs the configured type, lint, format, dependency, and test tasks. The backend's former dependency-cruiser check has not yet been restored, so its documented import rules currently require review.

## Mock email API

The email endpoint simulates delivery for 1–3 seconds and saves a sent-mail record after the mock client succeeds:

```bash
curl -X POST http://localhost:3000/api/emails \
  -H 'Content-Type: application/json' \
  -d '{"recipient":"ada@example.com","subject":"Hello","body":"Test message"}'
```

List sent mail newest first with `GET /api/emails?limit=20`. Pass the response's `nextCursor` as `cursor` to fetch the next page. IDs use `eml_<ULID>`.

Swagger UI for the current API is at `http://localhost:3000/api/docs`; the OpenAPI JSON is at `http://localhost:3000/api/docs-json`.
