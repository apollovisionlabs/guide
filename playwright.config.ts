import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  testDir: './e2e',
  // Le rapport HTML est ce que la CI televerse quand un scenario echoue : sans lui,
  // l'etape d'artefact n'a rien a televerser et les captures produites sont perdues.
  reporter: [['list'], ['html', { open: 'never' }]],
  use: { baseURL: 'http://localhost:5173', trace: 'on-first-retry' },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    command: 'pnpm --filter demo dev',
    url: 'http://localhost:5173',
    reuseExistingServer: !process.env.CI,
  },
})
