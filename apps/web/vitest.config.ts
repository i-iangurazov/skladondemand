import path from 'path';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/__tests__/shopify-*.spec.ts', 'src/__tests__/smoke.spec.ts'],
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
      'server-only': path.resolve(__dirname, 'src/__tests__/server-only.ts'),
    },
  },
});
