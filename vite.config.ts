import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    host: '0.0.0.0',
    port: 3000,
    // `true` disables the host check entirely — required because we proxy the
    // dev server through Cloudflare → Tatentic → container, so the Host header
    // is never the literal container hostname Vite would otherwise expect.
    allowedHosts: true,
  },
})
