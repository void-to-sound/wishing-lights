import react from '@vitejs/plugin-react'
import { defineConfig } from 'vitest/config'

// Production build uses the root index.html only.
// Pages under experiments/ stay available to the dev server, and are not emitted.
export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
})
