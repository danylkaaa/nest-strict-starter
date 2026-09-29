---
name: env-config
description: How environment variables and typed config work in apps/api, and how to add a new env value step by step. Use whenever a task needs a new setting, secret, URL, port, or feature flag, or touches .env, .env.example, or AppConfig.
---

# Env and Config

All configuration in `apps/api` comes from environment variables. They are validated once at startup with zod and read through the typed `AppConfig` class. Never read `process.env` anywhere except `src/app/config/config.module.ts`.

## How it works

1. `TypedConfigModule` (`nest-typed-config`) loads `apps/api/.env` plus the real process environment (`dotenvLoader()`)
2. `AppConfigSchema` (zod) validates it. Invalid or missing values throw at boot and the app does not start
3. `AppConfig` is the validated object, and also the injection token
4. Keys keep their env names in `UPPER_CASE`. **No `.transform`, no renaming**: `config.PORT`, `config.LOG_LEVEL`

| File                                         | Role                                                    | Git                       |
| -------------------------------------------- | ------------------------------------------------------- | ------------------------- |
| `apps/api/src/app/config/app-config.ts`      | zod schema + `AppConfig`                                | committed                 |
| `apps/api/src/app/config/config.module.ts`   | loads and validates                                     | committed                 |
| `apps/api/src/app/config/app-config.spec.ts` | schema tests                                            | committed                 |
| `apps/api/.env.example`                      | every variable, with a comment and a safe example value | committed                 |
| `apps/api/.env`                              | your local values (`cp .env.example .env`)              | **ignored, never commit** |

Current variables: `NODE_ENV`, `PORT`, `LOG_LEVEL`.

## Add a new value

1. **Schema**: add the key to `AppConfigSchema` in `app-config.ts`, using the env name in `UPPER_CASE`

   ```ts
   export const AppConfigSchema = z.object({
     // ...existing keys
     REQUEST_TIMEOUT_MS: z.coerce.number().int().positive().default(5000),
     DATABASE_URL: z.url(), // no default: required secret
   })
   ```

   - Env values are strings. Use `z.coerce.number()` for numbers; for booleans use `z.enum(['true', 'false'])`, never `z.coerce.boolean()` (it turns `"false"` into `true`)
   - `.default()` only for safe, non-secret values. **Secrets, URLs, and credentials never get defaults**: leave them required so a missing value fails at boot
   - Constrain the value: `z.enum([...])`, `.min()`, `.max()`, `z.url()`

2. **Example file**: add it to `apps/api/.env.example` with a comment and a fake or safe value. Never a real secret

3. **Local file**: add the real value to your `apps/api/.env`

4. **Test first**: add a case to `app-config.spec.ts` (defaults, coercion, and one invalid input that must be rejected). Run `pnpm --filter api test` and see it fail before step 1 if working test-first

5. **Use it**: inject `AppConfig` where wiring needs it

   ```ts
   constructor(private readonly config: AppConfig) {}
   // this.config.REQUEST_TIMEOUT_MS
   ```

   - `AppConfig` is global. Use it in `app/` wiring (`main.ts`, `app/*/*.module.ts`, factories)
   - **Business modules cannot import `app/config`** (enforced by dependency-cruiser). If a module needs the value, stop and ask how to pass it in; do not widen the allowlist

6. **Docs**: update the "Current variables" line in the Configuration section of `apps/api/AGENTS.md`

7. **Verify**: run `pnpm check` from the repo root

## Other places that may need the value

- **Tests**: vitest env is set in `apps/api/vitest.config.mts` (`test.env`, currently `LOG_LEVEL: 'silent'`). A new **required** variable breaks every test that boots `AppModule`; add a test value there
- **CI**: `.github/workflows/ci.yml` runs lint only, so it needs no env. If a job runs tests or boots the app, add the variable to that job's `env:`
- **Deployment**: the value must exist in the deployed environment before rollout, or the app refuses to start

## Rules

- No `process.env` outside `config.module.ts`; no hard-coded values that could differ per environment
- Keys are `UPPER_CASE` and identical to the env name; no camelCase copies
- A new variable is not done until it is in the schema, `.env.example`, a spec, and the docs
- Never commit `.env`, never print config values or secrets in logs or error messages
