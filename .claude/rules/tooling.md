---
paths:
  - "**/oxlint.config.ts"
  - "**/oxfmt.config.ts"
  - "**/.dependency-cruiser.mjs"
  - turbo.json
  - pnpm-workspace.yaml
---

# Tooling Rules

- Lint: oxlint (config: `oxlint.config.ts`, presets from `@infra-x/code-quality/lint`). Format: oxfmt (`oxfmt.config.ts`). Boundaries: dependency-cruiser. There is no ESLint, Prettier, or TSLint; do not add them
- Weakening any of these (turning a rule off, adding an ignore, loosening a boundary) needs an explicit user request and a one-line comment saying why
- New boundary rules go in `apps/api/.dependency-cruiser.mjs` with a `comment:` explaining intent; verify with a temporary violating file before keeping the rule
- Root config carries shared presets and `typeAware()`; package configs `extends` it and add package-specific presets and overrides
- After editing any config, run `pnpm check` from the repo root
- `pnpm-workspace.yaml` `onlyBuiltDependencies` is an allowlist for install scripts: add packages only when a build step is required
