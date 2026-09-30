---
name: write-unit-tests
description: Write or review tests for apps/backend. Use when adding a spec file, testing a use case, controller, worker consumer, repository adapter, or backend configuration.
---

# Backend tests

Read `apps/backend/AGENTS.md` first. Use Vitest with explicit imports; colocate `foo.spec.ts` with `foo.ts`. Run all tests with `pnpm --filter backend test`, or one with `pnpm --filter backend exec vitest run src/path/foo.spec.ts`.

## Test at the owning seam

1. Write a failing test for the requested behavior before implementation. It must fail for the behavior being changed, not for missing setup. Done when the failure is reproducible.
2. Test a use case through `execute(input)`: success, each expected `Result` error, and side effects observable through its injected repository port or other public use case. Mock external dependencies, not the business decision under test. Done when each rule has one clear owner.
3. Test HTTP mapping in `api/endpoints/<feature>/`: request DTO input to the use case, success DTO output, and feature error to HTTP behavior. Test the global pipe and envelope through an HTTP test when changing those cross-cutting behaviors. Done when the real request path catches invalid input and produces the expected response.
4. Test worker consumers in `worker/` when implemented: queue payload mapping, use-case invocation, and job outcome for each expected error. Test Drizzle adapters with a disposable database when SQL behavior matters; unit tests use an injected port or client fake. Done when transport and persistence behavior is covered at its own seam.
5. Run `pnpm check` from the repo root. Done when tests, types, lint, and format pass.

Keep tests deterministic and assert behavior rather than Nest or library internals. Use fresh fixtures per test. No `skip`, `only`, unsafe type assertions, or `_unsafeUnwrap` helpers. The current repository has `api/core/config/api.config.spec.ts` and `common/database/database.module.spec.ts`; the old greeting and HTTP specs were removed in the refactor, so do not cite them as existing examples.
