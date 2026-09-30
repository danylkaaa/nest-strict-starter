# Goal: queued email jobs with pg-boss

Add a separate Nest worker under `apps/backend/src/worker/` that processes pg-boss email jobs with scheduling, priority, retries, durable status and activity, visible worker logs, cancellation, and separate submission and delivery idempotency keys. Expose job creation, status, cancellation, and the sent email ID as a completed job result through the API while preserving the current synchronous email endpoint.

The shared, approved requirements are in [facts.md](./facts.md). The approved execution sequence and verification checks are in [plan.md](./plan.md).

**Done when:** Every accepted fact has its selected automated verification, the API and worker complete the documented end-to-end flow against migrated PostgreSQL, and `pnpm check` passes.
