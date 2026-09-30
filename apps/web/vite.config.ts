import react from '@vitejs/plugin-react';
import { loadEnv } from 'vite';
import { defineConfig } from 'vitest/config';

export default defineConfig(({ mode }) => {
  // The dev server forwards `/api` to the backend, so the browser sees a single origin
  const env = loadEnv(mode, '.', '');
  return {
    plugins: [react()],
    resolve: { tsconfigPaths: true },
    server: { proxy: { '/api': env['API_PROXY_TARGET'] ?? 'http://localhost:3000' } },
    test: { include: ['src/**/*.spec.ts'] },
  };
});
