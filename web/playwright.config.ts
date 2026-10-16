import { defineConfig } from '@playwright/test';

const PORT = 4329;
const ENV = [
  'PUBLIC_RPC_URL=http://127.0.0.1:8555',
  'PUBLIC_ALAMAT_KONTRAK=0x5FbDB2315678afecb367f032d93F642f64180aa3',
  'PUBLIC_CHAIN_ID=31337',
  `PUBLIC_GATEWAY_URL=http://127.0.0.1:${PORT}`,
].join(' ');

export default defineConfig({
  testDir: 'e2e',
  workers: 1,
  reporter: 'list',
  globalSetup: './e2e/siapkan.ts',
  use: { baseURL: `http://127.0.0.1:${PORT}`, channel: 'chrome', trace: 'retain-on-failure' },
  webServer: {
    command: `${ENV} npx astro build && PORT=${PORT} node e2e/server.mjs`,
    url: `http://127.0.0.1:${PORT}/`,
    reuseExistingServer: false,
    timeout: 180_000,
  },
});
