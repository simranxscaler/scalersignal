import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [react()],
  envDir: path.resolve(__dirname, '..'),  // read .env from repo root
  server: {
    proxy: {
      '/api': 'http://localhost:8000'
    }
  }
})
