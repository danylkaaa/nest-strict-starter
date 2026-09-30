---
name: env-config
description: Add or change backend environment settings. Use for new settings, secrets, URLs, ports, feature flags, or edits to apps/backend/.env.example and typed configuration.
---

# Backend environment configuration

Read `apps/backend/AGENTS.md` for ownership and dependency direction. The HTTP app currently loads environment variables through `@nestjs/config` in `src/api/core/config/config.module.ts`. Its `parseApiConfig` function in `api.config.ts` unflattens `__`-separated keys and validates the result with Zod. `ApiConfig` is the injected token. `src/common/database/database.config.ts` owns the database-only schema; `AppModule` passes its parsed value to `DatabaseModule`.

## Add a setting

1. Add the Zod field in the owning schema. Use `src/api/core/config/http.config.ts` for HTTP settings, `src/api/core/logger/logger.schema.ts` for API logging, and `src/common/database/database.config.ts` for shared database settings. Compose a new section in `api.config.ts` only when needed. Done when the parsed config has the intended type, constraint, and safe default, if any.
2. Add the corresponding `section__field` key to `apps/backend/.env.example` with a safe example. Keep secrets and URLs required; never commit a real `.env`. Done when a developer can tell which variable to set.
3. Extend `src/api/core/config/api.config.spec.ts` with a valid and invalid case. Add required test values to `vitest.config.mts` if a test boots the app. Done when the test catches a malformed value and passes for a valid one.
4. Inject `ApiConfig` in API composition or pass only the owning config section to shared infrastructure. A feature use case receives the specific value through its Nest wiring or injected dependency; it does not import `api/core/config`. Done when dependency direction in `apps/backend/AGENTS.md` remains intact.
5. Run `pnpm check` from the repo root. Update `apps/backend/AGENTS.md` and `WORKING_DECISIONS.md` if the config pattern or its trade-off changes. Done when the quality gate passes and the documentation matches the code.

Only `api/core/config/config.module.ts` reads `process.env` for the API. The worker configuration path has not been implemented; define it when `src/worker/` is built and document it then.
