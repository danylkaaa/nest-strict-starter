# Design Decisions

## Backend application and feature split

**Approach chosen:** `apps/backend/src/api/` owns the HTTP application and its controllers and Zod DTOs. `src/worker/` will own queue consumers. `src/modules/<feature>/` owns business use cases, feature errors, repository ports and adapters, and Nest feature wiring. `src/common/` holds non-domain infrastructure shared by API and worker. New actions use one public `<Action>UseCase.execute(input)` class and return a `Result` for expected feature errors. API and worker translate those results for their own transports. A feature may call another feature's public use case, but feature dependencies must not cycle.

**Why:** Both entry points can reuse one business action without putting HTTP or queue semantics into it. Each feature keeps its queries and business errors local, while database connection setup can be shared.

**Trade-offs:** The existing `GreetingService` remains a smaller legacy example rather than a template for new use-case naming. Nest injection and logging remain available inside use cases, so they are not framework-free. The worker and a feature-owned Drizzle adapter are still planned, and the new dependency direction is documented but is not yet checked by dependency-cruiser after the old configuration was removed.

---

## Backend configuration and Drizzle composition

**Approach chosen:** `@nestjs/config` loads environment variables. A `flat.unflatten` loader converts `__`-separated names into nested data, then the composed Zod schema validates it. Each nested schema stays beside its owning module. `AppModule` extracts `ApiConfig.postgres` in the factory passed to `DatabaseModule.forRootAsync`; the database module owns pool and Drizzle setup.

**Why:** New nested settings require a schema and environment entry without another hand-written mapping. The database module receives only its own configuration shape, while the composition root owns the application-wide config.

**Trade-offs:** Environment names now use the nested `__` form, such as `postgres__url` and `logger__level`. Existing deployments using `DATABASE_URL` or `LOG_LEVEL` must rename those variables. Drizzle's pool remains lazy, so startup checks configuration and provider wiring but does not test database availability.

---

Status: design agreed on 2026-09-30, before implementation. Items marked **(verify)** are assumptions about pg-boss that the implementation must confirm. If one turns out wrong, this file is updated in the same commit as the code.

## Delivery Guarantee: Effectively-Once Processing

**Approach chosen:** At-least-once delivery, plus state changes fenced by a lease token, plus idempotent side effects. Together these give effectively-once processing.
**Why:** Exactly-once _delivery_ is impossible over a network. Suppose a worker sends an email and crashes before it acknowledges the job. The system cannot tell "sent" from "not sent", so it must either risk sending twice or risk never sending. We choose "never lose a job" and make a second run harmless:

- **Delivery:** pg-boss never loses a job, but may deliver it more than once.
- **State changes:** every write a worker makes checks `WHERE lease_token = <mine>`. A stale worker cannot overwrite the result of a newer attempt.
- **Side effects:** each external call carries a stable key (the job id), so repeating it does nothing.

**Trade-offs:** One window remains: a handler whose side effect is _not_ idempotent repeats that effect if the worker crashes after the effect and before its commit. The simulated webhook has this window; the fake email provider does not.

---

## 1. Job Pickup Strategy

**Approach chosen:** pg-boss claims jobs with `SELECT … FOR UPDATE SKIP LOCKED`, which guarantees one active delivery per job. The worker then claims the job row in our own table with a guarded update:

```sql
UPDATE jobs
SET status = 'processing', attempt = attempt + 1,
    lease_token = gen_random_uuid(), started_at = now()
WHERE id = $1 AND status IN ('queued', 'processing')
RETURNING *;
```

If no row comes back, the job was cancelled or has already finished. The delivery is then acknowledged without running the handler. If the row was already `processing`, the previous attempt was lost, and the worker writes a `warning` log line.

**Why:** `SKIP LOCKED` lets many workers poll the same table without blocking each other or taking the same row. The guarded update is a second line of defence. It makes pickup correct even when pg-boss delivers a job that our table has already cancelled or finished (for example, a redelivery after a crash during the completion commit). The lease token is a fencing token: every later write by that worker must match it.

The token is a new UUID on every pickup, not pg-boss's `retryCount`. `boss.retry()` resets `retryCount` to 0, so after a manual retry an old worker could hold a matching attempt number.

**Trade-offs:** Gained: no duplicate processing under concurrency, and no separate lock service. Given up: throughput is limited by PostgreSQL (a few thousand jobs per second), which is well above what this system needs. Polling adds latency, reduced by pg-boss's `LISTEN/NOTIFY` wake-up.

---

## 2. Worker Crash Recovery

**Approach chosen:** pg-boss heartbeats find dead workers, the lease token blocks late writes, and the `jobs-dead` dead-letter queue closes out jobs whose last attempt was a crash.

**Why:** A crashed worker cannot report its own failure, so something outside it must notice. pg-boss already does that with heartbeats. We only add what it lacks: fencing, and a hook that updates our table when it gives up.

**What happens if a worker crashes mid-job:**

1. The worker stops heartbeating. `work()` sends a heartbeat every `heartbeatSeconds / 2`, which is every 5s with `heartbeatSeconds = 10`.
2. After about 10s, pg-boss marks that attempt as failed. **A crash uses up an attempt.** This protects against a poison-pill job, one that OOMs or crashes the worker every time: it stops after `max_attempts` instead of taking down workers forever.
3. **If attempts are left:** pg-boss schedules a retry. Our row still shows `processing` until the next pickup. That pickup sets `attempt + 1` and a new lease token, and logs that the previous attempt was lost.
4. **If it was the last attempt:** pg-boss moves the job to `jobs-dead`. Its handler sets our row to `failed` with code `WORKER_LOST`, guarded by `WHERE status = 'processing'`, so running the handler twice changes nothing.
5. **If the worker was only cut off and comes back:** its writes fail the lease-token check. The whole transaction rolls back, including any pg-boss call inside it. Side effects it already made are not repeated, because they are keyed by job id.

**Related failure modes:**

| Case                                                  | Behavior                                                                                                                                                                                                                                                                                                                                               |
| ----------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Handler hangs, worker alive                           | The worker's own timeout fires 5s before pg-boss's `expireInSeconds`: 25s for email/webhook, 55s for transit report/batch parent. It aborts the handler through an `AbortSignal`, which every sleep respects. The normal failure path then records `TIMEOUT` in the same transaction, uses an attempt, and retries. pg-boss expiry stays as a backstop |
| SIGTERM (deploy)                                      | The worker stops fetching new jobs and drains for up to 25s (`boss.stop({ graceful: true, timeout: 25000 })`, compose `stop_grace_period: 30s`). pg-boss fails any job still running; that uses an attempt and the job is retried. Our mock jobs take a few seconds, so this rarely happens                                                            |
| Completion commit fails (e.g. DB briefly unreachable) | We give up. pg-boss delivers the job again and the handler runs again, which is safe because side effects are idempotent and the lease token rejects stale writes. Cost: duplicate work                                                                                                                                                                |
| Crash during the completion commit                    | The transaction rolls back and pg-boss redelivers. If the commit did land, the pickup guard sees a finished row and does nothing                                                                                                                                                                                                                       |
| Crash during batch fan-out                            | Fan-out is one transaction. It rolls back fully, and the re-run is idempotent (see Batch Jobs)                                                                                                                                                                                                                                                         |

**Known lag:** between a crash and the next pickup, the row shows `processing` even though no worker holds the job. We accept this rather than add a reconciler process. The status corrects itself on the next pickup, or through `jobs-dead`.

---

## 3. Priority Queue Implementation

**Approach chosen:** One pg-boss queue (`jobs`) for all job types, with pg-boss's integer `priority` (higher = more urgent). Within a priority, older jobs go first. Batch children inherit the parent's priority, and so do `batch-progress` jobs.

**Why:** A single queue makes priority apply across all job types, which is what the spec asks for ("higher = more urgent"). pg-boss orders fetches by priority inside the same `SKIP LOCKED` query, so priority costs no extra machinery.

**Trade-offs:** A large batch at priority 0 delays later priority-0 jobs until its children drain. It never delays higher-priority jobs, and the client controls that with priority. Per-type queues would isolate job types from each other, but priority could not be compared across them. We rejected per-batch concurrency limits (pg-boss groups) as more than the MVP needs.

---

## 4. Retry Backoff Strategy

**Approach chosen:** pg-boss's built-in exponential backoff with jitter, configured per job type from the type registry on every `send`: `retryLimit = max_attempts - 1`, `retryDelay = 5`, `retryBackoff = true`, `retryDelayMax = 300`.

- **Every error is retried**, up to `max_attempts`. There is no "permanent error" class. Bad input is rejected with 400 at submit instead, so it never reaches a worker. That includes validating the payload with zod, and checking that both IATA codes of a transit report (or of every transit item in a batch) exist in `airports`.
- Handler errors, timeouts, and crashes all go through the same retry path. On a handled error, the worker sets our row back to `queued` with `run_at` set to the retry time pg-boss computed, and writes a log line.
- Clients cannot set `max_attempts`: 3 by default, 5 for webhook, 10 for `batch-progress`.

**Timing:** pg-boss computes `retryDelay + 2^n/2 · (1 + random)` seconds, where n is the attempt count plus one, capped at `retryDelayMax` **(verify against the installed version)**:

| Retry | Delay   |
| ----- | ------- |
| 1st   | ~7–9s   |
| 2nd   | ~9–13s  |
| 3rd   | ~13–21s |
| 4th   | ~21–37s |
| cap   | 300s    |

The short base delay is on purpose, so a reviewer can watch retries happen during a demo. Production settings would be about 30s base and a 1h cap.

Whether pg-boss applies this backoff to crash retries, or retries them at once, is **(verify)**. Its docs describe both.

**Manual retry** (`POST /jobs/:id/retry`, only for `failed` jobs): one transaction sets the row to `queued`, resets `attempt` to 0, clears the error, writes a log line, and makes a **new** `boss.send`. It does not use `boss.retry()`, so it keeps working after pg-boss deletes old job rows.

---

## 5. Scheduled Jobs

**Approach chosen:** The client sends an optional `runAt`, which becomes pg-boss `startAfter` and our `run_at`. A missing `runAt`, or one in the past, means "now". `scheduled` and `pending` are **not stored**: we store one `queued` status and work out which label to show when reading:

- `queued` and `run_at > now()` → `scheduled`
- `queued` and `run_at <= now()` → `pending`

List filters and health counts use the same rule.

**Why:** The change from scheduled to pending depends only on time, and no code of ours runs at that moment. Storing it would mean a cron job racing the clock and lagging behind it. Working it out on read is exact and needs no extra process. A job waiting for a retry is `queued` with a future `run_at`, so it shows as `scheduled`.

---

## 6. Idempotency

There are three layers:

1. **Submit.** The `Idempotency-Key` header is optional and globally unique (partial unique index). We store `request_hash` over type, payload, priority, and runAt.
   - Same key, same request → 200 with the existing job.
   - Same key, different request → 409 `IDEMPOTENCY_KEY_REUSED`.
   - New job → 201.

   The insert uses `INSERT … ON CONFLICT DO NOTHING RETURNING`, then selects the existing row if nothing was inserted. Two concurrent submits with the same key therefore create exactly one job. Keys never expire. We based this on Stripe's model.

2. **Batch children.** `(parent_id, child_index)` is unique, so a batch parent that runs twice cannot create duplicate children.
3. **Side effects.** The fake email provider stores sent messages in `provider_emails`, keyed by job id, in **its own transaction**, the way a real external API would. Calling it again with the same key returns the same `messageId` without sending twice.

**Trade-offs:** Jobs are protected by JWT but not scoped per user, so keys are global. In production the key would be unique per `(owner_id, key)`, and keys would expire.

---

## 7. Queue Technology

**Approach chosen:** pg-boss 12 on the same PostgreSQL database that stores job state. There is no Redis and no separate broker.

**Why:** Job state must live in PostgreSQL anyway. Putting the queue in the same database lets every enqueue, complete, fail, and cancel run in **one transaction** with our table writes (pg-boss's `{ db }` option), so there is never a separate write to a second system that could fail on its own. pg-boss also provides `SKIP LOCKED` pickup, priority, `startAfter`, backoff, heartbeats, expiry, and dead-letter queues out of the box.

**Alternatives rejected:**

- **Our own `SKIP LOCKED` queue:** it would show every mechanism by hand, but it would rebuild what a mature library already does (the repo principle is library-first).
- **BullMQ + Redis:** job state would live in two systems. A DB insert can commit while the Redis add fails, or the other way round, which needs a transactional outbox and reconciliation. Redis would also need AOF persistence and `noeviction` to be durable.
- **RabbitMQ / SQS / Kafka:** poor fit for priority plus scheduling plus per-job status queries.

**Trade-offs:** PostgreSQL limits throughput, and our design depends on pg-boss's behavior (the **(verify)** items).

---

## 8. Data Model

**Approach chosen:** A base table plus one detail table per job type.

- `jobs` holds the lifecycle columns: id, type, status (`queued | processing | completed | failed | cancelled`), priority, attempt, max_attempts, run_at, created/started/finished_at, progress, error (jsonb), idempotency_key, request_hash, parent_id, child_index, lease_token.
- `email_jobs`, `webhook_jobs`, `transit_report_jobs`, and `batch_jobs` hold typed payload and result columns. Each one's `job_id` is its primary key and references `jobs`.
- `job_logs` (job_id, level `info | warning | error`, message, metadata, created_at) gets a row **in the same transaction** as every status change. Handlers may add their own rows.
- `airports` (seeded, about 50 major airports from OurAirports, public domain) and `provider_emails` (the fake provider).

**Why:** Listing and filtering across all types is a single query on `jobs`, while each type keeps real columns and constraints instead of untyped JSON. **Our tables own job status. pg-boss only delivers jobs, locks them, and times retries**, and its job data is just `{ jobId }`. The API never reads pg-boss's internal tables, which are partitioned, pruned after 7 days by default, and change between major versions. Code keeps a registry mapping each type to its zod schema, handler, and defaults.

**Trade-offs:** Adding a job type needs a migration. Status exists in two places (ours and pg-boss's), kept in step by shared transactions and the dead-letter handler, with the crash lag described above.

---

## 9. Batch Jobs

**Approach chosen:** Parent/child fan-out, with progress reported through an outbox.

- **Payload.** `{ childType: 'email' | 'webhook' | 'transit-report', items: [...] }` with 1–1000 items, each validated against the child type's schema at submit. Batches cannot contain batches. A batch can be scheduled.
- **Fan-out.** The parent's handler inserts every child row and its pg-boss send in **one transaction** (`ON CONFLICT (parent_id, child_index) DO NOTHING`). After fan-out, the parent's pg-boss delivery completes but the parent row stays `processing`. Duplicate items in the list are kept as intentional (child key = index, not content).
- **Progress.** When a child reaches a final status (completed or failed), its transaction sends a `batch-progress` job, which is a transactional outbox. That job:
  1. locks the parent row with `SELECT … FOR UPDATE`
  2. counts the children by status in a **new statement**, which under READ COMMITTED sees everything committed before the lock was granted
  3. writes the counts and the progress percentage

  Recounting is idempotent and repairs itself: running it twice, or running it for the wrong child, still gives correct numbers. Incrementing a counter instead would double-count on redelivery.

- **Completion.** When every child has finished, `batch-progress` sets the parent to `completed` with the summary `{ total, succeeded, failed, cancelled, failedJobIds }`, **even if some children failed**. The lock plus the `WHERE status = 'processing'` guard make the parent complete exactly once.
- **Lost progress.** `batch-progress` has `retryLimit` 10, so about 30 minutes of attempts. If it still dead-letters, the parent becomes `failed` with `PROGRESS_LOST`. Manual retry on that parent re-queues its failed children and sends a fresh recount.
- **Retry.** Retrying a batch parent re-queues only the failed children and sets the parent back to `processing`.

**Why:** "Send an email to 1000 users" is really 1000 independent jobs of the same kind. Fan-out gives every item its own retries, parallel execution across workers, and effectively-once processing, all from the existing queue. We rejected a single job looping over items, because a crash at item 700 would resend items 1–699 unless checkpointed. We rejected having each child update the parent directly, because that would put all children in contention on the parent's row lock inside their own transactions.

**Trade-offs:** The parent's status and progress lag behind its children by one queue hop. There are N extra `batch-progress` jobs per batch. There is a hard cap of 1000 items; beyond that we would need chunked fan-out with resume logic.

---

## 10. Cancellation

- Cancelling a `queued` job (shown as scheduled or pending) sets `cancelled` and calls `boss.cancel` in one transaction. Cancelling a `processing` non-batch job, or a finished job, returns 409.
- Cancelling a batch (queued or processing) locks the parent and then cancels the parent plus every `queued` child. Children already running finish normally and are counted. The parent ends as `cancelled` with a partial summary, and later `batch-progress` jobs update its counts but not its status.
- Cancel racing with pickup is safe: pickup only succeeds while the row is `queued` or `processing`, so a cancelled child never runs. Handlers are never aborted mid-run on cancel, because a mock side effect may already have happened.

---

## 11. Job Types

| Type                    | Behavior                                                                                                                                                                                                                                                                                                                                                    |
| ----------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Email                   | Sleeps 1–3s, then calls `FakeEmailProvider.send(idempotencyKey = job id)` and returns the provider's `messageId`                                                                                                                                                                                                                                            |
| Webhook                 | Sleeps 1–2s; 20% of calls throw a retryable error before any side effect. The random source and clock are injected so tests are deterministic                                                                                                                                                                                                               |
| Aircraft transit report | Takes origin and destination IATA codes and a departure date, looked up in the seeded `airports` table. Returns the airports' coordinates, a great-circle path as a GeoJSON LineString (`@turf/great-circle`), distance, flight time, arrival time, and a mock aircraft (registration, type, speed). No external API: reproducible, no keys, no rate limits |
| Batch                   | See Batch Jobs                                                                                                                                                                                                                                                                                                                                              |

---

## 12. API

- `POST /jobs/email`, `/jobs/webhook`, `/jobs/transit-report`, `/jobs/batch`: body `{ payload, priority?, runAt? }` plus an optional `Idempotency-Key` header. There is one route per type, so each route's schema is explicit.
- `GET /jobs?status=&type=&parentId=&limit=&cursor=`: keyset pagination on `(created_at desc, id)`, which stays stable while new jobs arrive and fast on large tables.
- `GET /jobs/:id`: status, payload, result, error, progress, attempts, and timestamps, with **all** logs and children embedded. This is simple for the client, but responses grow with batch size (up to 1000 children).
- `POST /jobs/:id/cancel` and `POST /jobs/:id/retry`.
- `GET /health`: DB ping, job counts by status and type, the age of the oldest pending job (shows whether workers are falling behind), and pg-boss queue size.
- All endpoints require the existing JWT, and responses use the standard `{ ok, data }` / `{ ok, error }` envelope.

---

## 13. Process Topology

The API and workers are the same codebase with two entrypoints: `main.ts` (HTTP) and `worker.ts` (`NestFactory.createApplicationContext`, no HTTP server). compose runs 1 API container and N worker containers, and each worker runs 5 jobs at a time (`localConcurrency`). The workers can be scaled on their own without splitting the monorepo into another package.

---

## Open Items (verify)

- Whether pg-boss 12 `work()` lets our code call `complete`/`fail` inside our own transaction (`{ db }`), or whether the worker needs its own `fetch` loop. If not, success still works (the pickup guard makes a redelivery a no-op), but the failure path must read pg-boss's computed retry time after `fail`.
- Whether pg-boss applies backoff to retries after a lost heartbeat.
- The backoff formula against the installed pg-boss version.

---

## One Thing I Would Do Differently With More Time

Close the crash-visibility gap. Right now a job whose worker died shows `processing` until the next pickup (up to the backoff delay). With more time I would add a lease column renewed by the worker's heartbeat, and show "recovering" when it expires. That would make crash recovery visible in the API and UI instead of only in the logs.

Other deliberate simplifications:

- Every error is retried, even ones that can never succeed. Bad input is rejected at submit instead of having a permanent-error class.
- Jobs and idempotency keys are not scoped per user, and keys never expire.
- The job detail endpoint embeds every log and child without limits.
- There is a hard 1000-item batch cap instead of chunked fan-out.
- Running handlers are not aborted on cancel.
- The web UI (map, live updates) is not designed yet.
