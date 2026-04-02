import { defineConfig, loadEnv } from 'vite'
import react, { reactCompilerPreset } from '@vitejs/plugin-react'
import babel from '@rolldown/plugin-babel'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const groqKey = env.GROQ_API_KEY || env.VITE_GROQ_API_KEY || ''

  return {
    plugins: [react(), babel({ presets: [reactCompilerPreset()] })],
    server: {
      proxy: {
        // Browser → same origin → Vite → Ollama (no CORS). Set VITE_OLLAMA_URL=/ollama in .env
        '/ollama': {
          target: 'http://127.0.0.1:11434',
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/ollama/, ''),
        },
        // Groq OpenAI-compat: browser hits /groq/* → api.groq.com/openai/v1/* with Bearer from env (not bundled)
        '/groq': {
          target: 'https://api.groq.com/openai/v1',
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/groq/, ''),
          configure: (proxy) => {
            proxy.on('proxyReq', (proxyReq) => {
              if (groqKey) {
                proxyReq.setHeader('Authorization', `Bearer ${groqKey}`)
              }
            })
          },
        },
      },
    },
  }
})
