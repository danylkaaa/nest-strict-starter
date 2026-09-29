---
paths:
  - apps/api/**
---

# API Rules (NestJS)

Rules marked **[enforced]** are checked by `pnpm --filter api deps` (dependency-cruiser, `apps/api/.dependency-cruiser.mjs`) or oxlint. Rules marked **[convention]** are not machine-checked; follow them anyway.

## Directory Layout

```
apps/api/src/
├── main.ts / app.module.ts
├── app/              # Framework wiring: config, filters, interceptors, logger, base classes
├── modules/<ctx>/    # Business contexts (one folder per bounded context)
│   ├── <ctx>.module.ts
│   ├── domain/           # Pure business logic; aggregates, value objects, events/
│   ├── application/      # ports/ (interfaces + Symbol tokens), services/
│   ├── infrastructure/   # repositories/, adapters/ (implement ports)
│   └── presentation/     # controllers, DTOs
└── shared-kernel/    # Pure cross-context contracts
```

Create a layer folder only when the module needs it (see Progressive Layering). Never add empty layers.

## Dependency Direction

- **[enforced]** No import cycles anywhere (`no-circular`, `import/no-cycle`)
- **[enforced]** `app/` MUST NOT import `modules/`
- **[enforced]** `shared-kernel/` MUST NOT import `modules/`
- **[enforced]** A module MUST NOT import another module, except its `domain/events/` and `application/ports/`
- **[enforced]** `domain/` MUST NOT import npm packages (no `@nestjs/*`, ORMs, loggers, crypto libs). Test files are exempt
- **[enforced]** `presentation/` MUST NOT import database packages (`@workspace/database`, `drizzle-orm`, `pg`, `postgres`); go through application services
- **[enforced]** `application/services/` MUST NOT runtime-import `@workspace/database`; type-only imports are allowed
- **[convention]** `modules/` MUST NOT import `app/` wiring (config, database, events); `app/base/` and shared decorators are allowed
- **[convention]** Use the `@/` alias for cross-directory imports; `../` imports are banned by lint. Same-directory `./x.js` is fine
- Imports of local files use the `.js` extension (NodeNext resolution)

## Domain Purity

- Domain code is plain TypeScript: no decorators, no framework, no I/O
- Domain tests use vitest and domain classes only; never `Test.createTestingModule`
- Aggregates expose business methods (`pay()`, `cancel()`); no public setters
- Wanting a library in the domain means the logic belongs in application or infrastructure

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
- Controllers return DTOs with explicit conversion (`XResponseDto.fromDomain()`); never leak aggregates

## shared-kernel Admission

Admit only cross-context contracts (ports, event classes, global enums, generic DTO bases, pure value objects). Move a contract in when the **second consumer** appears; move it back when only one remains. MUST NOT hold business logic, mutable state, or utility functions.

## Progressive Layering

Start a new module as thin as possible and add a layer only on a signal:

| Stage | Structure | Signal to advance |
|---|---|---|
| 1 | presentation + infrastructure | Cross-request state needed |
| 2 | + application/ports | A read → judge → write flow appears |
| 3 | + application/services | Invariants or domain events appear |
| 4 | + domain/aggregates + events | — |

Skip at most one stage at a time; never downgrade. Unsure → ask. The `greeting` module is a stage-3 sample; delete or replace it when real modules exist.

## Nest-Specific Lint Notes

- `typescript/consistent-type-imports` is off for the API: Nest DI needs runtime class imports for constructor parameters (`emitDecoratorMetadata`). Still use `import type` for pure interfaces and types
- Empty decorated classes (modules, controllers) are allowed
- The `nestjs()` lint preset does not load on the current oxlint; do not add it until verified
