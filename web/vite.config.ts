import { fileURLToPath } from 'node:url';

import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

// O painel le o mesmo `.env` do app (URL e chave publicavel do Supabase), na
// raiz do repositorio: um lugar so para trocar de projeto.
export default defineConfig({
  plugins: [react()],
  envDir: '..',
  envPrefix: ['VITE_', 'EXPO_PUBLIC_SUPABASE_'],
  resolve: {
    alias: {
      // Regras puras do app (semana, nomes). So modulos sem React Native.
      '@domain': fileURLToPath(new URL('../src/domain', import.meta.url)),
    },
  },
  server: { port: 5173, strictPort: true },
});
