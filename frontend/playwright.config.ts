import { defineConfig, devices } from '@playwright/test';

if (process.env.INTEGRATION_DB_ISOLATED !== '1') {
  throw new Error('浏览器验收只能连接独立测试数据库，请设置 INTEGRATION_DB_ISOLATED=1');
}

const backendPort = '3201';
const frontendPort = '3202';
const frontendUrl = `http://127.0.0.1:${frontendPort}`;

export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? 'github' : 'list',
  outputDir: '/tmp/project-template-playwright-results',
  use: {
    baseURL: frontendUrl,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'off'
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] }
    }
  ],
  webServer: [
    {
      command: 'npm --prefix ../backend start',
      url: `http://127.0.0.1:${backendPort}/api/health`,
      reuseExistingServer: false,
      timeout: 60_000,
      env: {
        ...process.env,
        PORT: backendPort,
        CORS_ORIGIN: frontendUrl,
        NODE_ENV: 'test'
      }
    },
    {
      command: 'npm run dev -- --host 127.0.0.1',
      url: frontendUrl,
      reuseExistingServer: false,
      timeout: 60_000,
      env: {
        ...process.env,
        VITE_DEV_PORT: frontendPort,
        VITE_API_PROXY_TARGET: `http://127.0.0.1:${backendPort}`
      }
    }
  ]
});
