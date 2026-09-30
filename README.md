# nest-strict-starter

NestJS backend and Drizzle database package in a pnpm + Turbo monorepo.

```bash
pnpm install
cp .env.example .env
cp apps/backend/.env.example apps/backend/.env
cp packages/database/.env.example packages/database/.env
pnpm check
pnpm dev
```

Set the PostgreSQL URLs in the two package `.env` files to the same database before starting the API or running migrations. Root `.env` holds Compose settings. Run `docker compose up -d --wait`, then `pnpm db:migrate` when a database is needed.

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
