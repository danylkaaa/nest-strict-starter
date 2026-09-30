# Design Decisions

## Email delivery and persistence

**Approach chosen:** An email use case calls a mock client, waits for its simulated delivery result, then stores the sent message in PostgreSQL. The mock waits 1–3 seconds and returns a unique message ID. Only successful sends are stored.

**Why:** This gives the email feature a working delivery boundary and durable sent-mail history without introducing the job queue before its concurrency rules are designed.

**Trade-offs:** Sending is synchronous for now. Delivery and database insertion cannot be atomic: if insertion fails after the mock reports success, a later retry could deliver twice. A real provider will need reconciliation or idempotency at this seam.

**Rejected for this slice:** A queue worker and provider-specific client, because neither is needed to demonstrate the email domain yet.

## Webhook simulation

**Approach chosen:** A webhook use case calls a replaceable mock client with a URL and JSON payload. The client waits 1–2 seconds, then returns a stable receipt shape with random values on success or a feature-owned `WebhookDeliveryFailedError` in a `Result` on 10% of calls. It makes no network request.

**Why:** The module can be called by a future worker, while the expected simulated failure remains separate from defects and can later drive retry behavior. The user's 10% failure requirement supersedes the 20% in `docs/task.md`.

**Trade-offs:** Outcomes are intentionally random, and the module does not yet expose an HTTP endpoint or decide retries. The first worker integration will need to map the error to job retry and failure states.

**Rejected for this slice:** Real outbound requests and retry logic inside the feature, because the job queue and its policies are still to be designed.

## Webhook call history

**Approach chosen:** Store one `webhook_calls` row for every completed call, whether it succeeded or failed. Each row has a `whc_<ULID>` ID, a required indexed `job_id`, an outcome, the successful receipt fields or the expected error name and message, and a record timestamp. A lookup by job ID returns attempts newest first.

**Why:** A job may retry a webhook; retaining each attempt makes later inspection possible without overwriting previous outcomes. The current project has no jobs table, so `job_id` is a logical reference rather than a foreign key.

**Trade-offs:** Until the jobs table exists, PostgreSQL cannot enforce that a referenced job exists. The current receipt is stored as columns, so a future real provider with a different response shape may need a migration. The database checks that success and failure fields are mutually consistent.

**Rejected:** One row per job, because retries would overwrite history; a speculative jobs table, because its lifecycle and queue ownership remain undecided.

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

## Job queue decisions to verify

Job pickup, crash recovery, retry backoff, priority, scheduling, and idempotency remain open for the broader task in `docs/task.md`. The email slice does not decide those policies.
