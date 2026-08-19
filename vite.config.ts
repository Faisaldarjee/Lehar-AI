import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    watch: {
      ignored: [
        '**/backend/**',
        '**/data/**',
        '**/argo_cache/**',
        '**/*.db',
        '**/*.db-journal',
        '**/*.sqlite',
        '**/*.sqlite3',
        '**/*.log',
        '**/__pycache__/**',
        '**/.git/**',
      ],
    },
  },
})
