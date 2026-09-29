# Goal: JWT authentication with hardcoded users

Add JWT authentication to `apps/api`. `POST /auth/login` checks an email and password against a hardcoded, scrypt-hashed user list and returns a Bearer token. A global passport-jwt guard protects every route unless the handler or controller is marked `@Public()`, and `@CurrentUser()` gives handlers the authenticated user (`GET /auth/me`).

- Shared understanding: [`facts.md`](./facts.md) (18 accepted facts; automated-verification flags in `facts.meta.json`)
- Execution plan: [`plan.md`](./plan.md). Implement via the `implement-plan` skill (api-implementer → api-reviewer)

## Done when

- Every fact in `facts.md` holds; facts with `automatedVerification: true` are covered by specs
- `apps/api/AGENTS.md` documents the auth pattern
- `pnpm check` is green (typecheck, lint, format, deps, tests)
- The reviewer agent returns `VERDICT: APPROVE`
