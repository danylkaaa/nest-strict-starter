# Backend code generation rules

Read this file before changing `apps/backend`. Root monorepo, quality, and Git rules live in `/AGENTS.md`. This file is the source of truth for backend ownership and dependency direction. Use `greeting` as the small service reference and `emails` as the use-case and repository reference for new features.

## Status and map

| Area                     | Owns                                                                                                                                           | Current reference                                           |
| ------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------- |
| `src/api/`               | HTTP application: bootstrap, composition, controllers, HTTP request/response DTOs, validation, authentication, and HTTP error/response mapping | `api/api.module.ts`, `api/endpoints/greeting/`, `api/core/` |
| `src/worker/`            | Queue application: bootstrap, job consumers, queue payload validation, and job result/error mapping                                            | Planned; no implementation yet                              |
| `src/modules/<feature>/` | Business capabilities: use cases, business errors, feature-owned repository ports and adapters, and Nest feature wiring                        | `modules/greeting/` is the current small service example    |
| `src/common/`            | Non-domain infrastructure reusable by the API and worker, such as database connection setup and technical error bases                          | `common/database/`, `common/errors/`                        |

`api/endpoints/<feature>/` always owns HTTP controllers and HTTP DTOs. `modules/<feature>/` owns the corresponding business behavior and errors. There are no feature-specific HTTP controllers or DTOs in `modules/`. A queue consumer belongs to `worker/`, not the feature module.

## Dependency direction

```text
api/ ──────┐
           ├──> modules/ ──> common/
worker/ ───┘       │
   │               └──> another module's public use case
   └─────────────────────> common/
api/ ────────────────────> common/
```

- `api/` and `worker/` may call use cases in `modules/`, import their public input/result/error types, and use infrastructure in `common/`. They do not import each other.
- `modules/` may use `common/`, including database infrastructure, but never imports `api/` or `worker/`. Business rules and errors stay in the owning feature.
- One feature may call another feature's **public use case** and import the types in that use case's interface. Its repository ports, adapters, internal helpers, and Nest providers other than public use cases are private. Nest module imports/exports may wire public use cases for injection. Keep feature dependencies acyclic.
- `common/` is reusable infrastructure, not a home for business rules. It imports neither an application (`api/`, `worker/`) nor a feature module.
- Import local files directly; use the `@/` alias across directories and `.js` extensions where NodeNext resolution requires them.

These ownership and direction rules are currently **conventions**: the old dependency-cruiser configuration was removed during the refactor, and no replacement boundary check exists yet. Do not describe them as machine-enforced or weaken lint rules to accommodate a violation.

## Use cases and feature ownership

**Pattern for new work:** create one public use-case class per user or job action, named `<Action>UseCase`, with one `execute(input)` method. The input and output are plain business/application types, not HTTP DTOs or queue messages. Return a `Result` for expected failures. For example, `CreateOrderUseCase.execute(...)` belongs in `modules/order/use-case/`; an HTTP controller and a queue consumer may both invoke it.

- Keep the action's business sequence in its use case. Controllers adapt HTTP input/output; consumers adapt queue input/output. Neither application duplicates business decisions.
- A feature that persists data declares its repository port and owns its Drizzle adapter **inside that feature**. `common/database/` supplies the reusable connection and transaction machinery, not feature queries.
- Feature use cases may use Nest injection and scoped `PinoLogger`, as the current `GreetingService` does. Inject dependencies rather than creating database clients inside a use case.
- A use case may call another feature's public use case when one business action requires it. Wire the public class through Nest modules and keep the dependency one-way.
- Put every feature use-case class in `src/modules/<feature>/use-case/` so application actions have a predictable location. Reference: `modules/emails/use-case/send-email.use-case.ts` and `modules/emails/use-case/list-sent-emails.use-case.ts`. This is a convention; no machine check enforces it yet.
- Add other folders inside a feature only when needed. Ports and adapters stay beside the feature they serve; tests sit next to their source files.

`modules/greeting/greeting.service.ts` predates the one-class-per-action rule. It demonstrates `Result` behavior and Nest injection; its name and multi-method service style are not templates for new use cases. The email feature implements this pattern: `modules/emails/use-case/send-email.use-case.ts` and `modules/emails/use-case/list-sent-emails.use-case.ts` own actions, `email.repository.ts` declares the repository port, and `drizzle-email.repository.ts` owns persistence and ID cursor queries. Ports use abstract classes as Nest injection tokens; adapters stay private to the feature module. `email-client.ts` keeps delivery replaceable, with `mock-email.client.ts` simulating a successful send after 1–3 seconds. These ownership rules are conventions, not machine-enforced. Queue examples are still planned.

The email list uses descending `eml_<ULID>` IDs, an exclusive ID cursor, and one extra row to determine `nextCursor`. HTTP page limits are 1–100 (default 20). `api/endpoints/emails/` owns validation and date serialization. The send action persists only after successful delivery; delivery and insertion cannot share a database transaction, so a persistence failure after delivery may require reconciliation when a real provider is introduced. Email content is not logged by feature code. The repository replaces database query exceptions with generic technical errors because Drizzle error messages can include email parameters and the HTTP filter logs unexpected errors.

## Results and errors

- A use case returns `neverthrow` `Result<Success, FeatureError>` for expected business failures. Define each expected error as a class in the owning feature (see `modules/greeting/greeting.errors.ts`). Unexpected defects may throw and are handled by the application entry point.
- The HTTP controller maps a feature error to an HTTP exception at `api/endpoints/<feature>/`; `api/core/errors/to-http-exception.ts` is the current mapping helper. The API's global envelope lives in `api/core/response-envelope/`.
- A worker consumer maps the same feature error to the job's retry, failure, or completion behavior in `worker/`. Queue semantics belong to the worker, not the use case.
- Do not put HTTP status codes, Nest HTTP exceptions, or queue retry decisions in use-case results.

## HTTP DTOs and validation

- Define HTTP request and response schemas with Zod and classes with `nestjs-zod` in `api/endpoints/<feature>/dtos/`. See `api/endpoints/greeting/dtos/`.
- Type decorated controller parameters with the **runtime DTO class**. Nest needs that class in decorator metadata for the global `ZodValidationPipe` in `api/core/validation/validation.module.ts`; a type-only import erases it.
- The controller passes plain values to a use case, then creates a response DTO from its result. Zod validates transport shape and format; the feature use case decides business rules.
- HTTP validation failures are mapped by `api/core/response-envelope/` to the API error envelope. Worker payload validation belongs in `worker/` when that application is implemented.

## Swagger documentation

- Document every HTTP endpoint with tags, an operation summary, validated request/query schemas, and success/error envelopes. Use `api/core/swagger/api-envelope-response.ts` with the response Zod DTO’s `.Output` schema so Swagger describes the global envelope rather than the controller’s `Result` wrapper. Reference: `api/endpoints/emails/emails.controller.ts` and `api/endpoints/greeting/greeting.controller.ts`. Coverage is a convention; no machine check enforces it yet.
- Configure Swagger in `api/core/swagger/swagger.config.ts`, called by `api/main.ts` after the global prefix is set. Run `cleanupOpenApiDoc` after `SwaggerModule.createDocument` for correct Zod schemas. Swagger UI is `/api/docs` and its JSON document is `/api/docs-json`.

## Keeping this guide current

When a change implements a planned pattern or changes one of these seams, update this file in the same change: state the rule, why it exists, its reference implementation, and whether tooling enforces it. Update `/DECISIONS.md` when the choice or trade-off changes. Keep root `AGENTS.md` for cross-package rules only.
