import { defineConfig, devices } from "@playwright/test";

const projectRoot = __dirname;

export default defineConfig({
  testDir: process.env.WORKCORE_TEST_ONLINE === "1" ? "./tests/online" : "./tests",
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
    command: `NEXT_PUBLIC_DISABLE_SUPABASE_SYNC=${process.env.WORKCORE_TEST_ONLINE === "1" ? "0" : "1"} NEXT_PUBLIC_E2E_AUTH_BYPASS=1 WORKCORE_E2E_AUTH_BYPASS=1 npm run dev -- --port 3100`,
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
      testMatch: /(?:form-controls|consulting-travel|consulting-attachments|auth-navigation|billing-overview|invitation-accept|customer-layout|local-cache|company-logo|administration|company-directory|master-data-design|staff-time|personal-layout|block-layouts|tablet-layout|standard-trips|resource-types-ui|operations-ui|operations-tables|operations-reports|supplier-damage-cases|stock-overview|safari-runtime|report-private-media|field-multi-photo|field-material-review|field-inputs|consulting-service-list|workcore-ux|report-timestamp|report-transitions|dashboard-job-opening|sticky-header-layering|drive-log-ux|logbook-language|trip-chronology-ui|object-groups|communication-layout)\.spec\.ts/,
      use: { ...devices["Desktop Safari"] },
    },
  ],
});
