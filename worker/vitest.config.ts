import { cloudflareTest } from '@cloudflare/vitest-plugin'
import { defineConfig } from 'vitest/config'

// Secrets FALSOS, só para o teste. O wrangler lê os secrets obrigatórios do process.env.
process.env.TURN_KEY_ID = 'test-key-id'
process.env.TURN_KEY_API_TOKEN = 'test-api-token'

export default defineConfig({
  plugins: [
    cloudflareTest({
      wrangler: { configPath: './wrangler.toml' },
      miniflare: {
        // Origens de teste: nada real entra nos testes.
        bindings: { ALLOWED_ORIGINS: 'https://app.test,https://*.preview.test' },
      },
    }),
  ],
  test: {
    include: ['test/**/*.test.ts'],
  },
})
