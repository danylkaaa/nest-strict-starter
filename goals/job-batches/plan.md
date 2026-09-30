# Plan: persistent job batches

Implement [accepted behavior](facts.md) using the existing jobs feature and workers. This is a plan only; it does not authorize a database reset or schema rewrite. Preserve unrelated working-tree changes.

## 1. Persist the relationship

- In `packages/database/src/schema.ts`, add `job_batches` with UUID `id`, unique UUID `idempotency_key`, shared `start_at`, nullable `cancellation_requested_at`, and `created_at`. Add nullable `jobs.batch_id` (FK) and `jobs.batch_position`; enforce that both are present together, position is nonnegative, and `(batch_id, batch_position)` is unique. A job can belong to one batch. Keep existing jobs valid with both columns null.
- Generate and review an **additive** Drizzle migration, retaining existing migration history and data. Index the child lookup by batch and position. Do not add a pg-boss queue or parent job row.
- Update `packages/database/AGENTS.md` and `DECISIONS.md` with the new relationship, derived progress, and why the parent is not queued.

## 2. Create and read batches in the jobs module

- Add `CreateJobBatchUseCase`, `GetJobBatchUseCase`, `ListJobBatchesUseCase`, and `CancelJobBatchUseCase` under `apps/backend/src/modules/jobs/use-case/`. Keep business sequencing and status rules in the use cases or a private jobs module helper; extend the feature repository port and Drizzle adapter for batch persistence and transactional queue operations. Export only public use cases from `JobsModule`.
- `CreateJobBatchUseCase` checks the batch idempotency key first, then validates the schedule and every typed child. Reuse the existing feature validation behavior, including aircraft request validation, without calling child create use cases that commit independently. Return the failing child's 1-based position. The repository takes one transaction and advisory lock for the batch key, inserts parent and children in submitted order, appends each `created` activity event, and enqueues each child via pg-boss's transaction bridge. Generate internal child idempotency UUIDs; the client supplies only the batch key. A duplicate race returns the existing batch ID.
- Read child `JobSummary` rows in position order and compute the batch status/counts/progress from one consistent database snapshot. Reuse the existing effective-status expression for scheduled/retry-waiting children. Do not write a status or progress counter on reads. Return children with IDs, queues, results, and links to their existing detail route; do not duplicate results on the parent.
- Add focused specs for validation order, key conflicts, status derivation, zero/partial/full progress, and repository transaction rollback. Keep Drizzle and pg-boss calls inside the repository adapter.

## 3. Make cancellation safe against worker pickup and retry

- In one transaction, lock the batch row, then lock child application and pg-boss rows in deterministic order. Set `cancellation_requested_at` once. Use the existing `cancelJob` queue behavior for `created` and `retry` children and append one `cancelled` activity event per cancelled child. Leave active and terminal outcomes intact.
- Prevent an active child from being retried after cancellation: while holding its queue row lock, lower its remaining retry allowance to the current attempt, and make the application terminal decision agree. Check the installed pg-boss failure SQL before implementing this step. If failure already settled into `retry`, cancel that row in the same transaction. Test all orderings: cancel before pickup, pickup before cancel, failure before cancel, and failure while cancellation is committing.
- Make repeated batch cancellation idempotent. Reject direct single-job cancel and manual retry for any batch child. Preserve direct `GET /api/jobs/:id` and the child activity history.
- Integration tests must prove no unstarted child runs after cancellation and no active child gets another attempt. Do not rely on a periodic cleanup pass to close the race.

## 4. Expose the API and connect the web UI

- Add Zod DTOs, Swagger documentation, and standard envelopes under `apps/backend/src/api/endpoints/job-batches/`: `POST /api/job-batches` (202), `GET /api/job-batches` (paged, newest first), `GET /api/job-batches/:id`, and `DELETE /api/job-batches/:id`. Use the request shape `{ idempotencyKey, type, startAt?, priority, maxAttempts, items: [{ type, payload }] }`, with child types `email`, `webhook`, and `aircraft-report`. `POST` returns batch ID and schedule; detail returns ordered children, counts, progress, and derived status. Map duplicate key to 409 with `existingBatchId`, invalid child to 400 with its position, unknown ID to 404, and cancellation of an already terminal batch to 409.
- Exclude batch children from the default `GET /api/jobs` top-level list, while retaining direct child lookup and execution-job stats. Document this visible list change. The separate batch list supplies parent rows for the web client's mixed jobs view.
- In `apps/web/src/api/client.ts`, replace mock batch routing with the real endpoints and merge batch parents with standalone jobs by creation time. Map batch children to the existing progress/task display, adding visible cancelled and cancelling states. Update the submit form mapping (`transit` → `aircraft-report`, ICAO and aircraft ID as for standalone jobs), detail page, action rules, filters, and query invalidation. Remove only batch-specific mock paths after the real route works; preserve unrelated mocks until their replacements are in scope.
- Add API/unit specs for each response and error and web tests for request mapping, list merge/pagination, status display, cancellation, and a batch surviving full page reload. Check the UI manually with a scheduled mixed batch.

## 5. Verify and document

- Run `pnpm check`, then `pnpm --filter backend test:integration` against a migrated, seeded disposable PostgreSQL database with other workers stopped. Cover mixed queue completion, failure after retries, immediate and scheduled cancellation, queue pickup races, and no partial batch after failed enqueue.
- Update `apps/backend/AGENTS.md`, `apps/web/AGENTS.md`, `packages/database/AGENTS.md`, `README.md`, and `DECISIONS.md` in the same change as the code. Document the distinction between batch-parent status and child job status, the 1–100 limit, and how stats count child jobs.
- Use the repository's `implement-plan` agent/reviewer loop for backend work. Review the migration and the web integration as separate steps; finish only when the behavior in `facts.md` is covered and the full quality gate is green.
