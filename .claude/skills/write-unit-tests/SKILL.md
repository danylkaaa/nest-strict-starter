---
name: write-unit-tests
description: How to write unit tests for the NestJS API (apps/api) - what to test in each layer, what to skip, how to structure and mock. Use whenever writing or reviewing backend tests, adding a spec file, or a plan says "add tests".
---

# Write Unit Tests (apps/api)

Stack: **vitest** (explicit imports, no globals), `@golevelup/ts-vitest` for mocks, `neverthrow` for results, `supertest` for HTTP integration. Read the reference specs before writing yours.

## Where and how to run

- Next to the code: `foo.ts` + `foo.spec.ts`. Vitest picks up `src/**/*.spec.ts`
- Run all: `pnpm --filter api test`. One file: `pnpm --filter api exec vitest run src/path/foo.spec.ts`. Watch: `pnpm --filter api test:watch`
- **Test-first**: write the failing spec, watch it fail for the right reason, then implement
- `LOG_LEVEL=silent` is set for tests in `vitest.config.mts`; no log noise

## What to test, per layer

| Layer                                                 | Test                                                                                                                                         | Mock                        | Reference                                                        |
| ----------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------- | ---------------------------------------------------------------- |
| `domain/`                                             | Every business rule and error path, edge values, state transitions. Pure functions and aggregates                                            | nothing                     | `modules/greeting/domain/greeting.spec.ts`                       |
| `application/services/`                               | Orchestration: calls ports with the right arguments, returns the right `Result`, passes errors up                                            | ports and logger            | `modules/greeting/application/services/greeting.service.spec.ts` |
| `presentation/` controllers                           | Query/body → service call, service `Result` → response DTO, **every** domain error → the right Nest exception (status + `{ code, message }`) | the service                 | `modules/greeting/presentation/greeting.controller.spec.ts`      |
| zod DTO schemas                                       | Defaults, coercion, valid input, each invalid input rejected                                                                                 | nothing                     | `app/config/app-config.spec.ts`                                  |
| `infrastructure/` adapters                            | External failure → `DomainError` in a `Result`; mapping of external data to domain types                                                     | the client (db, http)       | write it like the service spec                                   |
| `app/` wiring (filters, interceptors, config, logger) | The pure mapping functions in isolation                                                                                                      | framework objects           | `app/http/envelope/*.spec.ts`, `app/logger/*.spec.ts`            |
| HTTP integration                                      | Cross-cutting behavior through the real pipeline: envelope, validation, request id. One happy path and one error path per endpoint           | nothing (boots `AppModule`) | `app.module.spec.ts`                                             |

Unit tests never start a server or touch a database. A real database or network needs an integration/e2e test, not a unit test.

## What NOT to test

- Framework behavior: Nest DI, decorators, routing, that `@Injectable` works
- Library internals: zod, neverthrow, pino, nest-typed-config
- Files with no logic: `*.module.ts`, DTO classes that only call `createZodDto`, re-exports, type-only files
- Private methods and call order; test observable behavior and results
- The same rule twice at different layers. Test a rule where it lives (domain), not again in the controller
- Snapshots of large objects; assert the fields that matter

## Structure

```ts
describe('greeting service', () => {
  // lowercase unit name
  let service: GreetingService; // fresh instance per test
  beforeEach(() => {
    service = new GreetingService(createMock<PinoLogger>());
  });

  it('returns the domain error for a blank name', () => {
    // behavior + condition
    const result = service.greet(' '); // act

    expect(result).toEqual(err(new GreetingNameEmptyError())); // assert
  });
});
```

- One `describe` per unit, named in lowercase (`greeting service`, `buildGreeting`, `get /health`)
- One behavior per `it`; the title says what happens and when: `'maps a domain error to a 400 with the friendly message'`. No "should", no method names alone
- **Arrange, act, assert**, separated by blank lines. Keep arrange short; move repeated setup into `beforeEach` or a small factory at the top of the file
- Fresh objects per test (`beforeEach`); no shared mutable state, no dependence on test order
- Many inputs, one behavior: `it.each([...])('rejects invalid input %o', ...)`
- Cover the happy path, **each** error path, and the edges (empty, boundary, duplicate, null-ish)
- Deterministic: no real time, randomness, or network. Use `vi.useFakeTimers()` or inject the clock/id generator

## Assertions on `Result`s

```ts
expect(buildGreeting('Ada')).toEqual(ok('Hello, Ada!'));
expect(buildGreeting('  ')).toEqual(err(new GreetingNameEmptyError()));
expect(result).toMatchObject({ error: { statusCode: 400 } }); // extra field on the error
```

`_unsafeUnwrap()` and `_unsafeUnwrapErr()` are banned. Never branch on `result.isOk()` inside a test.

## Mocking

- `createMock<T>()` from `@golevelup/ts-vitest`; override only what the test needs: `createMock<GreetingService>({ greet: () => ok('Hi') })`
- Build the unit directly with `new Unit(mock)`; do **not** use `Test.createTestingModule` for unit tests (domain tests must never use the container)
- A mocked `Result` needs both type arguments: `ok<string, GreetingNameEmptyError>('Hello')`
- Assert interactions only when they are the behavior (a port was called with X): `expect(port.save).toHaveBeenCalledWith(order)`
- Never mock what you own in the layer below the unit, except at a port boundary. Domain code is used for real in service tests

## Repo lint rules that affect tests

- `describe` and `it` titles start lowercase (`prefer-lowercase-title`)
- `toThrow()` needs a message or class (`require-to-throw-message`); for zod prefer `safeParse(x).success`
- No conditionals or loops in tests (`no-conditional-in-test`)
- No `as` casts (`no-unsafe-type-assertion`); use `createMock<T>()` and generics
- Import `describe`, `it`, `expect`, `beforeEach`, `vi` from `vitest`; use the `@/` alias; no `console`
- No `it.skip`, `it.only`, or disabled lint rules. Fix the test instead

## Done checklist

1. The spec failed before the implementation and passes now
2. Every business rule and error path of the unit has a test
3. Titles read as behavior; no test depends on another
4. `pnpm check` is green (typecheck, lint, format, deps, tests)
