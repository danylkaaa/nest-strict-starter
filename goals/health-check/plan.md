# Plan: health check endpoint

The web dashboard's "Queue health" card shows `Healthy / API, database and queue reachable` and the pending, scheduled, and processing counts. The workers row ("Workers busy X of Y") is being removed from the UI, so there is no worker tracking. This plan adds a real `GET /api/health` that feeds the card. Do not touch `apps/web`: the orchestrator wires the client after this lands.

No schema change and no migration are needed. Follow the existing patterns (use cases, ports, Drizzle adapter in the owning feature, controller and Zod DTOs in `api/endpoints/`, Swagger, envelope).

## Behavior

1. **`GET /api/health`** (no auth), standard envelope. Response data:
   - `status`: `ok` when the database and the queue both answer; `down` otherwise.
   - `checks`: `{ database: 'up' | 'down', queue: 'up' | 'down' }`. Each check has a 2 second timeout so a hung dependency cannot hang the endpoint. A failing check never leaks the underlying error message.
   - `counts`: job counts for all six statuses (same effective status as `GET /api/jobs/stats`; reuse the stats use case, do not duplicate its SQL). When the database is down, return zeros for all six statuses (document it in `DECISIONS.md`).
   - HTTP status: 200 for `ok`; 503 for `down`. On 503 the body must still tell the client which check failed (use the existing error envelope mechanism, `error.details`, or the closest one; check `api/core/response-envelope/`).
2. **Ownership.** The health use case lives in a new feature `modules/health/` (use case in `use-case/`, with a port for the checks and its adapter). It calls the public stats use case of `modules/jobs/` for the counts. `api/endpoints/health/` owns the controller and DTOs. The queue check uses `common/queue/` (for example a cheap pg-boss call such as `getQueue` for the email queue); the database check is a trivial query.

## Tests first

- Unit specs: health use case (ok, down for database, down for queue, timeout, no error text leaked, zero counts when the database is down), controller status codes (200 and 503 with the failed check in the body).
- Integration spec (disposable migrated database): `GET /api/health` returns 200 with the expected shape and real counts; with the queue check failing it returns 503.

## Docs and gate

- `apps/backend/AGENTS.md`, `README.md` (endpoint list), `DECISIONS.md` (why health reports only database and queue, why no worker tracking: pg-boss has no worker registry and the UI does not need one).
- `pnpm check` green; `pnpm --filter backend test:integration` passes on a disposable migrated and seeded database; reviewer `APPROVE`.
