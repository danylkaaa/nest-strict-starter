# nest-strict-starter

pnpm + turbo monorepo with a NestJS API. Strict lint, format, and module-boundary checks are part of the design: never weaken them to make code pass.

Package rules load automatically from `.claude/rules/` via `paths:` matching (`api.md`, `tooling.md`).

## Layout

- `apps/api` — NestJS API (DDD-style modules)
- `packages/*` — shared libraries (none yet)

## Commands

Run from the repo root:

```bash
pnpm install
pnpm dev            # API on :3000
pnpm check          # typecheck + lint + format:check + deps + test — must be green before finishing
pnpm format         # auto-format everything
pnpm lint:fix       # apply safe lint fixes
```

Single package: `pnpm --filter api <script>`.

## Monorepo Constraints

- Root `package.json` holds only tooling shared by all packages (turbo, oxlint, oxfmt, oxlint-tsgolint, @infra-x/code-quality). Runtime and package-specific dev dependencies go in the package that uses them: `pnpm --filter api add <dep>`
- Inter-package dependencies use the `workspace:*` protocol; never import across packages by relative path
- Every package defines the same script names (`build`, `typecheck`, `lint`, `format`, `format:check`, `test`, `deps` where applicable) so turbo can run them uniformly
- `typeAware` lint options are root-config-only: put them in `/oxlint.config.ts`; package configs `extends` the root config and add presets
- Package formatter configs re-export the root `oxfmt.config.ts`; do not fork formatting options per package
- TypeScript stays on 6.x until Nest CLI supports TypeScript 7 (it needs the compiler API)
- Config, secrets, and URLs come from environment variables; no hard-coded values. Commit `.env.example`, never `.env`

## Working Principles

- Library-first: use a mature library before writing new infrastructure code
- MVP-first: build only what the current requirement needs; no speculative layers or config switches
- Test-first: write the failing test, then the implementation; tests sit next to source (`foo.ts` + `foo.spec.ts`)
- Functional-first: prefer pure functions and immutable data; keep side effects in infrastructure
- Organize by business capability (`modules/<context>/`), not by technical layer

## Quality Gates

All must pass before a change is done: `pnpm check` (zero type errors, zero lint warnings, format clean, zero dependency violations, tests green). If a rule seems wrong, stop and ask; do not add `// oxlint-disable` or edit rule configs on your own.

## Git

All comments, commit messages, and docs are in English. Commit messages follow Conventional Commits, enforced by commitlint (`commitlint.config.mjs`); use the `commit-message` skill when writing them.

Husky hooks (installed by `pnpm install` via `prepare`):

- `pre-commit`: `lint-staged` formats (oxfmt) and lints (oxlint --fix) staged files
- `commit-msg`: commitlint validates the message
- `pre-push`: `pnpm check` (typecheck, lint, format:check, deps, test)

Never bypass hooks with `--no-verify`; fix the cause instead.
