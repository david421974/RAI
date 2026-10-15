import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests',
  fullyParallel: false, // Se recomienda false al inicio para no saturar los servicios locales
  retries: process.env.CI ? 2 : 0,
  workers: 1,
  reporter: [
    ['list'],
    ['html', { outputFolder: 'playwright-report', open: 'never' }]
  ],
  use: {
    // Lee la URL de la variable de entorno que inyectamos desde Docker
    baseURL: process.env.BASE_URL || 'http://localhost:8080',
    trace: 'on-first-retry',    // Registra el historial de red (Network), consola y acciones en tiempo real (on)
    screenshot: 'only-on-failure',  // Toma capturas de pantalla de cada paso (on)
    video: 'retain-on-failure',   // Graba vídeo de todas las ejecuciones (on)
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
});