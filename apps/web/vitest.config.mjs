import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.dirname(fileURLToPath(import.meta.url));

// Unit tests for server actions and helpers. Run from the repo root with
//   pnpm test:web
// It borrows the vitest that is already installed for @repo/config, so no new
// dependency is needed.
export default {
  resolve: { alias: { '@': root } },
  test: {
    environment: 'node',
    include: ['unit-tests/**/*.test.mjs'],
  },
};
