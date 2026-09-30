# Goal: Aircraft transit report module

Build the backend feature module `apps/backend/src/modules/aircraft-transits/`. It generates a synthetic aircraft transit report between two seeded airports for a chosen seeded aircraft: a Turf great-circle path with timed waypoints, altitude, and speed, plus distance, arrival time, and duration. The report is saved to the database. Validation is shared between the future job-submit controller and the worker, and read-only `GET /api/airports` and `GET /api/aircraft` endpoints list the seeded reference data.

- Shared understanding: [`facts.md`](facts.md) (25 accepted facts; `facts.meta.json` marks which need automated checks)
- Execution plan: [`plan.md`](plan.md) (approved; implement through the `implement-plan` skill)

## Done when

- Every fact in `facts.md` holds; facts marked `automatedVerification: true` are covered by unit specs or the integration spec.
- `pnpm check` is green, and `pnpm --filter backend test:integration` passes against a migrated, seeded Docker Postgres.
- `DECISIONS.md`, `apps/backend/AGENTS.md`, `packages/database/AGENTS.md`, and `README.md` are updated.
- The implement-plan reviewer returns `VERDICT: APPROVE`.
