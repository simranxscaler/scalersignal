import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [react()],
  envDir: __dirname,
  server: {
    proxy: {
      '/api': 'http://localhost:8000'
    }
  }
})
