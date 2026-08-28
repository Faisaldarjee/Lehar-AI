import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  build: {
    rollupOptions: {
      output: {
        // Split heavy visualization libraries into their own chunks so the
        // initial chat view does not have to download three.js, leaflet or
        // recharts up front. These load lazily alongside the views that use them.
        manualChunks: (id: string) => {
          if (id.includes('node_modules/three')) return 'three';
          if (id.includes('node_modules/leaflet') || id.includes('react-leaflet')) return 'leaflet';
          if (
            id.includes('node_modules/recharts') ||
            id.includes('node_modules/victory-vendor') ||
            id.includes('node_modules/d3-')
          )
            return 'recharts';
        },
      },
    },
  },
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
