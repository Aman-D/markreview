import { defineConfig } from '@playwright/test'

// E2E is local-only for M1 (kept out of `pnpm check` / CI to keep CI fast).
// Run with: pnpm e2e
export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  reporter: 'list',
  use: {
    trace: 'retain-on-failure',
    video: 'on',
    screenshot: 'on',
  },
})
