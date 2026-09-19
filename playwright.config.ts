import { defineConfig } from '@playwright/test';

export default defineConfig({
  use: { baseURL: 'http://localhost:5173' },
  // Two servers, because most routes are data-backed: the Go API answers
  // /api and /auth, and Vite proxies both to it (vite.config.ts), so tests
  // only ever need the one base URL above. Without the backend here, every
  // spec that touches a crag, rock or problem would measure an error state.
  webServer: [
    {
      command: 'go run ./cmd/api',
      cwd: 'palabatu-be',
      // Any always-mounted route works as a readiness probe. /metrics needs
      // no auth, no database rows, and no rate-limit budget.
      url: 'http://localhost:3001/metrics',
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
    },
    {
      command: 'npm run dev',
      cwd: 'palabatu-fe',
      url: 'http://localhost:5173',
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
    },
  ],
});
