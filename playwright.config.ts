import { defineConfig, devices } from "@playwright/test";

const projectRoot = __dirname;

export default defineConfig({
  testDir: "./tests",
  timeout: 90_000,
  expect: {
    timeout: 5_000,
  },
  use: {
    baseURL: "http://localhost:3100",
    extraHTTPHeaders: {
      "X-WorkCore-E2E-Bypass": "1",
      "X-WorkCore-Tenant": "00000000-0000-0000-0000-000000000001",
    },
    trace: "on-first-retry",
  },
  webServer: {
    command: "NEXT_PUBLIC_DISABLE_SUPABASE_SYNC=1 NEXT_PUBLIC_E2E_AUTH_BYPASS=1 WORKCORE_E2E_AUTH_BYPASS=1 npm run dev -- --port 3100",
    cwd: projectRoot,
    url: "http://localhost:3100",
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
    {
      name: "webkit",
      testMatch: /(?:safari-runtime|report-private-media|workcore-ux)\.spec\.ts/,
      use: { ...devices["Desktop Safari"] },
    },
  ],
});
