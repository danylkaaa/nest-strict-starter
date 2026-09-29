# apps/api — NestJS API

NestJS API using DDD-style modules. Read the whole file before writing code here. Root rules (monorepo, tooling, git) are in `/AGENTS.md`.

## Pattern Index

Where each pattern lives in code. Copy the reference implementation instead of inventing a variant.

| Pattern                                               | Reference implementation                                               | Section                           |
| ----------------------------------------------------- | ---------------------------------------------------------------------- | --------------------------------- |
| Module layout, layers                                 | `src/modules/greeting/`                                                | Directory Layout                  |
| Boundary rules                                        | `.dependency-cruiser.mjs`                                              | Dependency Direction              |
| Business error classes                                | `greeting/domain/greeting.errors.ts`, `src/app/base/business-error.ts` | Error Handling                    |
| Result-returning domain logic                         | `greeting/domain/greeting.ts`                                          | Error Handling                    |
| HTTP error classes                                    | `src/app/http/errors/http-errors.ts`                                   | Error Handling                    |
| Business error → HTTP error, `Result<Dto, HttpError>` | `greeting/presentation/greeting.controller.ts`                         | Error Handling                    |
| Zod request/response DTOs                             | `greeting/presentation/dtos/`                                          | DTOs (zod + nestjs-zod)           |
| Global validation pipe                                | `src/app/http/validation/validation.module.ts`                         | DTOs (zod + nestjs-zod)           |
| Typed env config (zod)                                | `src/app/config/`                                                      | Configuration (nest-typed-config) |
| Request id + async context                            | `src/app/context/request-context.module.ts`                            | Logging and Request Context       |
| Pino logger config                                    | `src/app/logger/logger.config.ts`                                      | Logging and Request Context       |
| Scoped logger in a service                            | `greeting/application/services/greeting.service.ts`                    | Logging and Request Context       |
| Response envelope                                     | `src/app/http/envelope/`                                               | Response Envelope                 |
| Envelope integration test                             | `src/app.module.spec.ts`                                               | Response Envelope                 |
| Lint exceptions for Nest                              | `oxlint.config.ts`                                                     | Nest-Specific Lint Notes          |

Rules marked **[enforced]** are checked by `pnpm --filter api deps` (dependency-cruiser, `apps/api/.dependency-cruiser.mjs`) or oxlint. Rules marked **[convention]** are not machine-checked; follow them anyway.

## Directory Layout

```
apps/api/src/
├── main.ts / app.module.ts
├── app/              # Cross-cutting framework code, grouped by concern (see "Structure of app/")
├── modules/<ctx>/    # Business contexts and operational capabilities
│   ├── <ctx>.module.ts
│   ├── domain/           # Pure business logic; aggregates, value objects, events/
│   ├── application/      # ports/ (interfaces + Symbol tokens), services/
│   ├── infrastructure/   # repositories/, adapters/ (implement ports)
│   └── presentation/     # controllers, dtos/ (zod DTO classes)
└── shared-kernel/    # Pure cross-context contracts
```

Create a layer folder only when the module needs it (see Progressive Layering). Never add empty layers.

### Structure of `app/`

`app/` holds cross-cutting code that belongs to no business module. Group it **by concern**, then by role inside the concern; never dump files flat into a concern folder once it has two roles.

```
app/
├── base/                    # Base classes modules extend (imported by modules)
│   └── business-error.ts
├── config/                  # Typed, validated env config (wiring only)
│   ├── app-config.ts        # zod schema + AppConfig token
│   └── config.module.ts
├── context/                 # Per-request async context + request id (wiring only)
│   └── request-context.module.ts
├── logger/                  # pino logger config + module (wiring only)
│   ├── logger.config.ts
│   └── logger.module.ts
└── http/                    # HTTP concern
    ├── errors/              # HttpError hierarchy (imported by presentation/)
    │   └── http-errors.ts
    ├── envelope/            # Response envelope: types, interceptor, filter, module (wiring only)
    └── validation/          # Global ZodValidationPipe module (wiring only)
```

- **Two kinds of code, two folders**: what modules import (`base/`, `http/errors/`) is separated from wiring only `AppModule` uses (`http/envelope/`, `http/validation/`, `config/`, `context/`, `logger/`). Modules may import only the first kind (enforced)
- A concern folder gets a `<concern>.module.ts` when it registers providers; `AppModule` imports that module and nothing else from it
- **[convention]** App-wide operational endpoints live in a small module under `modules/<concern>/`; `modules/health/` is the reference. This keeps each endpoint's controller and DTO together while preserving the `Result` and response envelope rules
- One concept per file, named after it (`http-errors.ts`, `envelope.filter.ts`, `envelope.interceptor.ts`); specs sit next to the file. No `index.ts` barrels: import the file directly with the `@/` alias
- Add a new concern folder only when a requirement needs it

## Vertical Structure (Modules)

The app is split **vertically by capability**, not horizontally by technical layer. A module owns everything for its capability, from the HTTP endpoint down to persistence when needed. `modules/health/` is the operational endpoint reference.

- One folder per capability under `src/modules/<ctx>/` (kebab-case, singular noun: `greeting`, `health`, `order`). It contains only the layers it needs (`presentation/`, `application/`, `domain/`, `infrastructure/`) and `<ctx>.module.ts`
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
- **[enforced]** `modules/` MAY import only `app/base/` and `app/http/errors/`; all other `app/` code, including `app/http/envelope/`, is wiring (`modules-app-allowlist`)
- **[enforced]** `domain/`, `application/`, `infrastructure/` MUST NOT import `presentation/` (`no-outward-presentation-import`)
- **[enforced]** `domain/`, `application/`, `infrastructure/` MUST NOT import `app/http/`; HTTP errors belong to `presentation/` (`http-errors-presentation-only`)
- **[convention]** Use the `@/` alias for cross-directory imports; `../` imports are banned by lint. Same-directory `./x.js` is fine
- Imports of local files use the `.js` extension (NodeNext resolution)

## Domain Purity

- Domain code is plain TypeScript: no decorators, no framework, no I/O
- Domain tests use vitest and domain classes only; never `Test.createTestingModule`
- Aggregates expose business methods (`pay()`, `cancel()`); no public setters
- Wanting a library in the domain means the logic belongs in application or infrastructure

## DTOs (zod + nestjs-zod)

Every request input (`@Body()`, `@Query()`, `@Param()`) and every response payload is a **DTO class created with zod and `nestjs-zod`**. No hand-written DTO classes, no `class-validator` / `class-transformer` decorators, no inline object types or bare `string` for controller inputs and outputs.

```ts
// modules/<ctx>/presentation/dtos/greeting-query.dto.ts
import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

export const GreetingQuerySchema = z.object({ name: z.string().default('world') });
export class GreetingQueryDto extends createZodDto(GreetingQuerySchema) {}
```

- **Location and naming**: `<ctx>/presentation/dtos/<name>.dto.ts`, one DTO per file. Export the schema as `XxxSchema` and the class as `XxxDto`; suffix `RequestDto` / `QueryDto` / `ResponseDto` by role when a module has several
- **Requests**: type the handler parameter with the DTO class (`@Query() query: GreetingQueryDto`). The global `ZodValidationPipe` (`app/http/validation/`) validates and transforms it; a failure becomes `VALIDATION_FAILED` (400) in the envelope automatically. Controllers never re-validate
- **Responses**: build them with `XxxResponseDto.create(data)`, which parses through the schema and strips unknown fields (a failure is a bug and returns a generic 500). Return them inside the `Result` (see Error Handling). Never return a domain object, aggregate, or database row directly
- **What a schema validates**: shape, types, and format only (string, email, uuid, ranges, defaults, trimming). Business rules (uniqueness, "name must not be blank", state transitions) stay in the domain and come back as `BusinessError`s. Do not duplicate a domain rule in a schema
- **Layering**: DTOs and zod schemas are a presentation concern. `domain/`, `application/`, and `infrastructure/` MUST NOT import `presentation/` (enforced) and `domain/` MUST NOT import `zod` (enforced). Application services take and return plain domain/application types; the controller maps DTO ⇄ those types
- Derive variants from the schema instead of rewriting it (`.pick()`, `.omit()`, `.partial()`, `.extend()`); infer types with `z.infer` only when a plain type is needed
- Reference: `modules/greeting/presentation/dtos/`

## Error Handling (neverthrow + error classes)

Expected failures are values, not exceptions: `Result` / `ResultAsync` from `neverthrow`. **Every error is a class** extending one of two bases; never use strings, plain objects, or bare `Error` as `E`.

| Layer                                        | Error base class                                   | Defined in                           | Carries                         |
| -------------------------------------------- | -------------------------------------------------- | ------------------------------------ | ------------------------------- |
| `domain/`, `application/`, `infrastructure/` | `BusinessError` (`src/app/base/business-error.ts`) | `<ctx>/domain/<ctx>.errors.ts`       | user-friendly `message`         |
| `presentation/`                              | `HttpError` (`src/app/http/errors/http-errors.ts`) | `src/app/http/errors/http-errors.ts` | `statusCode`, `name`, `message` |

**Business errors**

- Extend `BusinessError`, declare a literal `override readonly name = 'XxxError'` (this makes unions of errors exhaustively matchable), and give the constructor a default user-friendly message: `constructor(message = 'Please enter a name.') { super(message) }`
- Omit the constructor to fall back to the generic default (`DEFAULT_BUSINESS_ERROR_MESSAGE`)
- Messages are read by end users: plain English, no internals, no stack details, no IDs they cannot act on
- Export a union per context: `type GreetingError = GreetingNameEmptyError | ...`
- Domain methods, application services, and port methods return `Result<T, XxxError>` / `ResultAsync<T, XxxError>` for expected failures

**HTTP errors**

- Ready-made classes: `BadRequestError` (400), `UnauthorizedError` (401), `ForbiddenError` (403), `NotFoundError` (404), `ConflictError` (409), `UnprocessableEntityError` (422), `InternalServerError` (500). Each has a `statusCode`, a `name` used as the envelope `code` (e.g. `NOT_FOUND`), and a default message
- Add a new status class in `http-errors.ts` only when a status is needed and missing. For a mapped business error, use its `name` as the HTTP error code; add a name parameter to a status class when it first needs to carry one
- Only `presentation/` creates HTTP errors (enforced)

**Controllers**

- Every controller handler takes zod DTOs for its inputs and returns `Result<XxxResponseDto, HttpError>` (or `ResultAsync<Dto, HttpError>`). It never returns a bare value and never throws for an expected failure
- **[convention]** The controller chooses the HTTP status in `.mapErr(...)` and passes the business error's `message` and `name` to the HTTP error, for example `new BadRequestError(error.message, error.name)`. The message stays friendly and the envelope code identifies the business failure. When a context gains errors requiring different statuses, select the status for each error explicitly
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
{ "ok": false, "error": { "code": "GreetingNameEmptyError", "message": "Please enter a name." } }
```

- Implemented once, globally, in `src/app/http/envelope/`; `EnvelopeModule` registers it via `APP_INTERCEPTOR` / `APP_FILTER` and `AppModule` imports that module. Do not re-register per module
- `EnvelopeInterceptor` unwraps the controller's `Result`: `Ok` → `{ ok: true, data }` (empty value → `data: null`); `Err` → the `HttpError` is thrown into the pipeline
- `EnvelopeFilter` renders every thrown value: `HttpError` → its `statusCode`, `name` as `code`, and `message`. Controllers never build `{ ok, data }` themselves
- Framework errors are mapped automatically: unknown route → `NOT_FOUND`, zod DTO failure (`ZodValidationException`) or Nest validation message list → `VALIDATION_FAILED` (400, message lists `path: reason` pairs), any other Nest `HttpException` → its status name, anything else → `INTERNAL_ERROR` (500) with a generic message
- `code` values are stable once released; `message` is human-readable and may change
- `StreamableFile` responses (downloads) skip the envelope. Handlers using `@Res()` bypass it; avoid `@Res()`
- Change envelope behavior only in `app/http/envelope/` and cover it with a test in `app.module.spec.ts`

## Configuration (nest-typed-config)

All configuration comes from environment variables, validated once at startup and read through a typed class. Nothing reads `process.env` directly except `config.module.ts`.

- **Library**: `nest-typed-config` (`TypedConfigModule.forRoot` with `dotenvLoader()`), validated with **zod** through its `validate` option, so config follows the same zod convention as DTOs
- **Schema**: `src/app/config/app-config.ts` declares the env variables as a plain `z.object`. **No `.transform` and no renaming**: config keys keep their `UPPER_CASE` env names (`config.PORT`, `config.LOG_LEVEL`). `AppConfig` (a `createZodDto` class) is both the type and the injection token: `constructor(private readonly config: AppConfig)`
- **Fail fast**: invalid or missing config throws at boot and the app does not start. Give a variable a `.default()` only when a safe default exists; secrets and URLs never get defaults
- **Adding a setting**: add it to `AppConfigSchema` (the key is the env name, `UPPER_CASE`; no transform), add it to `.env.example` with a comment, add a case to `app-config.spec.ts`. Never hard-code a value that could differ per environment
- `ConfigModule` is global, imported once in `AppModule`. `.env` is git-ignored (create it with `cp .env.example .env`); `.env.example` is committed and lists every variable
- **Current variables**: `NODE_ENV` (`development` | `test` | `production`), `PORT` (default 3000), `LOG_LEVEL` (optional, `trace` … `silent`; when unset the level follows `NODE_ENV`, see Logging)
- **Modules do not import `app/config`** (enforced by the app allowlist). When a module needs a setting, ask before choosing how to pass it in; do not widen the allowlist on your own
- Reference: `src/app/config/`

## Logging and Request Context (pino + nestjs-cls)

- **Logger**: `pino` through `nestjs-pino`. Output is JSON (pretty in `NODE_ENV=development`); level is `AppConfig.LOG_LEVEL` when set (it overrides everything), otherwise the `NODE_ENV` default: production `info`, test `warn`, development `debug`. `main.ts` installs it as the Nest logger (`bufferLogs` + `app.useLogger`), so framework logs use it too
- **Startup output**: after `app.listen`, `main.ts` logs one banner in every environment (context `Bootstrap`): Environment, Address, Port, Node, then a group of endpoint links (`- App`, `- Health`). It is built by the pure `formatStartupBanner` (`src/app/logger/startup-banner.ts`) from `{ rows: [label, value][] }` groups (labels aligned per group, groups split by a blank line). Nest's own bootstrap chatter is always dropped by a pino `hooks.logMethod` in `logger.config.ts`: logs whose `context` is in `FILTERED_LOG_CONTEXTS` (`RoutesResolver`, `RouterExplorer`, `InstanceLoader`, `NestFactory`, `NestApplication`) are not written at any level. Request, application, and `Bootstrap` logs are unaffected; add a context to that constant to hide another framework logger. When adding a public endpoint worth showing (docs, metrics), add it to the banner's link group in `main.ts`
- Dev logs are pretty-printed on a single line with `[context]` prefixes; production logs stay full JSON
- **Request context**: `nestjs-cls` opens an async context per HTTP request (`src/app/context/`). Every request gets a **unique UUID, always generated server-side**; a client-supplied `X-Request-Id` is ignored. It is returned in the `X-Request-Id` response header and available via `ClsService.getId()`
- **`requestId` on every line**: the logger `mixin` adds `requestId` from the context to every log line, including the automatic `request completed` line. Never pass it by hand
- **Scoped logger**: inject `PinoLogger` and set the class as context, so lines carry `context` and `requestId`:

```ts
constructor(private readonly logger: PinoLogger) {
  this.logger.setContext(GreetingService.name)
}
// this.logger.info({ orderId }, 'Order paid')
```

- Log with structured fields first, message second (`logger.info({ orderId }, 'Order paid')`); messages are static text, variable data goes in fields
- Use `debug` for diagnostics, `info` for business events, `warn` for recoverable oddities, `error` for failures. Do not log expected `Result` errors at `error`
- **Never log secrets or personal data** (passwords, tokens, full payloads). `authorization`, `cookie`, and `set-cookie` headers are redacted; do not add fields that bypass that
- `console.*` is banned by lint (`no-console`); use the logger. `domain/` stays pure and does not log; log in `application/`, `infrastructure/`, and `presentation/`
- Work outside a request (cron, queue consumers) has no request id; wrap it in `PinoLogger.runInContext` to bind fields such as a job id
- Reference: `src/app/logger/`, `src/app/context/`, and `modules/greeting/application/services/greeting.service.ts`

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
- Services MUST NOT inject concrete clients; they depend on ports. The one exception is the logger (`PinoLogger`), a cross-cutting concern (see Logging)
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
