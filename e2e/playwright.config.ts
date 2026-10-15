import { defineConfig, devices } from '@playwright/test'

// Siempre localhost: el CORS del backend solo permite http://localhost:5173
// y Vite en Windows puede escuchar solo en IPv6 (127.0.0.1 falla).
const FRONT = 'http://localhost:5173'

// E2E_CHANNEL=chrome usa el Chrome instalado; por defecto, el Chromium de Playwright.
const channel = process.env.E2E_CHANNEL || undefined

export default defineConfig({
  testDir: './tests',
  globalSetup: './global-setup.ts',
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  timeout: 60_000,
  expect: { timeout: 10_000 },
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL: FRONT,
    headless: true,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    viewport: { width: 1400, height: 1000 },
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'], viewport: { width: 1400, height: 1000 }, channel } }],
  webServer: [
    {
      command: 'python -m uvicorn app.main:app --port 8000',
      cwd: '../backend',
      url: 'http://127.0.0.1:8000/docs',
      env: { POKER_BOT_DELAY: '0' },
      reuseExistingServer: true,
      timeout: 60_000,
      stdout: 'ignore',
      stderr: 'pipe',
    },
    {
      command: 'npm run dev -- --port 5173 --strictPort',
      cwd: '../frontend',
      url: FRONT,
      reuseExistingServer: true,
      timeout: 60_000,
      stdout: 'ignore',
      stderr: 'pipe',
    },
  ],
})
