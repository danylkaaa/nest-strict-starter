# nest-strict-starter

NestJS backend and Drizzle database package in a pnpm + Turbo monorepo.

## Start the project

```bash
pnpm install
pnpm run setup
pnpm run dev
```

1. `pnpm install` installs workspace dependencies. Use this command, not `pnpm run install`.
2. `pnpm run setup` copies `.env.example` to the root `.env` when missing, derives `DATABASE_URL` from its PostgreSQL settings, starts PostgreSQL, waits for it to be healthy, and applies migrations. You can run it again after pulling new migrations.
3. `pnpm run dev` starts the backend and the database package's build watcher. The backend uses port 3000 unless `http__port` in `.env` changes it. Stop the development processes with Ctrl+C.

## API Doc

Open [Swagger UI](http://localhost:3000/api/docs) to confirm the API is running.

## Current backend layout

| Path                        | Responsibility                                                                      |
| --------------------------- | ----------------------------------------------------------------------------------- |
| `apps/backend/src/api/`     | HTTP bootstrap, controllers, Zod DTOs, validation, response mapping, and API wiring |
| `apps/backend/src/modules/` | Business use cases and feature-owned errors, ports, and adapters                    |
| `apps/backend/src/common/`  | Infrastructure shared by HTTP and the worker                                        |
| `apps/backend/src/worker/`  | Queue-job application;                                                              |
| `packages/database/`        | Drizzle schema, client types, and migrations                                        |
