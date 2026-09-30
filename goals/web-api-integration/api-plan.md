# API additions for the web UI

`apps/web` is being connected to the backend (batch jobs stay mocked in the browser). The web work is done by the orchestrator in parallel; this plan is the backend part. Nothing is deployed: no compatibility code; edit `packages/database/src/schema.ts` and regenerate migrations from `0000` (dev DB reset with `docker compose down -v && pnpm run setup`). Do not touch `apps/web`.

All responses use the standard envelope. Follow the existing jobs patterns (use cases in `modules/jobs/use-case/`, repository port + Drizzle adapter, controllers and Zod DTOs in `api/endpoints/`, Swagger via `ApiEnvelopeResponse`). The web UI uses job type names `email`, `webhook`, `transit`; the API keeps queue names `email`, `webhook`, `aircraft-report` (the web maps them).

## Changes

1. **Store what the UI shows on the job row** (`jobs` table)
   - `payload` jsonb NOT NULL: the submitted payload, written in the same transaction as the job. Why: pg-boss deletes finished jobs after retention, and the UI must show the payload of old jobs.
   - `max_attempts` int NOT NULL, 1-10. All three submission DTOs take an optional `maxAttempts` (default 4). pg-boss `retryLimit = maxAttempts - 1`. The handlers' terminal check (today the shared `MAX_ATTEMPTS = 4`) must use the job's own max attempts instead (read it from the pg-boss job `retryLimit`, or from the row; pick one and document why).
   - Webhook payload gets an optional `method` (`POST` | `PUT`, default `POST`). The mock client ignores it; it is stored and shown.

2. **`GET /api/jobs`**: paged list.
   - Query: `queue` (optional), `status` (optional; comma-separated list of the six statuses), `search` (optional, case-insensitive substring of job ID or payload text), `page` (1-based, default 1), `pageSize` (1-100, default 10).
   - Order: `created_at` descending, `id` descending as tie breaker.
   - Response: `{ items, page, pageSize, total, totalPages }`. Each item: `id`, `queue`, `status`, `priority`, `maxAttempts`, `attempts` (number of `started` events), `idempotencyKey`, `payload`, `result`, `createdAt`, `startAt`, `completedAt` (terminal time, else null), `lastErrorCategory` (category of the latest `attempt_failed`, else null).
   - The status shown and filtered must be correct without a per-row GET: a `scheduled` job whose `startAt` has passed is `pending` (compute the effective status in SQL; do not write it).
   - Register the route so `stats` and the list do not collide with `:id`.

3. **`GET /api/jobs/stats`**: `{ counts: Record<status, number>, healthy: boolean }`. All six statuses always present (zero when empty), using the same effective status as the list. `healthy` is true when the database and pg-boss queue both answer.

4. **`GET /api/jobs/:id`** returns the same fields as a list item plus `activity` (as today). Keep the status reconciliation it already does.

5. **`POST /api/jobs/:id/retry`**: only a `failed` job. It grants exactly one more attempt: verify against the installed pg-boss how `retry` behaves on a failed job (retry count and limit), bump `max_attempts` by 1 so attempts never exceed it, set the status to `pending`, and append a `retried` activity event (add it to the enum, the DB check, and the DTOs; event key `retried:<n>` where n is the number of the new attempt). 404 for an unknown ID; 409 for any other status. Returns the job in the same shape as `GET /api/jobs/:id`. The operation must be atomic with the queue row lock like cancellation. Activity numbering continues (attempt 5 after four failures).

6. **`GET /api/aircraft-transit-reports/:id`**: HTTP read endpoint over the existing `GetAircraftTransitReportUseCase` (`api/endpoints/aircraft-transit-reports/`, 404 when unknown). Return origin, destination, aircraft, `departureAt`, `arrivalAt`, `distanceKm`, `durationMinutes`, and the waypoints (`latitude`, `longitude`, `timestamp`, `altitudeM`, `speedKmh`). Also expose the report ID as `reportId` in the aircraft-report job result if it is not already `{ reportId }`.

7. **Demo failures** in the mock clients, so the UI can demo retries on demand: a webhook URL ending in `/503` always fails with `WebhookDeliveryFailedError`; an email whose recipient ends in `@bounce.test` always fails with `EmailDeliveryFailedError`. Everything else keeps the 10% random failure. The URL and recipient must still not appear in errors or logs.

8. **Submission errors**: a repeated idempotency key stays HTTP 409. Also return the existing job's ID in the error so the UI can link to it: error code `JobConflictError`, and the envelope `error.details` (or the closest existing envelope mechanism; check `api/core/response-envelope/`) carries `{ existingJobId }`. Keep the 409 semantics and message.

9. **Tests first**: unit specs for each new use case and controller; integration specs for the list (filters, search, pagination, effective status, totals), stats, retry (failed to pending to completed, 409 on non-failed, atomic with a concurrent worker), per-job `maxAttempts` (a job with `maxAttempts: 1` fails terminally after one attempt; `maxAttempts: 2` after two), the transit report endpoint, and the `existingJobId` on 409.

10. **Docs**: `apps/backend/AGENTS.md`, `packages/database/AGENTS.md`, `README.md` (endpoint list), `DECISIONS.md` (payload stored on the job row and why, retry semantics, effective status, demo failures).

11. **Gate**: `pnpm check` green; `pnpm --filter backend test:integration` passes on a disposable migrated and seeded database (stop `pnpm dev` workers first or use a separate database); reviewer `APPROVE`.
