/// <reference types="vitest/config" />
import react from '@vitejs/plugin-react';
import child from 'child_process';
import path from 'path';
import { defineConfig } from 'vite';

function commitHash() {
  try {
    return child.execSync('git rev-parse --short HEAD', { stdio: 'pipe' }).toString().trim();
  } catch {
    return 'unknown';
  }
}

export default defineConfig({
  plugins: [react()],

  resolve: {
    alias: {
      '~': path.resolve(import.meta.dirname, './src'),
    },
  },

  define: {
    __COMMIT_HASH__: JSON.stringify(commitHash()),
    __BUILD_TIME__: JSON.stringify(new Date().toISOString()),
  },

  test: {
    include: ['src/**/*.spec.{ts,tsx}'],
  },
});
