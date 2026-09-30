# Plan: Webhook and aircraft report jobs

Follows the email job rules: submission idempotency key check (409), pg-boss retries, queue creation in `pnpm setup`, append-only activity logs. Backend code is written through the `implement-plan` skill.

## Decisions

- Routes are per queue: `POST /api/jobs/email` (unchanged), `POST /api/jobs/webhook`, `POST /api/jobs/aircraft-report`.
- `apps/web` is untouched.
- Nothing is deployed: no backfill or compatibility code. Rewrite the schema and regenerate migrations from `0000`; reset the dev database with `docker compose down -v && pnpm setup`.

## Steps

1. **Schema** (`packages/database`)
   - Edit `schema.ts` directly and regenerate migrations from `0000`.
   - `jobs` gets a `queue` column (`email`, `webhook`, `aircraft-report`) and a `result` union: `{ emailId }`, `{ webhookCallId }`, `{ reportId }`.
   - `webhook_calls.job_id` becomes `uuid` with a foreign key to `jobs`. Add a partial unique index on `job_id` where `outcome = 'succeeded'`.
   - `aircraft_transit_reports` gets `job_id` with a unique index.

2. **Queues in setup**
   - Add a `QUEUES` list in `common/queue/queue.service.ts`.
   - `scripts/migrate-queue.mjs` and the `QueueService` startup check both loop over it.
   - Verify: `pnpm setup` creates all three queues; the API refuses to start if one is missing.

3. **Generalize jobs** (`modules/jobs`)
   - Rename `EmailJob` to `Job` and `CreateEmailJobInput` to `CreateJobInput<TPayload>`.
   - The repository takes the queue name in `create`, `getQueueJob`, and `cancelJob`.
   - `CompleteJobUseCase` takes a result object.
   - One shared retry policy (3 retries, 60 s delay, backoff) and `MAX_ATTEMPTS = 4`; move `jobLog` to `worker/core/`.
   - Email tests keep passing.

4. **Webhook job**
   - `CreateWebhookJobUseCase`: key check first (409), then schedule validation. Payload `{ url, payload }`, Zod-validated.
   - Delivery key `webhook-job:<jobId>`. `WebhookClient.call` takes it and the mock returns a stable receipt for it.
   - `worker/queues/webhook/webhook-job.handler.ts`: invalid payload goes straight to dead-letter; `WebhookDeliveryFailedError` is a retryable `delivery_failed`; a thrown error is `delivery_or_storage`.
   - Logs never contain the URL or payload.

5. **Aircraft report job**
   - `CreateAircraftReportJobUseCase`: key check (409), then the public `ValidateAircraftTransitRequestUseCase` (400), then enqueue. `JobsModule` imports `AircraftTransitsModule`.
   - `worker/queues/aircraft-report/aircraft-report-job.handler.ts` calls `GenerateAircraftTransitReportUseCase` (no past-departure check).
   - Unknown airport, unknown aircraft, and same-airport errors go straight to dead-letter; thrown errors are retryable.
   - `saveReport` returns the existing report for a repeated `job_id`.

6. **HTTP**
   - Add `POST /api/jobs/webhook` and `POST /api/jobs/aircraft-report` to `JobsController`: 202, Swagger, `ApiEnvelopeResponse`.
   - `JobDto.result` becomes the union. `GET` and `DELETE /api/jobs/:id` work for all three queues.

7. **Worker**: register both handlers in `worker.module.ts`, plus `WebhooksModule` and `AircraftTransitsModule`. Activity logs and recovery come from the shared use cases.

8. **Tests** (written first)
   - Unit specs per use case and handler, modeled on `email-job.handler.spec.ts`.
   - Integration specs: a repeated key returns 409 per queue; a crash-retry yields exactly one webhook success and one report; activity order is `created, started, attempt_failed, started, completed`; cancel works per queue.

9. **Docs**: `DECISIONS.md` (revise the webhook history section; the crash-after-delivery decision is already recorded), `apps/backend/AGENTS.md` (replace the "email queue only" wording), `packages/database/AGENTS.md`, `README.md`.

10. **Gate**: `pnpm check` green, `test:integration` passes against Docker Postgres, reviewer returns `APPROVE`.
