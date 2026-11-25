import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Porta e URL da API vêm do ambiente para que duas cópias (git worktrees) rodem
// ao mesmo tempo sem colidir. O harness (scripts/up.sh) define WEB_PORT e
// VITE_API_URL por cópia; sem eles, caímos nos padrões de desenvolvimento.
const port = Number(process.env.WEB_PORT) || 5173
const apiUrl = process.env.VITE_API_URL || 'http://localhost:4000'

export default defineConfig({
  plugins: [react()],
  server: {
    port,
    strictPort: true,
  },
  // Injeta a URL da API escolhida pela cópia. web/src/config/env.ts lê
  // import.meta.env.VITE_API_URL (única camada que toca import.meta.env, G5).
  define: {
    'import.meta.env.VITE_API_URL': JSON.stringify(apiUrl),
  },
})
