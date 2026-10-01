import { defineConfig } from 'vitest/config';

import config from './vitest.config.mts';

export default defineConfig({
  ...config,
  test: {
    ...config.test,
    env: {
      ...config.test?.env,
      DATABASE_NAME: process.env['DATABASE_NAME'] ?? '',
      ...(process.env['POSTGRES_HOST'] ? { POSTGRES_HOST: process.env['POSTGRES_HOST'] } : {}),
      POSTGRES_PASSWORD: process.env['POSTGRES_PASSWORD'] ?? '',
      POSTGRES_PORT: process.env['POSTGRES_PORT'] ?? '',
      POSTGRES_USER: process.env['POSTGRES_USER'] ?? '',
    },
    // Every suite shares one database and one set of queues, and workers consume any job.
    fileParallelism: false,
    include: ['src/**/*.e2e-spec.ts'],
  },
});
