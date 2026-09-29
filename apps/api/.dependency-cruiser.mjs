// npm packages resolve to their pnpm store path (.../node_modules/<pkg>/...), and workspace
// packages to their source folder, so database rules match on those resolved paths.
const DATABASE_PATH = '/node_modules/(drizzle-orm|pg|postgres)/|(^|/)packages/database/';

/** @type {import('dependency-cruiser').IConfiguration} */
export default {
  forbidden: [
    {
      comment: 'Circular dependencies break tooling and signal layering issues.',
      from: {},
      name: 'no-circular',
      severity: 'error',
      to: { circular: true },
    },
    {
      comment:
        'Cross-module imports are forbidden except via contracts (events, ports). Share code via shared-kernel or decouple through events.',
      from: { path: '^src/modules/([^/]+)/' },
      name: 'no-cross-module',
      severity: 'error',
      to: {
        path: '^src/modules/([^/]+)/',
        pathNot: [
          '^src/modules/$1/',
          // Cross-context contracts: domain events and application ports.
          // Per api rules, events live in publisher's domain/events/, ports in publisher's application/ports/
          // (until promoted to shared-kernel when consumers ≥ 2).
          '^src/modules/[^/]+/domain/events/',
          '^src/modules/[^/]+/application/ports/',
        ],
      },
    },
    {
      comment:
        'HTTP concerns are a presentation concern. domain/application/infrastructure raise DomainError subclasses; the controller converts them to Nest HttpException subclasses (from @nestjs/common). This rule forbids src/app/http/ imports; it cannot see @nestjs/common exceptions, which oxlint no-restricted-imports covers.',
      from: { path: '^src/modules/[^/]+/(domain|application|infrastructure)/' },
      name: 'http-errors-presentation-only',
      severity: 'error',
      to: { path: '^src/app/http/' },
    },
    {
      comment:
        'Modules may only use app/base (base classes) and app/http/auth (auth decorators) and app/http/context (RequestContext); the http ones are presentation only. Other app/ code, including app/http/envelope, is wiring.',
      from: { path: '^src/modules/' },
      name: 'modules-app-allowlist',
      severity: 'error',
      to: { path: '^src/app/', pathNot: '^src/app/(base|http/auth|http/context)/' },
    },
    {
      comment:
        'Modules must not use @nestjs/jwt. Tokens are issued through the TOKEN_ISSUER port (shared-kernel/auth), implemented in app/auth.',
      from: { path: '^src/modules/' },
      name: 'modules-no-jwt',
      severity: 'error',
      to: { path: '/node_modules/@nestjs/jwt/' },
    },
    {
      comment:
        'Modules must not use nestjs-cls. Request-scoped data (the current user) is read only through app/http/context/RequestContext, in controllers.',
      from: { path: '^src/modules/' },
      name: 'modules-no-cls',
      severity: 'error',
      to: { path: '/node_modules/nestjs-cls/' },
    },
    {
      comment:
        'presentation (controllers, zod DTOs) depends on inner layers, never the reverse. domain/application/infrastructure must not import presentation/.',
      from: { path: '^src/modules/[^/]+/(domain|application|infrastructure)/' },
      name: 'no-outward-presentation-import',
      severity: 'error',
      to: { path: '^src/modules/[^/]+/presentation/' },
    },
    {
      comment: 'shared-kernel must not import business modules.',
      from: { path: '^src/shared-kernel/' },
      name: 'shared-kernel-no-modules',
      severity: 'error',
      to: { path: '^src/modules/' },
    },
    {
      comment: 'The app layer must not directly depend on business modules.',
      from: { path: '^src/app/' },
      name: 'app-no-modules',
      severity: 'error',
      to: { path: '^src/modules/' },
    },
    {
      comment:
        'Services must not runtime-import @workspace/database. Go through repository ports instead. Type-only imports are allowed.',
      from: { path: '^src/modules/[^/]+/application/services/' },
      name: 'service-no-database-runtime',
      severity: 'error',
      to: {
        dependencyTypesNot: ['type-only'],
        path: DATABASE_PATH,
      },
    },
    {
      comment:
        'Domain layer must stay free of runtime libraries (@nestjs/*, drizzle, bcrypt, pino, ...). Exempt: test files (vitest) and neverthrow (Result types for expected failures).',
      from: {
        path: '^src/modules/[^/]+/domain/',
        pathNot: '\\.spec\\.ts$',
      },
      name: 'domain-no-external-libs',
      severity: 'error',
      to: {
        dependencyTypes: ['npm', 'npm-dev', 'npm-optional', 'npm-peer', 'npm-no-pkg'],
        pathNot: '/node_modules/neverthrow/',
      },
    },
    {
      comment:
        'Presentation layer must not access the database directly. Go through application services.',
      from: { path: '^src/modules/[^/]+/presentation/' },
      name: 'presentation-no-database',
      severity: 'error',
      to: { path: DATABASE_PATH },
    },
  ],
  options: {
    doNotFollow: { path: 'node_modules' },
    enhancedResolveOptions: {
      conditionNames: ['import', 'require', 'node', 'default', 'types'],
      exportsFields: ['exports'],
      mainFields: ['main', 'types'],
    },
    reporterOptions: {
      text: { highlightFocused: true },
    },
    tsConfig: { fileName: 'tsconfig.json' },
  },
};
