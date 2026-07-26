import { defineConfig } from '@playwright/test'

/**
 * Auto-spawns the backend (port 5000) and the frontend dev server (port 3000)
 * before running specs. Set REUSE=1 if you already have them running.
 *
 * Override API target with E2E_API_BASE (e.g. against staging):
 *   E2E_API_BASE=https://staging-api.example.com/api npx playwright test
 */
export default defineConfig({
  testDir: './e2e',
  timeout: 45_000,
  expect: { timeout: 8_000 },
  retries: process.env.CI ? 2 : 1,
  reporter: [
    ['list'],
    ['html', { open: 'never', outputFolder: 'playwright-report' }],
  ],
  use: {
    baseURL: 'http://localhost:3000',
    headless: true,
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure',
    video: 'retain-on-failure',
  },
  webServer: [
    {
      // Frontend (Vite preview build). Falls back to dev if you set E2E_USE_DEV=1.
      command:
        process.env.E2E_USE_DEV === '1'
          ? 'npm run dev -- --port 3000 --strictPort'
          : 'npm run build && npm run preview -- --port 3000 --strictPort',
      port: 3000,
      reuseExistingServer: true,
      timeout: 180_000,
    },
    {
      // Backend API. Loads its own .env, requires DATABASE_URL + JWT_SECRET.
      command: 'npm --prefix backend run dev',
      port: 5000,
      reuseExistingServer: true,
      timeout: 60_000,
    },
  ],
})
