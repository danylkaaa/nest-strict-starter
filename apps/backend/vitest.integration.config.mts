import { defineConfig } from 'vitest/config';

import config from './vitest.config.mts';

export default defineConfig({
  ...config,
  test: {
    ...config.test,
    env: { ...config.test?.env, DATABASE_URL: process.env['DATABASE_URL'] ?? '' },
    include: ['src/**/*.e2e-spec.ts'],
  },
});
