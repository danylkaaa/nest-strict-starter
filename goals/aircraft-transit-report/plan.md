# Plan: Aircraft transit report module

Facts: [`facts.md`](facts.md). Backend code is written through the `implement-plan` skill (implementer → reviewer loop), per root `AGENTS.md`.

## Approach

- **Data:** `airports` and `aircraft` are reference tables in `packages/database`. A restored `pnpm db:seed` fills them from committed TypeScript lists and uses `onConflictDoNothing`, so reruns are safe. Reports go in `aircraft_transit_reports` (`atr_<ULID>`, foreign keys, jsonb `waypoints`).
- **Module:** `apps/backend/src/modules/aircraft-transits/` owns:
  - five public use cases: Validate, Generate, Get, ListAirports, ListAircraft
  - one private request validator shared by Validate and Generate
  - a pure path builder
  - ports: a repository, a `Clock`, and a `SimulationDelay`
- **Path:** built with `@turf/distance` for the total distance and `@turf/bearing` + `@turf/destination` for points spaced evenly along the great circle. Each point moves the full fraction of the distance along the initial bearing.
  - This gives one continuous point list, including across the antimeridian. `@turf/great-circle` was rejected because it splits such routes into a MultiLineString.
  - The first and last points are set to the exact airport coordinates.
- **HTTP:** `GET /api/airports` and `GET /api/aircraft` only, following `api/endpoints/emails/`.

## Steps

1. **Dependencies.** `pnpm --filter backend add @turf/distance @turf/bearing @turf/destination @turf/helpers` (7.4.x).
   - Verify: `pnpm --filter backend typecheck`.

2. **Schema, seed, migration** (`packages/database`).
   - `src/schema.ts`:
     - `airports`: `icao` is the text primary key, stored uppercase, with a check `^[A-Z]{4}$`. Other columns: `iata`, `name`, `city`, `country`, `latitude`, `longitude` (double precision).
     - `aircraft`: `acf_<ULID>` id with a shape check. Columns: `model`, `registration` (unique), `cruise_speed_kmh`, `cruise_altitude_m`.
     - `aircraft_transit_reports`: `atr_<ULID>` id with a shape check. Columns: `origin_icao` and `destination_icao` (foreign keys to `airports`), `aircraft_id` (foreign key to `aircraft`), `departure_at`, `arrival_at`, `distance_km`, `duration_minutes`, `waypoints` (jsonb), `created_at`.
   - `src/seed-data/airports.ts`: about 40 major airports, including RJTT and KSFO for the antimeridian case.
   - `src/seed-data/aircraft.ts`: about 8 real models with realistic cruise speed and altitude.
   - `src/seed.ts`.
   - Scripts: a `db:seed` script in the package, a root `db:seed` script, and a turbo `db:seed` task (`cache: false`, env `POSTGRES_*` and `DATABASE_NAME`).
   - Run `pnpm db:generate` to create the next migration (`0003_*`; main already has `0000`–`0002`).
   - The `POSTGRES_*` and `DATABASE_NAME` variables come from the root `.env` (see `scripts/setup.mjs` and `drizzle.config.ts`); the seed script loads them the same way.
   - Verify:
     - A package unit test checks the seed data: unique ICAO codes and registrations, valid lat/lon ranges, and 35–45 airports.
     - `pnpm db:migrate && pnpm db:seed` run twice produce the same row counts (checked with psql).

3. **Domain types, errors, path builder** (TDD).
   - `aircraft-transit.ts`: types for Airport, Aircraft, TransitRequest, Waypoint, and TransitReport.
   - `aircraft-transit.errors.ts`: `UnknownAirportError(code)`, `UnknownAircraftError(id)`, `SameAirportError`, `DepartureInPastError`, `AircraftTransitReportNotFoundError`. All extend `DomainError`.
   - `transit-path.ts` is a pure function `(origin, destination, aircraft, departureAt) → { distanceKm, durationMinutes, arrivalAt, waypoints }`, with a `toGeoJsonLineString(waypoints)` helper.
     - Waypoint count: `max(2, round(distanceKm / 100) + 1)`.
     - Timestamps: linear in distance.
     - Altitude: climb over the first 10% of the distance, cruise, descend over the last 10%.
     - Speed: the aircraft's cruise speed.
   - Verify with `transit-path.spec.ts` (facts 10, 12–17):
     - distance matches a known route (EGLL–KJFK ≈ 5,540 km, ±1%)
     - first and last points equal the airports exactly
     - timestamps strictly increase
     - altitude is 0 at the ends and cruise altitude at the midpoint
     - RJTT→KSFO gives one list, with every consecutive pair under 110 km apart
     - GeoJSON is a `LineString` with `[lon, lat]` coordinates

4. **Ports and adapters.**
   - Ports follow the current `apps/backend/AGENTS.md` pattern (reference: `modules/webhooks/ports/`): each port is an interface plus an exported symbol token in `ports/`, injected with `@Inject(TOKEN)`, wired with `{ provide: TOKEN, useClass: Adapter }`.
   - `ports/aircraft-transit.repository.ts` is the port with: `findAirports(icaos)`, `findAircraft(id)`, `listAirports()`, `listAircraft()`, `saveReport()`, `findReport(id)`.
   - `aircraft-transit.repository.ts` (feature root): the Drizzle adapter. `findReport` joins the airports and aircraft. List orders: ICAO for airports, registration for aircraft. Query errors are replaced with generic errors, following the email repository.
   - `ports/clock.ts` is a `Clock` port; `system.clock.ts` implements it.
   - `ports/simulation-delay.ts` is a `SimulationDelay` port. `RandomSimulationDelay` waits 1–3 s.
   - `aircraft-transits.module.ts` wires everything and exports only the use cases.
   - Verify: `pnpm --filter backend typecheck`. Also an `*.e2e-spec.ts` for the adapter (save → find, joins, sort orders), run with `pnpm --filter backend test:integration` against a migrated and seeded DB.

5. **Use cases** (TDD, in-memory fakes, zero delay, fixed clock). All five live in `use-case/`.
   - Private `validate-transit-request.ts`:
     - uppercases the codes
     - returns `SameAirportError` before any repository call
     - then resolves the airports (`UnknownAirportError` names the missing code) and the aircraft
     - checks the past departure only when asked
   - `ValidateAircraftTransitRequestUseCase` runs the past check. `GenerateAircraftTransitReportUseCase` skips it, calls `SimulationDelay`, builds the path, and saves.
   - `GetAircraftTransitReportUseCase`, `ListAirportsUseCase`, and `ListAircraftUseCase`.
   - Verify: one spec per use case covering facts 3, 5, 7–9, 11, 18, and 20, including "no repository call on same airport" and "Validate saves nothing".

6. **HTTP read endpoints.**
   - `api/endpoints/airports/` and `api/endpoints/aircraft/`: a controller, a module, and Zod DTOs each, with Swagger tags, summaries, and `ApiEnvelopeResponse`.
   - Register both in `api.module.ts`.
   - Verify: run `pnpm dev` after seeding, then `curl localhost:3000/api/airports` and `/api/aircraft`. Both endpoints must appear in `/api/docs-json`.

7. **Docs.**
   - `DECISIONS.md`: new sections for the synthetic reports (OpenSky and NOAA were considered and rejected), seeded reference data, the validation split with the past check at submission only, and destination-based path interpolation.
   - `apps/backend/AGENTS.md`: the module map, the Clock and SimulationDelay seams, and the Validate/Generate split for the future job controller and worker.
   - `packages/database/AGENTS.md`: the reference tables and `db:seed`.
   - `README.md`: the seed command and the two endpoints.

8. **Final gate.** `pnpm check` is green. Run the integration spec once against Docker Postgres.

## Risks / open questions

- **Antimeridian on the map:** waypoint longitudes stay in [-180, 180], so a map may draw the RJTT→KSFO line across the whole globe. The UI (not in scope) can unwrap the longitudes. The alternative is to unwrap them here, which breaks the GeoJSON [-180, 180] convention.
- **Integration tests are outside `pnpm check`:** seed idempotency and the Drizzle adapter are only verified by `test:integration`, which needs Docker. This is the same trade-off the repo already makes.
- **The seed is reference data, not fixtures:** foreign keys mean a report cannot exist without its seeded airport or aircraft. Removing a seeded row later requires handling the reports that reference it.
- **Speed is constant at cruise speed:** this is simple, but it doesn't slow down during climb or descent. It's acceptable for a mock, and `DECISIONS.md` will record it.
- **Swagger peer-range warning** for `nestjs-zod` applies, as noted in `DECISIONS.md`. No new risk.
