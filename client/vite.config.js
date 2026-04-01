import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  clearScreen: false,
  server: {
    hmr: false,
    watch: {
      ignored: ['**/dist/**'],
    },
  },
  plugins: [react({ fastRefresh: false })],
})
