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
