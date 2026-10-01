import swc from 'unplugin-swc';
import tsconfigPaths from 'vite-tsconfig-paths';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [
    swc.vite({
      jsc: {
        keepClassNames: true,
        parser: {
          decorators: true,
          syntax: 'typescript',
        },
        target: 'esnext',
        transform: {
          decoratorMetadata: true,
          legacyDecorator: true,
        },
      },
      module: {
        type: 'es6',
      },
    }),
    tsconfigPaths(),
  ],
  test: {
    coverage: {
      exclude: ['**/*.spec.ts', '**/*.e2e-spec.ts', '**/index.ts', '**/*.module.ts'],
      include: ['src/**/*.ts'],
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      reportsDirectory: './coverage',
    },
    env: {
      DATABASE_NAME: 'test',
      JWT_SECRET: 'test-secret-that-is-at-least-32-chars',
      LOG_LEVEL: 'silent',
      POSTGRES_HOST: 'localhost',
      POSTGRES_PASSWORD: 'test',
      POSTGRES_PORT: '5432',
      POSTGRES_USER: 'test',
    },
    environment: 'node',
    globals: false,
    include: ['src/**/*.spec.ts'],
    root: './',
  },
});
