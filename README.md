# nest-strict-starter

NestJS backend and Drizzle database package in a pnpm + Turbo monorepo.

## Start the project

```bash
pnpm install
pnpm run setup
pnpm db:seed
pnpm run dev
```

1. `pnpm install` installs workspace dependencies. Use this command, not `pnpm run install`.
2. `pnpm run setup` copies `.env.example` to the root `.env` when missing, derives `DATABASE_URL` from its PostgreSQL settings, starts PostgreSQL, waits for it to be healthy, applies the Drizzle migrations, and creates or upgrades the pg-boss schema. You can run it again after pulling new migrations.
3. `pnpm db:seed` fills the `airports` and `aircraft` reference tables (safe to re-run).
4. `pnpm run dev` starts the backend API, two queue workers, and the database package's build watcher. The backend uses port 3000 unless `http__port` in `.env` changes it. Stop the development processes with Ctrl+C.

The API enqueues jobs; the two dev workers deliver them (`pnpm --filter backend worker:dev` starts one extra). For a production build, run `pnpm build` and then `pnpm --filter backend worker:start` in the worker process.

## Submit an email job

```bash
curl -X POST http://localhost:3000/api/jobs/email \
  -H 'Content-Type: application/json' \
  -d '{"idempotencyKey":"e523db7b-c6aa-4c9e-bd57-4885dc3ee319","type":"instant","priority":3,"payload":{"recipient":"person@example.com","subject":"Welcome","body":"Hello"}}'
```

The response includes a job ID. Use `GET /api/jobs/:id` for its status and activity; after delivery, its `result.emailId` identifies the sent email. To delay delivery, set `type` to `schedule` and add a future ISO 8601 `startAt`; `DELETE /api/jobs/:id` cancels a pending or scheduled job. Generate a new UUID `idempotencyKey` for each submission; repeating one returns HTTP 409. The worker process logs job pickup and attempt outcomes by job ID.

## Submit a webhook or aircraft report job

Both use the same envelope as the email job (`idempotencyKey`, `type`, `priority`, optional `startAt`) with a different `payload`:

```bash
curl -X POST http://localhost:3000/api/jobs/webhook \
  -H 'Content-Type: application/json' \
  -d '{"idempotencyKey":"0b7d4f52-3c1a-4e63-9d57-1f3a8f0c2b11","type":"instant","priority":3,"payload":{"url":"https://example.com/hook","payload":{"hello":"world"}}}'

curl -X POST http://localhost:3000/api/jobs/aircraft-report \
  -H 'Content-Type: application/json' \
  -d '{"idempotencyKey":"5a1c9e07-8d42-4b6f-a3e1-7c2d9b4f6a80","type":"instant","priority":3,"payload":{"originIcao":"RJTT","destinationIcao":"KSFO","aircraftId":"<id from GET /api/aircraft>","departureAt":"2030-01-01T10:00:00Z"}}'
```

`GET /api/jobs/:id` returns the status, activity, and a `result` of `{ webhookCallId }` or `{ reportId }` once the job completes; `DELETE /api/jobs/:id` cancels a pending or scheduled job. A repeated `idempotencyKey` returns HTTP 409 on every route, and an invalid transit request (unknown airport or aircraft, same airport, past departure) returns HTTP 400. Retried jobs are safe: a webhook is delivered with a per-job key and one report is stored per job. Reset a development database with `docker compose down -v && pnpm run setup`, then `pnpm db:seed`.

## API Doc

Open [Swagger UI](http://localhost:3000/api/docs) to confirm the API is running.

After seeding, `GET /api/airports` lists airports sorted by ICAO code and `GET /api/aircraft` lists aircraft sorted by registration.

## Current backend layout

| Path                        | Responsibility                                                                      |
| --------------------------- | ----------------------------------------------------------------------------------- |
| `apps/backend/src/api/`     | HTTP bootstrap, controllers, Zod DTOs, validation, response mapping, and API wiring |
| `apps/backend/src/modules/` | Business use cases and feature-owned errors, ports, and adapters                    |
| `apps/backend/src/common/`  | Infrastructure shared by HTTP and the worker                                        |
| `apps/backend/src/worker/`  | Queue consumer application and job handler registration                             |
| `packages/database/`        | Drizzle schema, client types, and migrations                                        |
