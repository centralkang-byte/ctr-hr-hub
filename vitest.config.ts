import { defineConfig } from 'vitest/config'
import path from 'path'

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['tests/unit/**/*.test.ts'],
    exclude: ['node_modules', 'prisma/seeds', 'e2e/**', '.next/**'],
    setupFiles: [],
  },
  resolve: {
    alias: {
      'server-only': path.resolve(__dirname, './tests/unit/__mocks__/server-only.ts'),
      '@/lib/settings/get-setting': path.resolve(__dirname, './tests/unit/__mocks__/get-setting.ts'),
      '@/lib/prisma': path.resolve(__dirname, './tests/unit/__mocks__/prisma.ts'),
      '@': path.resolve(__dirname, './src'),
    },
  },
})
