import { cloudflareTest } from '@cloudflare/vitest-plugin'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  plugins: [
    cloudflareTest({
      wrangler: { configPath: './wrangler.toml' },
      miniflare: {
        // Origens de teste e secrets FALSOS: nada real entra nos testes.
        bindings: {
          ALLOWED_ORIGINS: 'https://app.test,https://*.preview.test',
          TURN_KEY_ID: 'test-key-id',
          TURN_KEY_API_TOKEN: 'test-api-token',
        },
      },
    }),
  ],
  test: {
    include: ['test/**/*.test.ts'],
  },
})
