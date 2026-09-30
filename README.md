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

Set the PostgreSQL URLs in the two package `.env` files to the same database before starting the API or running migrations. Root `.env` holds Compose settings. Run `docker compose up -d --wait`, then `pnpm db:migrate` when a database is needed. `pnpm db:seed` seeds the database package's sample user data.

## Current backend layout

| Path                        | Responsibility                                                                      |
| --------------------------- | ----------------------------------------------------------------------------------- |
| `apps/backend/src/api/`     | HTTP bootstrap, controllers, Zod DTOs, validation, response mapping, and API wiring |
| `apps/backend/src/modules/` | Business use cases and feature-owned errors, ports, and adapters                    |
| `apps/backend/src/common/`  | Infrastructure shared by HTTP and the future worker                                 |
| `apps/backend/src/worker/`  | Planned queue-job application; not implemented yet                                  |
| `packages/database/`        | Drizzle schema, client types, migrations, and seed                                  |

The backend structure and dependency rules are maintained in [`apps/backend/AGENTS.md`](apps/backend/AGENTS.md). Cross-package and quality rules are in [`AGENTS.md`](AGENTS.md). `pnpm check` runs the configured type, lint, format, dependency, and test tasks. The backend's former dependency-cruiser check has not yet been restored, so its documented import rules currently require review.
