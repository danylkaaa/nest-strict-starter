import { a11y, reactVite, vitest } from '@infra-x/code-quality/lint';
import { defineConfig } from 'oxlint';

import rootConfig from '../../oxlint.config.ts';

export default defineConfig({
  extends: [rootConfig, reactVite(), a11y(), vitest({ files: ['**/*.spec.{ts,tsx}'] })],
  rules: {
    'no-console': 'error',
  },
});
