# apps/api — NestJS API

NestJS API using DDD-style modules. Read the whole file before writing code here. Root rules (monorepo, tooling, git) are in `/AGENTS.md`.

## Pattern Index

Where each pattern lives in code. Copy the reference implementation instead of inventing a variant.

| Pattern                                               | Reference implementation                                               | Section                  |
| ----------------------------------------------------- | ---------------------------------------------------------------------- | ------------------------ |
| Module layout, layers                                 | `src/modules/greeting/`                                                | Directory Layout         |
| Boundary rules                                        | `.dependency-cruiser.mjs`                                              | Dependency Direction     |
| Business error classes                                | `greeting/domain/greeting.errors.ts`, `src/app/base/business-error.ts` | Error Handling           |
| Result-returning domain logic                         | `greeting/domain/greeting.ts`                                          | Error Handling           |
| HTTP error classes                                    | `src/app/http/http-errors.ts`                                          | Error Handling           |
| Business error → HTTP error, `Result<Dto, HttpError>` | `greeting/presentation/greeting.controller.ts`                         | Error Handling           |
| Response DTO                                          | `greeting/presentation/greeting-response.dto.ts`                       | Error Handling           |
| Response envelope                                     | `src/app/http/`                                                        | Response Envelope        |
| Envelope integration test                             | `src/app.module.spec.ts`                                               | Response Envelope        |
| Lint exceptions for Nest                              | `oxlint.config.ts`                                                     | Nest-Specific Lint Notes |

Rules marked **[enforced]** are checked by `pnpm --filter api deps` (dependency-cruiser, `apps/api/.dependency-cruiser.mjs`) or oxlint. Rules marked **[convention]** are not machine-checked; follow them anyway.

## Directory Layout

```
apps/api/src/
├── main.ts / app.module.ts
├── app/              # Framework wiring: http/ (response envelope), config, logger, base classes
├── modules/<ctx>/    # Business contexts (one folder per bounded context)
│   ├── <ctx>.module.ts
│   ├── domain/           # Pure business logic; aggregates, value objects, events/
│   ├── application/      # ports/ (interfaces + Symbol tokens), services/
│   ├── infrastructure/   # repositories/, adapters/ (implement ports)
│   └── presentation/     # controllers, DTOs
└── shared-kernel/    # Pure cross-context contracts
```

Create a layer folder only when the module needs it (see Progressive Layering). Never add empty layers.

## Vertical Structure (Modules)

The app is split **vertically by business capability**, not horizontally by technical layer. A module owns everything for its capability, from the HTTP endpoint down to persistence.

- One folder per capability under `src/modules/<ctx>/` (kebab-case, singular business noun: `greeting`, `order`, `article`). It contains its own `presentation/`, `application/`, `domain/`, `infrastructure/` and `<ctx>.module.ts`
- **MUST NOT create horizontal top-level folders** such as `src/controllers/`, `src/services/`, `src/dtos/`, `src/repositories/`, `src/entities/`, `src/utils/`, `src/common/`. Everything in `src/` is one of: `main.ts`, `app.module.ts`, `app/` (wiring), `modules/`, `shared-kernel/`
- **A feature change touches one module.** Adding "refunds" means adding or editing `modules/order/` (or a new `modules/refund/`), not a file in every layer folder of the app. If a change needs edits in three modules, the boundaries are probably wrong: stop and ask
- Each module is registered exactly once, in `AppModule.imports`. Nothing else imports a `*.module.ts` of a module
- A module exposes only two things to other modules: **ports** (`application/ports/`) and **domain events** (`domain/events/`). Everything else is private (enforced by `no-cross-module`)
- Tests, DTOs, errors, and mappers live inside the module that owns them, next to the code (`foo.ts` + `foo.spec.ts`)
- **New module vs extend**: create a new module when the capability has its own vocabulary, data, and rules that other modules would consume through a contract. Extend an existing module when the code shares its aggregate or data. Unsure → ask
- **Sharing**: do not extract shared code up front. Copy small helpers per module; promote to `shared-kernel/` when the second consumer appears (see shared-kernel Admission). `app/` is wiring, never a home for business helpers
- Layers inside a module still follow Progressive Layering: start thin, add a layer on a signal. Vertical structure never means "create all four folders for every module"

When stuck: about to put a file in a folder named after a technical role at the `src/` level → put it in the owning module instead.

## Dependency Direction

- **[enforced]** No import cycles anywhere (`no-circular`, `import/no-cycle`)
- **[enforced]** `app/` MUST NOT import `modules/`
- **[enforced]** `shared-kernel/` MUST NOT import `modules/`
- **[enforced]** A module MUST NOT import another module, except its `domain/events/` and `application/ports/`
- **[enforced]** `domain/` MUST NOT import npm packages (no `@nestjs/*`, ORMs, loggers, crypto libs). Exempt: test files and `neverthrow`
- **[enforced]** `presentation/` MUST NOT import database packages (`@workspace/database`, `drizzle-orm`, `pg`, `postgres`); go through application services
- **[enforced]** `application/services/` MUST NOT runtime-import `@workspace/database`; type-only imports are allowed
- **[enforced]** `modules/` MAY import only `app/base/` and `app/http/`; all other `app/` code is wiring (`modules-app-allowlist`)
- **[enforced]** `domain/`, `application/`, `infrastructure/` MUST NOT import `app/http/`; HTTP errors belong to `presentation/` (`http-errors-presentation-only`)
- **[convention]** Use the `@/` alias for cross-directory imports; `../` imports are banned by lint. Same-directory `./x.js` is fine
- Imports of local files use the `.js` extension (NodeNext resolution)

## Domain Purity

- Domain code is plain TypeScript: no decorators, no framework, no I/O
- Domain tests use vitest and domain classes only; never `Test.createTestingModule`
- Aggregates expose business methods (`pay()`, `cancel()`); no public setters
- Wanting a library in the domain means the logic belongs in application or infrastructure

## Error Handling (neverthrow + error classes)

Expected failures are values, not exceptions: `Result` / `ResultAsync` from `neverthrow`. **Every error is a class** extending one of two bases; never use strings, plain objects, or bare `Error` as `E`.

| Layer                                        | Error base class                                   | Defined in                     | Carries                         |
| -------------------------------------------- | -------------------------------------------------- | ------------------------------ | ------------------------------- |
| `domain/`, `application/`, `infrastructure/` | `BusinessError` (`src/app/base/business-error.ts`) | `<ctx>/domain/<ctx>.errors.ts` | user-friendly `message`         |
| `presentation/`                              | `HttpError` (`src/app/http/http-errors.ts`)        | `src/app/http/http-errors.ts`  | `statusCode`, `name`, `message` |

**Business errors**

- Extend `BusinessError`, declare a literal `override readonly name = 'XxxError'` (this makes unions of errors exhaustively matchable), and give the constructor a default user-friendly message: `constructor(message = 'Please enter a name.') { super(message) }`
- Omit the constructor to fall back to the generic default (`DEFAULT_BUSINESS_ERROR_MESSAGE`)
- Messages are read by end users: plain English, no internals, no stack details, no IDs they cannot act on
- Export a union per context: `type GreetingError = GreetingNameEmptyError | ...`
- Domain methods, application services, and port methods return `Result<T, XxxError>` / `ResultAsync<T, XxxError>` for expected failures

**HTTP errors**

- Ready-made classes: `BadRequestError` (400), `UnauthorizedError` (401), `ForbiddenError` (403), `NotFoundError` (404), `ConflictError` (409), `UnprocessableEntityError` (422), `InternalServerError` (500). Each has a `statusCode`, a `name` used as the envelope `code` (e.g. `NOT_FOUND`), and a default message
- Add a new status class in `http-errors.ts` only when a status is needed and missing. Extend a status class and override `name` only when clients must distinguish two failures with the same status
- Only `presentation/` creates HTTP errors (enforced)

**Controllers**

- Every controller handler returns `Result<Dto, HttpError>` (or `ResultAsync<Dto, HttpError>`). It never returns a bare value and never throws for an expected failure
- The controller converts inner-layer errors to HTTP errors with `.mapErr(...)`, passing the business error's `message` through so users see the friendly text
- Keep the conversion in a `Record<XxxError['name'], (message: string) => HttpError>` so a new business error fails typecheck until it is mapped
- Reference: `modules/greeting/presentation/greeting.controller.ts`

**Everywhere else**

- **`throw` is only for bugs and unrecoverable states** (broken invariant that "cannot happen", misconfiguration at startup). Anything thrown that is not an `HttpError` is treated as a bug and returned as a generic 500; its details are logged, never sent
- **Wrap third-party throws at the infrastructure boundary**: `ResultAsync.fromPromise(promise, (cause) => new SomeBusinessError(...))` / `Result.fromThrowable(fn, mapError)`, so nothing above infrastructure sees a rejected promise
- **Chain, don't nest**: `map` / `andThen` / `mapErr` / `match`; `safeTry` with `yield*` for 3+ dependent steps. No `try/catch` for control flow in `domain/` or `application/`
- MUST NOT use `_unsafeUnwrap()` / `_unsafeUnwrapErr()` anywhere; in tests assert with `expect(result).toEqual(ok(value))` / `err(new XxxError())`
- MUST NOT ignore a returned `Result`; handle both branches

When stuck: unsure whether a failure is expected or a bug → ask "could a caller do something useful with it?" Yes → return an error class in a `Result`. No → `throw`.

## Response Envelope

Every HTTP response uses one of two shapes; clients switch on `ok`:

```json
{ "ok": true, "data": { "message": "Hello, Ada!" } }
{ "ok": false, "error": { "code": "BAD_REQUEST", "message": "Please enter a name." } }
```

- Implemented once, globally, in `src/app/http/` and registered in `AppModule` via `APP_INTERCEPTOR` / `APP_FILTER`. Do not re-register per module
- `EnvelopeInterceptor` unwraps the controller's `Result`: `Ok` → `{ ok: true, data }` (empty value → `data: null`); `Err` → the `HttpError` is thrown into the pipeline
- `EnvelopeFilter` renders every thrown value: `HttpError` → its `statusCode`, `name` as `code`, and `message`. Controllers never build `{ ok, data }` themselves
- Framework errors are mapped automatically: unknown route → `NOT_FOUND`, validation message list → `VALIDATION_FAILED` (400), any other Nest `HttpException` → its status name, anything else → `INTERNAL_ERROR` (500) with a generic message
- `code` values are stable once released; `message` is human-readable and may change
- `StreamableFile` responses (downloads) skip the envelope. Handlers using `@Res()` bypass it; avoid `@Res()`
- Change envelope behavior only in `app/http/` and cover it with a test in `app.module.spec.ts`

## Cross-Context Communication

Need a return value (sync) → **port**; trigger a side effect (async) → **domain event**.

1. Port interface and its `Symbol('X_TOKEN')` live in the publisher's `application/ports/` (or `shared-kernel/` once a second consumer exists)
2. Consumers inject by token: `@Inject(X_TOKEN)`, and import the interface with `import type`
3. Events are pure data classes in the publisher's `domain/events/`; subscribers use `@OnEvent(XEvent.name)`
4. Constructor injection only; no `@Optional()` or property injection
5. A module exporting tokens for other contexts is `@Global()`
6. MUST NOT use `forwardRef()` or bidirectional event subscriptions; both mean the boundary is wrong. Stop and ask

## External Side Effects Go Through Ports

- Database, cache, HTTP clients, queues, and file system are accessed via ports declared in `application/ports/` and implemented in `infrastructure/`
- Services MUST NOT inject concrete clients; they depend on ports
- Controllers return DTOs inside a `Result` (see Error Handling); never leak aggregates

## shared-kernel Admission

Admit only cross-context contracts (ports, event classes, global enums, generic DTO bases, pure value objects). Move a contract in when the **second consumer** appears; move it back when only one remains. MUST NOT hold business logic, mutable state, or utility functions.

## Progressive Layering

Start a new module as thin as possible and add a layer only on a signal:

| Stage | Structure                     | Signal to advance                   |
| ----- | ----------------------------- | ----------------------------------- |
| 1     | presentation + infrastructure | Cross-request state needed          |
| 2     | + application/ports           | A read → judge → write flow appears |
| 3     | + application/services        | Invariants or domain events appear  |
| 4     | + domain/aggregates + events  | —                                   |

Skip at most one stage at a time; never downgrade. Unsure → ask. The `greeting` module is a stage-3 sample; delete or replace it when real modules exist.

## Nest-Specific Lint Notes

- `typescript/consistent-type-imports` is off for the API: Nest DI needs runtime class imports for constructor parameters (`emitDecoratorMetadata`). Still use `import type` for pure interfaces and types
- Empty decorated classes (modules, controllers) are allowed
- The `nestjs()` lint preset does not load on the current oxlint; do not add it until verified
