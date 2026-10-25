import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir: './tests/browser',
  fullyParallel: false,
  use: {
    baseURL: 'http://127.0.0.1:3001',
    headless: true,
    launchOptions: {
      executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH || undefined,
      args:
        process.env.PLAYWRIGHT_NO_SANDBOX === 'true'
          ? [
              '--no-sandbox',
              '--disable-dev-shm-usage',
              '--use-gl=angle',
              '--use-angle=swiftshader',
              '--no-zygote',
            ]
          : [],
    },
  },
  webServer: {
    command: 'npm run build && npm start',
    url: 'http://127.0.0.1:3001',
    reuseExistingServer: false,
    env: { DEMO_MODE: 'true', PORT: '3001' },
    timeout: 60000,
  },
});
