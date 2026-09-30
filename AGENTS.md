# nest-strict-starter

pnpm + turbo monorepo with a NestJS backend. Strict lint and format checks are part of the design: never weaken them to make code pass. Backend dependency direction is documented in `apps/backend/AGENTS.md`; its machine check has not yet been restored after the refactor.

Context lives in `AGENTS.md` files (this one at the root, one per package). Claude Code and other agents read them directly; do not add `CLAUDE.md` files.

- Before working in a package, read its `AGENTS.md`: `apps/backend/AGENTS.md`, `packages/database/AGENTS.md`
- Tooling config rules load from `.claude/rules/tooling.md` via `paths:` matching

## Persisting Instructions

When the user gives a standing instruction ("always ...", "never ...", "from now on ...", "every X should ...", "use X for Y", "we do it this way"), do not just follow it for the current task:

1. Ask whether it should be persisted in the repo, unless the user already said to write it down
2. If yes, write it as a rule in the right place in the same commit as the related change: cross-package rules in this file; package patterns in that package's `AGENTS.md` (e.g. `apps/backend/AGENTS.md`); tooling config rules in `.claude/rules/tooling.md`. Update an existing rule instead of adding a duplicate or a contradicting one
3. Write it in the file's existing style: the rule, why it exists, where the reference implementation lives, and whether it is machine-enforced (add a lint or dependency-cruiser rule when one can enforce it)
4. If the instruction is a one-off for the current task, do not persist it

The repo is the memory: the next session only knows what is written here.

## Keeping Context Current

When a change introduces or alters a pattern (error handling, response shape, a new layer, a boundary rule), update that package's `AGENTS.md` in the same commit: the rule, why it exists, and where the reference implementation lives. Root `AGENTS.md` holds only cross-package rules. A pattern documented nowhere will be reinvented differently by the next agent.

## Design Decisions

`DECISIONS.md` at the repo root records every design decision: the approach chosen, why, and the trade-offs, including options that were rejected and items still to verify. When a change makes, alters, or confirms a design decision (for example, resolving a **(verify)** item), update `DECISIONS.md` in the same commit. Why: it is a submission deliverable, and it is the only record of _why_ the system works the way it does. Code and `AGENTS.md` record _what_ the patterns are. Testable requirements live in `goals/<name>/facts.md`; keep the two consistent. Not machine-enforced; the reviewer agent checks it.

## Layout

- `apps/backend` — NestJS backend with HTTP (`src/api/`), future queue worker (`src/worker/`), business features (`src/modules/`), and shared infrastructure (`src/common/`). Backend ownership and dependencies are defined only in `apps/backend/AGENTS.md`
- `packages/database` — shared Drizzle schema, client types, and PostgreSQL migrations

## Commands

Run from the repo root:

```bash
pnpm install
pnpm run setup      # copy root .env if missing, start PostgreSQL, apply migrations
pnpm dev            # API on :3000
pnpm check          # typecheck + lint + format:check + deps + test — must be green before finishing
pnpm format         # auto-format everything
pnpm lint:fix       # apply safe lint fixes
```

Single package: `pnpm --filter backend <script>`.

## Monorepo Constraints

- Root `package.json` holds only tooling shared by all packages (turbo, oxlint, oxfmt, oxlint-tsgolint, @infra-x/code-quality). Runtime and package-specific dev dependencies go in the package that uses them: `pnpm --filter backend add <dep>`
- Inter-package dependencies use the `workspace:*` protocol; never import across packages by relative path
- Every package defines the same script names (`build`, `typecheck`, `lint`, `format`, `format:check`, `test`, `deps` where applicable) so turbo can run them uniformly
- `typeAware` lint options are root-config-only: put them in `/oxlint.config.ts`; package configs `extends` the root config and add presets
- Package formatter configs re-export the root `oxfmt.config.ts`; do not fork formatting options per package
- TypeScript stays on 6.x until Nest CLI supports TypeScript 7 (it needs the compiler API)
- Config, secrets, and URLs come from environment variables; no hard-coded values. Commit `.env.example`, never `.env`
- Local backend, database migration, and Compose settings use the root `.env`; `scripts/setup.mjs` creates its `DATABASE_URL` from PostgreSQL settings and checks that an existing URL matches. This keeps local connections aligned. The setup command enforces the URL check; file placement is a convention.

## Working Principles

- Library-first: use a mature library before writing new infrastructure code
- MVP-first: build only what the current requirement needs; no speculative layers or config switches
- Functional-first: prefer pure functions and immutable data; keep side effects in infrastructure
- Backend HTTP and worker entry points call business use cases in `apps/backend/src/modules/`; see `apps/backend/AGENTS.md` for ownership, DTO, Result, and dependency rules

## Implementing Plans and Specs (agents)

Code for `apps/backend` is written by agents, not directly by the orchestrating session. Use the `implement-plan` skill whenever a plan, spec, or feature request needs implementing there.

- `.claude/skills/implement-plan/SKILL.md`: the orchestrator. It loops implementer → reviewer until the reviewer approves or **5 attempts** are used, then reports and stops. It never writes backend code itself and never commits
- `.claude/agents/api-implementer.md`: Sonnet. Reads both `AGENTS.md` files and the reference implementations, works test-first, runs `pnpm check`, reports `DONE` or `BLOCKED`
- `.claude/agents/api-reviewer.md`: Opus, high effort, read-only. Checks the spec and every pattern in `apps/backend/AGENTS.md`, runs `pnpm check`, and answers `VERDICT: APPROVE` or `VERDICT: CHANGES_REQUESTED` with numbered, actionable findings. Only `blocker` and `major` findings send work back
- Agents cannot ask the user questions: an ambiguous spec or an "ask first" case ends in `BLOCKED`, and the orchestrator asks
- **When a pattern changes, update the agents too.** The agents point at `AGENTS.md` instead of copying it, so most changes need no edit here. Change an agent file only when its process or checklist changes
- Small edits that do not need a spec (typo, one-line fix) can be done directly

## Quality Gates

All must pass before a change is done: `pnpm check` (zero type errors, zero lint warnings, format clean, configured dependency checks, tests green). Review the backend dependency conventions in `apps/backend/AGENTS.md` manually until a machine check exists. If a rule seems wrong, stop and ask; do not add `// oxlint-disable` or edit rule configs on your own.

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
