# Facts

- POST /api/jobs/email accepts a client-supplied UUID idempotency key, a type of instant or schedule, an email payload validated by the existing email Zod schema, and startAt when type is schedule; it returns HTTP 202 with the job ID and effective start time.
- POST /api/jobs/email requires an integer priority from 1 through 5, persists it with the job, and passes it to pg-boss so eligible higher-priority email jobs are picked before lower-priority ones; 5 is highest.
- The existing POST /api/emails remains synchronous and keeps its current response behavior.
- An instant email job is eligible immediately; a schedule job is held by pg-boss until its future startAt timestamp. A schedule job without a valid future startAt is rejected.
- A separately started Nest worker uses a reusable pg-boss module and job-handler decorator to consume email jobs, validates each payload, calls SendEmailUseCase, and completes the job only after successful delivery and persistence.
- A valid email job has at most four processing attempts: the first attempt and up to three retries, starting 60 seconds after failure with exponential backoff. Invalid queue payloads fail without retry.
- The application database retains timestamped, ordered activity for job creation, each processing start, each failed attempt, cancellation, successful completion, and final failure, including a safe error category without email body or recipient data.
- GET /api/jobs/:id returns an email job's current status (scheduled, pending, processing, cancelled, completed, or failed), scheduled time, and ordered activity, and returns the API's normal not-found error for an unknown ID.
- DELETE /api/jobs/:id cancels a scheduled or pending job and records cancellation activity; a processing, completed, failed, or already cancelled job cannot be cancelled, and an unknown ID returns the API's normal not-found error.
- The client-supplied idempotency key must be a UUID and is unique in the jobs table; a malformed key is rejected by HTTP validation. Any repeated key returns HTTP 409 Conflict, even for an identical request; the application does not hash or store the request body.
- Each email job uses a stable delivery idempotency key distinct from the client submission key. Repeating delivery for the same job after a worker retry or crash cannot produce a second mock delivery or sent-email record; future real email clients must honor the same delivery key.
- The API and worker run as separate Nest applications. `pnpm setup` applies Drizzle migrations and then creates or upgrades the pg-boss schema before either starts; the worker has a documented start command and gracefully closes its pg-boss connection on shutdown.
- The new API, worker, queue integration, and database schema follow repository ownership rules, include automated tests for accepted behavior, and pass pnpm check.
- A completed queued email job stores `{ "emailId": "..." }` in its `jobs.result` column, and GET /api/jobs/:id returns that result so the sent email can be identified. Synchronous email sends have no job.
- The worker logs job pickup and each attempt outcome with queue name, job ID, and attempt number, without logging email recipient, subject, or body.
