# nest-strict-starter

NestJS monorepo with strict lint, format, and module-boundary checks.

- **Lint**: oxlint with type-aware rules (`oxlint-tsgolint`), unicorn, depend, `import/no-cycle`
- **Format**: oxfmt (no semicolons, single quotes, sorted imports)
- **Boundaries**: dependency-cruiser (`apps/api/.dependency-cruiser.mjs`): no cycles, no cross-module imports except `domain/events` and `application/ports`, domain stays free of npm libs
- **Tests**: vitest + swc

```bash
pnpm install
pnpm check   # typecheck + lint + format:check + deps + test
pnpm format  # auto-format
pnpm dev     # API on :3000
```

Known limits: the `nestjs()` preset from `@infra-x/code-quality` fails to load on oxlint 1.86; `typescript/consistent-type-imports` is off because Nest DI needs runtime imports; Nest CLI needs TypeScript 6 (not 7).

## Local PostgreSQL and migrations

1. Copy `.env.example` to `.env` (Compose credentials) and `packages/database/.env.example` to `packages/database/.env` (`DATABASE_URL` for migrations and seeds). Set `POSTGRES_PASSWORD`, `POSTGRES_PORT`, and `DATABASE_NAME`, then make `DATABASE_URL` match them. Port `5433` avoids a default PostgreSQL installation on `5432`; choose another free port if needed. URL-encode special characters in URL credentials.
2. Copy `apps/api/.env.example` to `apps/api/.env` if it does not exist. Set `JWT_SECRET` (at least 32 characters) and the same `DATABASE_URL` as `packages/database/.env`.
3. Run `docker compose up -d --wait`. The mounted `docker/postgres/01-create-database.sh` creates `DATABASE_NAME` with safely quoted SQL on **first initialization of a fresh volume**. Restarting keeps the database; changing the name in `.env` does not rename or recreate an existing database. Existing volumes are never reset automatically.
4. Run `pnpm db:migrate` to apply the committed migrations, then `pnpm db:seed` and `pnpm dev`. Schema lives in `packages/database/src/schema.ts`; migrations and Drizzle metadata live in `packages/database/migrations`. After editing schema, run `pnpm db:generate`, review the generated SQL, then apply it with `pnpm db:migrate`.
5. Run `pnpm check`. For real transaction integration tests, build with `pnpm --filter @workspace/database build`, then run `DATABASE_URL=postgresql://... pnpm --filter api test:integration` against a migrated, seeded disposable database.

The API loads `apps/api/.env`; migration and seed tools load `packages/database/.env`; Compose loads root `.env`; explicitly exported environment variables override both. Migration tasks are uncached and `db:generate` does not need a running database. Application and schema packages compile to JavaScript for runtime use; root Turbo commands build dependencies first.

The users table stores `id`, `email`, `created_at`, `updated_at`, and `password_hash`. Drizzle generates `usr_<ULID>` IDs and advances `updated_at` on updates. Raw SQL inserts must supply IDs, and raw SQL updates must maintain `updated_at`. Email is unique. API login reads users directly from PostgreSQL through the CLS-aware repository.

After migrations, run `pnpm db:seed` to create the development user `admin@example.com` with password `12345678`. The seed reads `packages/database/.env` (`DATABASE_URL`), stores a salted scrypt hash compatible with the API password verifier, and preserves an existing account with that email, including its password and timestamps. Seeding does not run automatically at startup. Sign in with `POST /api/auth/login` and JSON `{ "email": "admin@example.com", "password": "12345678" }`; the returned Bearer token authorizes `/api/auth/me` and `/api/health`.

The API uses `@nestjs/drizzle` for client registration and graceful pool shutdown. Authenticated `GET /api/health` executes `SELECT 1`; success returns `{ ok: true, data: { status: "ok", postgres: "up" } }`, while a database failure returns HTTP 503 with `PostgresUnavailableError`. `DATABASE_TIMEOUT_MS` defaults to 3000ms per connection/query phase and also sets PostgreSQL statement timeout.

CLS transactions use the shared Drizzle client. A rejected transaction callback rolls back; a resolved `neverthrow` `Err` does not. See `apps/api/AGENTS.md` and the database integration spec for transaction usage and error handling.
