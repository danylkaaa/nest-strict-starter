# nest-strict-starter

pnpm + turbo monorepo with a NestJS API. Strict lint, format, and module-boundary checks are part of the design: never weaken them to make code pass.

Context lives in `AGENTS.md` files (this one at the root, one per package). Claude Code and other agents read them directly; do not add `CLAUDE.md` files.

- Before working in a package, read its `AGENTS.md`: `apps/api/AGENTS.md`
- Tooling config rules load from `.claude/rules/tooling.md` via `paths:` matching

## Keeping Context Current

When a change introduces or alters a pattern (error handling, response shape, a new layer, a boundary rule), update that package's `AGENTS.md` in the same commit: the rule, why it exists, and where the reference implementation lives. Root `AGENTS.md` holds only cross-package rules. A pattern documented nowhere will be reinvented differently by the next agent.

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
- One response envelope for the whole API: `{ ok: true, data }` or `{ ok: false, error: { code, message } }` (see `apps/api/AGENTS.md`)
- Errors as values: expected failures are `neverthrow` `Result`s, not exceptions (see `apps/api/AGENTS.md`)
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

<!-- BEGIN:turborepo-agent-rules -->

# This is NOT the Turborepo you know

Turborepo configuration, task behavior, and CLI commands can vary between installed versions and may differ from your training data. Resolve the `turbo` package from this file's directory or relevant workspace; in monorepos, it may not be visible from the repository root. For example, run `node -p "require.resolve('turbo/package.json')"` from a workspace that depends on `turbo`.

Read `docs/README.md` inside that installed package first, then read the relevant pages from its `docs/` directory before changing Turborepo configuration or commands. Heed deprecation notices. These bundled docs match the installed package version and are available without network access.

This block is written and re-added by `turbo` before repository-scoped commands when an AI agent is detected. In the Turborepo source repository, its template is defined in `crates/turborepo-cli/src/cli/agent_guidance.rs`. Removing the managed block while updates are enabled means a later qualifying invocation will add it again. Set `"agentGuidance": false` in the root `turbo.json` or `turbo.jsonc` to opt out; this does not remove an existing block. Keep the block committed with your work to avoid an uncommitted change on the next agent invocation.
<!-- END:turborepo-agent-rules -->
