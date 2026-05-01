import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const target = env.VITE_PROXY_TARGET || 'http://localhost:8080'

  return {
    plugins: [react()],
    envPrefix: ['VITE_', 'STARBASE_'],
    server: {
      proxy: {
        '/api': target,
        '/healthz': target,
        '/openapi.yaml': target,
        '/swagger': target,
        '/web': target,
      },
    },
  }
})
