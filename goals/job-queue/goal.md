# Goal: Job queue service (API + workers)

Build a background job system in `apps/api` and `packages/database`. Clients submit email, webhook, aircraft transit report, and batch jobs over HTTP. Worker processes execute them through pg-boss on the same PostgreSQL database. The system delivers each job at least once, rejects writes from stale workers, and makes side effects idempotent, so every job is processed **effectively once**. It does not claim exactly-once delivery.

- Shared understanding: [`facts.md`](./facts.md) (decided in a grilling session on 2026-09-30)
- Execution plan: not written yet. Implement via the `implement-plan` skill (api-implementer → api-reviewer), in small vertical slices (one commit each)

## Done when

- Every fact in `facts.md` holds and is covered by unit or integration specs where it is observable
- `apps/api/AGENTS.md` and `packages/database/AGENTS.md` document the job pattern (registry, lease-token fencing, same-transaction enqueue)
- `README.md`, `DECISIONS.md`, and `AI_USAGE.md` exist in the format the assignment requires
- `pnpm check` is green (typecheck, lint, format, deps, tests)
- The reviewer agent returns `VERDICT: APPROVE`

## Open (verify during planning)

Tracked in `DECISIONS.md` → Open Items. Every design decision and its reasoning lives there; `facts.md` is the checklist that can be tested.

- Whether pg-boss 12 `work()` lets our code call `complete`/`fail` inside our own transaction (`{ db }` option), or whether the worker needs its own `fetch` loop
- Whether pg-boss applies backoff to retries after a lost heartbeat, and whether its backoff formula matches the installed version

## Out of scope (parked)

- Web UI (stack, map rendering, live updates): a separate goal
