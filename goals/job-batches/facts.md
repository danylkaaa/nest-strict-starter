# Job batches: accepted behavior

## Submission and schedule

- A batch creates 1–100 new child jobs, ordered as submitted. Each child is an email, webhook, or aircraft report job; nested batches and references to existing jobs are rejected.
- One batch-level UUID idempotency key, priority, maximum attempt count, and instant or future schedule apply to every child. A duplicate batch key returns 409 with the existing batch ID. A key is unique among batches; standalone job keys keep their existing namespace.
- All payloads and the shared schedule are validated before writes. An invalid child reports its 1-based position. Creation of the batch, all `jobs` rows and activity, and every pg-boss enqueue is atomic; no subset remains if any enqueue fails.
- A scheduled batch makes all children eligible at the same `startAt`. It needs no parent pg-boss job or batch worker. Existing queue workers consume the children with their normal retry and delivery behavior.

## Progress and status

- The batch detail returns child IDs, positions, queue types, effective statuses, and results in submission order, plus counts for each child status. Progress is `round(100 × (completed + failed + cancelled) / total)`; a processing child does not count as finished.
- A batch is `scheduled` before its future start, `pending` when eligible but no child has started, and `processing` after work begins while any child remains nonterminal. When all children are terminal it is `completed` if all succeeded, or `completed_with_errors` if any failed or was individually cancelled.
- A cancellation request makes a batch `cancelling` while any child is still active and `cancelled` once every child is terminal. This final status takes precedence over the mix of child outcomes; the counts and individual results remain visible.
- Batch status and progress are derived from the persisted child rows at read time. Cancellation intent and creation time are stored on the batch; no mutable progress counter is stored.

## Cancellation and access

- Cancelling a batch atomically records the request and cancels all scheduled, pending, or retry-waiting children that have not been claimed. A child already processing may complete or fail. If pg-boss automatically retries it after a crash or expiry, the next claim fails terminally before any business side effect.
- A second cancellation request returns the current batch without adding events or changing child outcomes. An unknown batch returns 404. A fully completed or failed batch that was never cancelled returns 409.
- The existing single-job cancel and manual retry endpoints return 409 for a batch child. A child remains readable through `GET /api/jobs/:id`; batch creation and cancellation do not erase its activity or result.
- The top-level jobs list shows standalone jobs, while the batch list shows parents. Children appear within batch detail and by direct job ID, avoiding duplicate top-level entries. Existing job stats and health counts continue to count execution jobs, including children, and do not count batch parents.

## Verification

- Tests cover mixed child types, scheduled eligibility, invalid child rejection, duplicate submission, atomic rollback, ordered progress, mixed outcomes, cancellation races with worker pickup and failure, repeat cancellation, and blocked child actions.
- The backend, database, and web changes pass `pnpm check`; database integration tests pass against a migrated and seeded disposable database. The web app uses the real batch endpoints instead of the in-browser batch mock.
