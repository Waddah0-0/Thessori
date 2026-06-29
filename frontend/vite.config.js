import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/api': 'http://localhost:8000', // dev: proxy API calls to FastAPI
    },
  },
  build: {
    outDir: '../ui_dist', // production build lands here
  },
})
