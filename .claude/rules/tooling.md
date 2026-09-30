---
paths:
  - '**/oxlint.config.ts'
  - '**/oxfmt.config.ts'
  - '**/.dependency-cruiser.mjs'
  - turbo.json
  - pnpm-workspace.yaml
---

# Tooling Rules

- Lint: oxlint (config: `oxlint.config.ts`, presets from `@infra-x/code-quality/lint`). Format: oxfmt (`oxfmt.config.ts`). Backend dependency direction is documented in `apps/backend/AGENTS.md`; its former dependency-cruiser config has been removed and no replacement check exists yet. There is no ESLint, Prettier, or TSLint; do not add them
- Weakening any of these (turning a rule off, adding an ignore, loosening a boundary) needs an explicit user request and a one-line comment saying why
- When adding machine checks for backend boundaries, align them with `apps/backend/AGENTS.md`, explain each rule's intent, and verify with a temporary violating file before keeping the rule
- Root config carries shared presets and `typeAware()`; package configs `extends` it and add package-specific presets and overrides
- After editing any config, run `pnpm check` from the repo root
- `pnpm-workspace.yaml` `onlyBuiltDependencies` is an allowlist for install scripts: add packages only when a build step is required
