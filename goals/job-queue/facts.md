# Facts

## Guarantee

- Delivery is at-least-once (pg-boss). Processing is effectively-once: every state change a worker writes is fenced by a lease token, and side effects are idempotent by job id.
- DECISIONS.md states that exactly-once delivery is impossible and names the remaining window: a handler with a non-idempotent side effect repeats it if the worker crashes after the effect and before its commit.

## Queue

- pg-boss 12 is the queue, running in the same PostgreSQL database. Redis and a separate broker are not used.
- Our tables are the source of truth for job status. pg-boss only delivers jobs, locks them, and times retries. Its job data is `{ jobId }` only.
- There is one pg-boss queue `jobs` for all job types, plus a `batch-progress` queue and a `jobs-dead` dead-letter queue. Priority applies across all types.
- Every enqueue, complete, fail, and cancel call to pg-boss runs in the same transaction as the matching write to our tables (`{ db }` option), so they never write separately.
- Workers run from a second entrypoint in `apps/api` (`worker.ts`, `NestFactory.createApplicationContext`, no HTTP server). compose runs 1 API and N worker containers.
- Each worker process runs 5 jobs at a time. On SIGTERM it stops fetching new jobs and drains for up to 25s (`boss.stop({ graceful: true, timeout: 25000 })`, compose `stop_grace_period: 30s`). pg-boss then fails any job still running, which uses up an attempt, and the job is retried.

## Data model

- A base `jobs` table holds these lifecycle columns: id (uuid), type, status (`queued | processing | completed | failed | cancelled`), priority (higher = more urgent), attempt, max_attempts, run_at, created_at, started_at, finished_at, progress, error (jsonb), idempotency_key, request_hash, parent_id, child_index, lease_token.
- Each job type has a detail table with typed payload and result columns: `email_jobs`, `webhook_jobs`, `transit_report_jobs`, `batch_jobs`. Each detail table's `job_id` is its primary key and references `jobs`.
- `scheduled` and `pending` are never stored. The API shows a `queued` job as `scheduled` when `run_at > now()`, otherwise as `pending`. List filters and health counts use the same rule.
- `job_logs` (job_id, level `info | warning | error`, message, metadata jsonb, created_at) gets a row in the same transaction as every status change. Handlers may add their own rows.
- `airports` is seeded with about 50 major airports from OurAirports (public domain): IATA code, name, city, country, lat, lon.
- `provider_emails` (idempotency_key primary key, message_id, recipient, sent_at) belongs to the fake email provider.
- Schema and migrations live in `packages/database`.

## Submit and idempotency

- There is one route per type: `POST /jobs/email`, `/jobs/webhook`, `/jobs/transit-report`, `/jobs/batch`. The body is `{ payload, priority?, runAt? }`, with the payload validated by that type's zod schema. Clients cannot set max attempts.
- A missing `runAt`, or one in the past, means the job runs now.
- The `Idempotency-Key` header is optional and globally unique (partial unique index). `request_hash` covers type, payload, priority, and runAt.
- Replaying a key with the same request returns 200 with the existing job. The same key with a different request returns 409 `IDEMPOTENCY_KEY_REUSED`. A new job returns 201. Two concurrent submits with the same key create exactly one job (`INSERT … ON CONFLICT DO NOTHING`, then select the existing row).
- Keys never expire.

## Worker lifecycle

- **Pickup:** `UPDATE jobs SET status = 'processing', attempt = attempt + 1, lease_token = <new uuid>, started_at = now() WHERE id = $1 AND status IN ('queued', 'processing') RETURNING`. If no row comes back, the job was cancelled or has finished; the delivery completes without running the handler.
- Picking up a job that is already `processing` means the previous attempt was lost. The worker writes a `warning` job log row.
- Every completion or failure write includes `WHERE lease_token = <mine>`. If no row matches, the transaction rolls back, including the pg-boss call.
- **Success:** one transaction stores the result, sets `completed` and `finished_at`, writes a log row, calls `boss.complete`, and sends `batch-progress` if the job is a batch child.
- **Error with attempts left:** one transaction calls `boss.fail` and sets the row back to `queued`, with `run_at` equal to the retry time pg-boss computed. It also stores the error and writes a log row.
- **Error on the last attempt:** the row becomes `failed` and stores the error. A batch child also sends `batch-progress`.
- **Crash:** pg-boss notices the missed heartbeat and retries the job. Until the next pickup the row stays `processing`; DECISIONS.md records this lag as a trade-off. On the last attempt, the `jobs-dead` handler sets the row to `failed` with code `WORKER_LOST`, guarded by `WHERE status = 'processing'`. Running it twice changes nothing.
- A crash uses up an attempt, so a job that crashes the worker every time stops after max attempts.
- Every error is retried until max attempts; there is no permanent-error class. Bad input is rejected with 400 at submit instead. That includes checking that both IATA codes of a transit report (and of every transit item in a batch) exist in `airports`.
- The worker's own timeout fires 5s before `expireInSeconds` (25s for email/webhook, 55s for transit report/batch parent). It aborts the handler through an `AbortSignal`, which every sleep respects, and records the failure with code `TIMEOUT` in the same transaction. The job is then retried like any other failure.
- If the completion commit fails (for example, the DB is briefly unreachable), the worker gives up. pg-boss delivers the job again, which is safe because side effects are idempotent and the lease token rejects stale writes.
- `batch-progress` has `retryLimit` 10. If it still dead-letters, the `jobs-dead` handler sets the parent to `failed` with code `PROGRESS_LOST`. Manual retry on that parent re-queues its failed children and sends a fresh recount.
- Retry settings come from the type registry on each `send`: `retryLimit = max_attempts - 1`, `retryDelay` 5s, `retryBackoff` on, `retryDelayMax` 300s, `heartbeatSeconds` 10.
- Max attempts are 3 by default and 5 for webhook. `expireInSeconds` is 30 for email and webhook, and 60 for transit report and batch parent.

## Cancel and retry

- Cancelling a `queued` job sets `cancelled` and calls `boss.cancel` in one transaction. Cancelling a `processing` non-batch job returns 409. Cancelling a finished job returns 409.
- Cancelling a batch (queued or processing) locks the parent and cancels the parent plus every `queued` child. Children that are already running finish normally and are counted. The parent ends as `cancelled` with a partial summary.
- Manual retry is allowed only for `failed` jobs. In one transaction it sets the job to `queued`, resets `attempt` to 0, clears the error, and does a new `boss.send`. It does not depend on pg-boss keeping old rows.
- Retrying a batch parent re-queues only its failed children and sets the parent back to `processing`.

## Job types

- A code-side registry maps each type to its payload schema, handler, and defaults (max attempts, expiry).
- **Email:** sleeps 1–3s, then calls `FakeEmailProvider.send(idempotencyKey = job id)`. The provider writes `provider_emails` in its own transaction, separate from our completion transaction. Calling it again with the same key returns the same messageId without sending twice.
- **Webhook:** sleeps 1–2s. 20% of calls throw a retryable error before any side effect. The random source and the clock are injected so tests are deterministic.
- **Transit report:** takes an origin and destination IATA code and a departure date. It looks both airports up in `airports` and returns the airport coordinates, a great-circle path as a GeoJSON LineString (`@turf/great-circle`), distance, flight time, arrival time, and a mock aircraft (registration, type, speed).
- **Batch:** payload `{ childType: 'email' | 'webhook' | 'transit-report', items: [...] }`, with 1 to 1000 items. Each item is validated against the child type's schema at submit. Batches cannot contain batches. A batch can be scheduled with `runAt`.

## Batch processing

- The parent's handler inserts all child jobs and their pg-boss sends in one transaction. Each child has `parent_id` and `child_index`, and the pair `(parent_id, child_index)` is unique (`ON CONFLICT DO NOTHING`), so a parent that runs twice creates no duplicates. Duplicate items in the list are kept, because they are treated as intentional.
- Children inherit the parent's priority. `batch-progress` jobs run at the parent's priority.
- After fan-out the parent's pg-boss delivery completes, but the parent row stays `processing`.
- When a child reaches a final status (completed or failed), its transaction sends a `batch-progress` job. That job locks the parent row (`SELECT … FOR UPDATE`), then counts the children by status in a new statement, and writes the counts and progress %.
- When every child has finished, `batch-progress` sets the parent to `completed` with the summary `{ total, succeeded, failed, cancelled, failedJobIds }`, even if some children failed. It is idempotent, so running it twice gives the same result. On a cancelled parent it updates the counts but not the status.

## Read API

- `GET /jobs` filters by `status`, `type`, and `parentId`, and paginates with a keyset cursor on `(created_at desc, id)`.
- `GET /jobs/:id` returns status, payload, result, error, progress, attempts, and timestamps. It embeds all job logs and all children.
- `GET /health` returns the DB ping, job counts by status and type, the age of the oldest pending job, and the pg-boss queue size.
- Every job endpoint requires a JWT (the existing global guard). Jobs are not scoped to the user who created them.
- All responses use the standard envelope `{ ok, data }` / `{ ok, error: { code, message } }`.

## Tests and deliverables

- Handlers are unit-tested with the clock and random source injected. Integration tests (real Postgres) cover:
  - two workers never run the same job at once
  - a stale worker's completion is rejected
  - cancel racing with pickup
  - idempotent submit under concurrency
  - batch completion happening exactly once
  - dead-letter handling for a crash on the last attempt
- `README.md` covers how to run the project, how to run tests, an example submit request, and an architecture overview. `DECISIONS.md` and `AI_USAGE.md` follow the assignment's templates.
- Out of scope: web UI, per-user job ownership, key expiry, aborting running handlers, chunked fan-out beyond 1000 items.
- `pnpm check` is green.
