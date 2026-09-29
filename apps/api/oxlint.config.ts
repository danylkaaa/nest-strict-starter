import { node, promise, vitest } from '@infra-x/code-quality/lint'
import { defineConfig } from 'oxlint'

import rootConfig from '../../oxlint.config.ts'

export default defineConfig({
  extends: [
    rootConfig,
    node(),
    promise(),
    vitest({ files: ['**/*.{test,spec}.ts', '**/*.e2e-spec.ts', '**/__tests__/**/*.ts'] }),
  ],
  rules: {
    // NestJS exception filter .catch() is not Promise.catch()
    'promise/valid-params': 'off',
  },
  overrides: [
    {
      // Error catalogs and their specs declare several small classes per file.
      files: ['**/*errors.ts', '**/*errors.spec.ts', '**/*error.spec.ts'],
      rules: { 'max-classes-per-file': 'off' },
    },
    {
      files: ['**/*.ts'],
      rules: {
        // Empty decorated classes are valid (modules, controllers)
        'typescript/no-extraneous-class': ['error', { allowWithDecorator: true }],
        // Nest DI needs runtime class references for constructor params (emitDecoratorMetadata)
        'typescript/consistent-type-imports': 'off',
      },
    },
    {
      // vitest mocks reference methods unbound by design
      files: ['**/*.{test,spec}.ts'],
      rules: { 'typescript/unbound-method': 'off' },
    },
  ],
})
