# Design Decisions

## Email delivery and persistence

**Approach chosen:** An email use case calls a mock client, waits for its simulated delivery result, then stores the sent message in PostgreSQL. The mock waits 1–3 seconds and returns a unique message ID. Only successful sends are stored.

**Delivery failures:** The mock fails about 10% of calls (`randomInt(0, 10) === 0`) after its delay, returning `EmailDeliveryFailedError` as a `Result` error, the same pattern as the webhook mock. The use case preserves that error and persists nothing, so a retry with the same delivery key is a fresh attempt. The HTTP controller maps it to 502 with code `EmailDeliveryFailedError`; the worker records it as a retryable `attempt_failed` (category `delivery_failed`) through the existing jobs flow, not as a defect. The error message carries no email content. Trade-off: synchronous API callers now see intermittent 502s by design; thrown exceptions (storage defects) remain a separate `delivery_or_storage` category.

**Why:** This gives the email feature a working delivery boundary and durable sent-mail history without introducing the job queue before its concurrency rules are designed.

**Trade-offs:** Sending is synchronous for now. Delivery and database insertion cannot be atomic: if insertion fails after the mock reports success, a later retry could deliver twice. A real provider will need reconciliation or idempotency at this seam.

**Rejected for this slice:** A queue worker and provider-specific client, because neither is needed to demonstrate the email domain yet.

## Webhook simulation

**Approach chosen:** A webhook use case calls a replaceable mock client with a URL and JSON payload. The client waits 1–2 seconds, then returns a receipt of a stable shape on success, with its values derived from the job's delivery key so a repeated call returns the same receipt, or a feature-owned `WebhookDeliveryFailedError` in a `Result` on 10% of calls. It makes no network request.

**Why:** The module can be called by a future worker, while the expected simulated failure remains separate from defects and can later drive retry behavior. The user's 10% failure requirement supersedes the 20% in `docs/task.md`.

**Trade-offs:** Outcomes are intentionally random, and the module does not yet expose an HTTP endpoint or decide retries. The first worker integration will need to map the error to job retry and failure states.

**Rejected for this slice:** Real outbound requests and retry logic inside the feature, because the job queue and its policies are still to be designed.

## Webhook call history

**Approach chosen:** Store one `webhook_calls` row for every completed call, whether it succeeded or failed. Each row has a `whc_<ULID>` ID, a required indexed `job_id`, an outcome, the successful receipt fields or the expected error name and message, and a record timestamp. A lookup by job ID returns attempts newest first.

**Why:** A job may retry a webhook; retaining each attempt makes later inspection possible without overwriting previous outcomes. `job_id` is now a `uuid` foreign key to `jobs`, because webhook delivery runs as a queued job (see "Webhook and aircraft report jobs" below), so PostgreSQL enforces that every call belongs to a real job. A partial unique index on `job_id` where `outcome = 'succeeded'` allows many failed attempts but only one success per job.

**Trade-offs:** The receipt is stored as columns, so a future real provider with a different response shape may need a migration. The database checks that success and failure fields are mutually consistent. The use case returns the stored call's ID with the receipt so the job result can reference it; a repeated success resolves to the first stored record.

**Rejected:** One row per job, because retries would overwrite history. The earlier "no jobs table, so a logical reference only" choice was replaced once the jobs table existed.

## Sent-mail identity and listing

**Approach chosen:** Store only `sent_emails` in the initial migration. Drizzle generates `eml_<ULID>` IDs; PostgreSQL checks their shape. List newest IDs first with an exclusive ID cursor, fetching one extra row to determine whether `nextCursor` exists. The API defaults to 20 items and caps a page at 100.

**Why:** ULIDs give each email a stable, sortable cursor without offset shifts as new rows arrive. A single table and index-backed primary-key order are enough for this slice.

**Trade-offs:** ID order reflects record creation order, which can differ from the exact delivery timestamp under concurrency. Cursor pagination supports moving forward through the current ordering, not arbitrary page numbers.

**Rejected for this slice:** Offset pagination, because inserted rows can shift subsequent pages; a compound timestamp cursor, because the unique ULID already supplies a deterministic order.

## Use-case layout

**Approach chosen:** Put each feature's public use-case classes under `modules/<feature>/use-case/`. Keep adapters in the feature root as `<entity>.repository.ts` and ports in `modules/<feature>/ports/`.

**Why:** This makes the application actions easy to locate and separates them from delivery and persistence files without adding a broader layer hierarchy.

**Trade-offs:** Imports are one directory deeper. The rule is documented in `apps/backend/AGENTS.md` and is not yet machine-enforced.

**Rejected:** Keeping action classes at the feature root, because the email feature already has client and repository files beside them. Prefixing the repository adapter filename with its implementation technology, because the feature owns one repository adapter at this stage and the neutral name stays stable if its implementation changes.

## Feature port injection

**Approach chosen:** Declare replaceable client and repository ports as TypeScript interfaces under each feature's `ports/` directory. Export a symbol injection token from the same file as each interface. Nest modules bind adapters to those tokens, and use cases inject the token while depending on the interface type.

**Why:** Interfaces express the required behavior without making adapters inherit a base class. Colocated tokens give Nest a runtime provider identity after interface types are erased.

**Trade-offs:** Each injected port needs an explicit token and `@Inject` decorator, adding wiring to the use-case constructor. The convention is documented in `apps/backend/AGENTS.md` and is not machine-enforced.

**Rejected:** Abstract classes as port contracts and provider tokens, because they require inheritance for a boundary that only needs a structural interface.

## API documentation

**Approach chosen:** Configure `@nestjs/swagger` in `api/core/swagger/`, publish Swagger UI at `/api/docs`, and document each HTTP operation's validated input and actual success/error envelope. Run `nestjs-zod`'s `cleanupOpenApiDoc` on the generated document.

**Why:** Swagger metadata on controllers stays next to the behavior it describes, while bootstrap and envelope schema wiring have one home. Zod DTO schemas need post-processing to appear correctly in OpenAPI.

**Trade-offs:** Endpoint documentation is a convention rather than a machine-enforced coverage check. The installed `nestjs-zod` declares Swagger peer support through version 11, while this backend uses NestJS and Swagger 12; document generation and the UI routes were verified for the current endpoints, but future dependency upgrades should revisit that peer range.

**Rejected:** A separate handwritten OpenAPI file, because it would duplicate request and response definitions maintained in the controllers.

## Migration baseline

**Approach chosen:** Regenerate migration `0000` with only `sent_emails` and remove the default-user seed path. Apply the new baseline to the configured local database, which had no application tables or migration history.

**Why:** The requested email domain is the first persisted feature in this starter, and the unused `users` schema should not appear in its baseline.

**Trade-offs:** This rewrites migration history. Any other database that already applied the former `users` migration needs a separate reset or migration plan; the local database inspected for this change had no rows or tables to preserve.

## Local setup and environment

**Approach chosen:** Use one root `.env` for Compose, the backend, and database migrations. `pnpm run setup` creates it from `.env.example` when absent, derives `DATABASE_URL` from the local PostgreSQL settings, starts the database, and applies migrations. `pnpm run dev` starts all workspace development processes, including a future UI package.

**Why:** One configuration file avoids copying package-specific environment files and lets the backend and migration tool target the same local database.

**Trade-offs:** The setup script targets a local Compose database and refuses an existing `DATABASE_URL` that differs from its PostgreSQL settings. Other environments can provide variables through their process environment without using the local setup script. Docker is required for the local setup command.

**Rejected:** Separate package `.env` files, because they duplicate the database connection and can drift apart.

## Aircraft transit reports

**Approach chosen:** `modules/aircraft-transits/` generates synthetic reports between any two seeded airports for a seeded aircraft. The path is computed with Turf: `@turf/distance` for the total, then `@turf/bearing` and `@turf/destination` place one waypoint per ~100 km (at least 2) along the great circle, with the first and last points set to the exact airport coordinates. Timestamps are linear in distance, speed is the aircraft's cruise speed, and altitude climbs linearly over the first 10% of the distance, cruises, and descends over the last 10%. Generation waits 1-3 seconds behind a `SimulationDelay` port, and time comes from a `Clock` port so specs use a zero delay and a fixed clock. Reports persist in `aircraft_transit_reports` with a jsonb `waypoints` column; the GeoJSON LineString is derived from the waypoints on read and is not stored.

**Why:** Real flight data (OpenSky) and weather (NOAA) add network dependence, rate limits, and credentials without serving the task's goal of a queue-driven job with an observable result. Placing every waypoint from the origin along the initial bearing keeps one continuous point list across the antimeridian (RJTT to KSFO); `@turf/great-circle` splits such routes into a MultiLineString.

**Rejected:** OpenSky and NOAA as data sources. `@turf/great-circle`, because of the antimeridian split.

**Trade-offs:** Speed is constant at cruise speed, so it does not slow during climb or descent; this is acceptable for a mock. Waypoint longitudes stay within [-180, 180], so a map may draw an RJTT to KSFO line across the whole globe; a UI can unwrap longitudes.

## Seeded reference data

**Approach chosen:** `airports` (ICAO primary key, about 40 major airports) and `aircraft` (`acf_<ULID>` id, unique registration, about 8 real models) are reference tables in `packages/database`, filled by `pnpm db:seed` from committed TypeScript lists with `onConflictDoNothing`, so reruns create no duplicates. Reports reference them by foreign key.

**Why:** Validation needs a closed, known set of airports and aircraft, and committed lists are reviewable and reproducible. The seed is a separate command, not a migration, so reference data can change without rewriting migration history.

**Trade-offs:** A report cannot exist without its seeded rows, so removing a seeded airport or aircraft later requires handling its reports. Seed idempotency and the Drizzle adapter are verified only by `test:integration` and a manual seed-twice check, which need Docker and are outside `pnpm check`.

## Transit request validation split

**Approach chosen:** One private validator (`use-case/validate-transit-request.ts`) serves two public use cases. It uppercases ICAO codes, returns `SameAirportError` before any repository call, resolves airports (`UnknownAirportError` names the code), then the aircraft. `ValidateAircraftTransitRequestUseCase` adds the past-departure check (`DepartureInPastError`) for submission time and saves nothing. `GenerateAircraftTransitReportUseCase` runs the same validator without the past check.

**Why:** A future job controller validates at submission, while a queued or retried job must not fail because time moved on. Sharing one validator keeps the other rules identical in both places.

**Trade-offs:** The report controller and worker consumer are not built yet; only the two read endpoints (`GET /api/airports`, `GET /api/aircraft`) exist, both returning `{ items }` in the standard envelope.

## Email job persistence and queue policy

**Approach chosen:** Use pg-boss 12.35.0 for job pickup, scheduling, priority, retries, and claim recovery. Store a separate application `jobs` row with the same UUID, a unique UUID client submission key, a six-state public status, a nullable JSON result, and append-only `job_activity` rows with unique event keys. Malformed submission keys fail HTTP validation; every repeated valid key is rejected with HTTP 409, including an identical request; no request-body hash is stored. A completed email job's result contains its sent email ID, which gives `GET /api/jobs/:id` the link to the email without adding a job reference to emails sent synchronously through the API. Bridge Drizzle transactions into pg-boss with `fromDrizzle` so enqueue and cancellation update queue and application state together. One worker application discovers and registers every decorated queue handler at startup, so it picks up jobs from every registered queue. Queued emails use `email-job:<job UUID>` as a delivery key distinct from the submission key; the mock returns a deterministic receipt for that key, and `sent_emails.delivery_key` is unique and remains nullable for the existing synchronous path. The approved requirements and plan are in `goals/pg-boss-email-jobs/`.

**Why:** The application needs a durable submission-key constraint and readable activity beyond pg-boss's internal retention. A unique event key lets reconciliation or a retried transition record the same lifecycle event safely once. A separate delivery key lets the mock, and a future provider with server-side idempotency, avoid a second delivery after worker retry. Worker logs show pickup and attempt outcomes using queue name, job ID, and attempt number; the database activity log remains the durable history, and email content stays out of logs.

**Setup:** `pnpm run setup` runs Drizzle migrations first, then invokes the backend-owned pg-boss migration command to create or upgrade its schema and register every queue in `QUEUES` (`email`, `webhook`, `aircraft-report`). API and worker start pg-boss with `migrate: false` and verify each queue exists without running DDL. Setup owns schema changes, so database readiness is explicit before either process starts.

**Trade-offs and items to verify:** Each queue's `work()` registration has its own `localConcurrency` limit (default 1); with multiple queues in one worker process, their limits add up and there is no single process-wide cap. This keeps queue configuration independent but lets queues compete for the process's CPU, memory, and database connections. The JSON result is flexible for later job types but cannot use a foreign key to `sent_emails`; the worker must write the ID returned by the email use case and integration tests must verify it resolves to the sent record. Queue state and application state must be reconciled after a crash between an event write and queue settlement. A local transaction cannot make a future external email provider call exactly once; its API must honor the delivery key. The implementation must verify pg-boss transaction and terminal-failure APIs against the installed release. Priority orders eligible jobs but does not preempt active work.

**Rejected:** Using pg-boss singleton keys as the only idempotency mechanism, because they do not protect an external send after a worker crash; storing only the latest event, because retries need an audit trail.

## Job service and persistence boundary

**Approach chosen:** `JobService` owns queue-state interpretation for reads and interrupted-job reconciliation and attempt lifecycle decisions. The job repository exposes focused storage operations and retains Drizzle queries. Status, result, and activity writes for an attempt remain in one repository transaction. Cancellation stays atomic inside a repository transaction with the pg-boss row lock and queue bridge.

**Why:** Reading queue state and deciding public status or activity are application decisions, while database access belongs in the repository.

**Trade-off:** The service still relies on a repository cancellation operation that combines several writes; splitting those calls across service-level awaits would lose the existing transaction and pickup safety. Queue reconciliation on GET remains best-effort and idempotent through unique event keys.

## Webhook and aircraft report jobs: duplicate external calls after a crash

**Approach chosen:** Webhook delivery and aircraft report generation run as queued jobs on their own queues, with routes per queue (`POST /api/jobs/email`, `/webhook`, `/aircraft-report`) that follow the email rules: a UUID submission key checked first (409 on any repeat), then schedule validation, pg-boss retries (60 s delay, backoff; 4 attempts by default, later made per job, see "Job rows for the web UI") from one shared policy in `common/queue/retry-policy.ts`, and append-only `job_activity`. `jobs.queue` records which queue owns a row, so `GET` and `DELETE /api/jobs/:id` work for all three, and `jobs.result` is a union: `{ emailId }`, `{ webhookCallId }`, or `{ reportId }`. `QUEUES` in `common/queue/queue.service.ts` lists the queues; `pnpm run setup` creates them and API and worker startup refuse a missing one. The aircraft route runs the public `ValidateAircraftTransitRequestUseCase` at submission (HTTP 400, including the past-departure check); the worker calls `GenerateAircraftTransitReportUseCase`, which has no past check, so a retried job does not fail as time passes. Unknown airport, unknown aircraft, same airport, and malformed payloads go straight to dead-letter because a retry cannot change the outcome; thrown errors and webhook delivery failures are retryable. Nothing is deployed, so the schema was rewritten and migrations regenerated from `0000` without backfill; reset a development database with `docker compose down -v && pnpm run setup`.

**Why:** A worker can crash after an external side effect and before the job is marked complete, so pg-boss will run the job again. Each side effect therefore has a per-job key that makes the repeat harmless. The webhook delivery key is `webhook-job:<jobId>`: the mock client derives its receipt from it, and a partial unique index on `webhook_calls(job_id) WHERE outcome = 'succeeded'` keeps one success per job; a repeated success resolves to the stored record, so the job result points at it. `aircraft_transit_reports.job_id` is unique and `saveReport` returns the existing report for a repeated job, so a retry produces one report. Webhook logs carry only queue, job ID, attempt, and outcome, never the URL or payload.

**Trade-offs and items to verify:** The key makes a repeat safe only if the provider honors it server-side; the mock does, and a real webhook receiver must accept the key (for example as an idempotency header) or may receive the call twice. Delivery and its record cannot share a transaction, so a crash between them can leave a delivered call without a record until the retry writes it. Retrying also re-runs the simulated 1 to 3 second report delay. The queue name list is duplicated in `scripts/migrate-queue.mjs` because a plain script cannot import the TypeScript source; a unit test checks the two stay in sync. The integration suites share one database and run serially (`fileParallelism: false`) because any worker consumes every queue's jobs.

**Rejected:** One generic route with a `queue` field, because payload schemas and error mapping differ per queue. A generic `queue` column without a result union, because the three results have different identities. Treating the repeated webhook success as an error, because the retry is expected and must complete the job.

## Job rows for the web UI: payload, attempts, status, retry

**Approach chosen:** The submitted payload and the job's attempt limit are stored on the `jobs` row (`payload` jsonb, `max_attempts`), written in the same transaction as the job and its pg-boss row. `GET /api/jobs` (paged, filtered, searchable), `GET /api/jobs/stats`, `GET /api/jobs/:id`, `POST /api/jobs/:id/retry`, and `GET /api/aircraft-transit-reports/:id` serve the web UI. Nothing is deployed, so the schema changed in place and migrations were regenerated from `0000`.

**Why the payload lives on the row:** pg-boss deletes finished jobs after its retention period, and the UI must show the payload of old jobs. The row is the durable record, like the result and the activity log.

**Per-job attempts:** Submissions take `maxAttempts` (1-10, default 4); pg-boss `retryLimit = maxAttempts - 1`. The handlers' terminal check reads the job's own `max_attempts` from the row (inside `JobService.recordFailure`, which returns `{ terminal }` to the handler) instead of the pg-boss `retryLimit`, because the work handler's job object carries no retry limit and a retry raises the row and the queue limit together, so they cannot disagree. The database check is only `max_attempts >= 1`: a retry raises the stored limit above the submission maximum of 10.

**Effective status:** A job stays stored as `scheduled` while it waits, and nothing writes the moment it becomes eligible, so the list and stats compute the status in SQL: `scheduled` with an eligibility time in the past is `pending`. The eligibility time is pg-boss `start_after` (joined by queue and ID) and falls back to `jobs.start_at`, because a retry delay moves `start_after` past the original `start_at`; using only `start_at` would show a job in its 60 second backoff as pending. The status is never written by a read. `completedAt` is the latest terminal activity event while the job is terminal, and `attempts` counts `started` events. Trade-off: the join reads `pgboss.job`, a table owned by the library (only `id`, `name`, `start_after`); a pg-boss schema change would need this query revisited. Search uses `ILIKE` on the job ID and the jsonb payload text, so it does not use an index; acceptable at this scale.

**Retry semantics:** pg-boss `retry` on a failed job sets its state to `retry`, raises `retry_limit` by one, and keeps `retry_count`, so exactly one more attempt becomes possible, numbered `retry_count + 2`. The repository therefore raises `max_attempts` by one, sets the status to `pending`, pulls the queue job's `start_after` to now (a dead-lettered job would otherwise wait out a backoff), and appends a `retried:<n>` activity event, all in one transaction that locks the `jobs` row and the pg-boss row first, like cancellation. Two simultaneous retries grant one attempt (the loser sees a non-failed job and gets 409), and a worker pickup cannot interleave. `failed` events are now keyed `failed:<attempt>` so a retried job that fails terminally again records a second `failed` event. Known limitation: a job dead-lettered early (for example an invalid payload at attempt 1 of 4) and retried gets `max_attempts + 1`, so it has more than one attempt left; the plan says to bump by one, and the case is a dead end for input errors anyway.

**Demo failures:** The mock webhook client always fails a URL ending in `/503`, and the mock email client always fails a recipient ending in `@bounce.test` (case-insensitive), with the existing error types; all other calls keep the 10% random failure. The URL and recipient stay out of errors and logs. This lets the UI show retries on demand without waiting for a random failure.

**Conflict details:** A repeated submission key stays HTTP 409 and now carries `error.details.existingJobId` so the UI can link to the existing job. The error envelope gained an optional `details` object for structured, non-sensitive facts.

**Other choices:** `totalPages` is at least 1 (an empty list is one empty page). A malformed report ID returns 404 like an unknown one, since the ID is opaque to clients. The webhook `method` is validated, stored, and shown, but the mock ignores it.
