import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    include: ['server/**/*.test.ts', 'shared/**/*.test.ts', 'src/**/*.test.{ts,tsx}'],
    // Date-sensitive server tests assume UTC; individual tests override APP_TIMEZONE.
    env: { APP_TIMEZONE: 'UTC' },
    setupFiles: ['./src/test-setup.ts'],
  },
})
