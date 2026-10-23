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
      // A biblioteca de movimentos do app (nome, grupo, corrida ou carga). Os
      // tipos ficam num shim (src/shims.d.ts): o TypeScript do painel nao
      // segue os imports de React Native que os tipos de la puxam.
      '@movements/data': fileURLToPath(new URL('../src/movements/data.ts', import.meta.url)),
      '@movements/names': fileURLToPath(new URL('../src/movements/names.pt.ts', import.meta.url)),
      '@movements/taxonomy': fileURLToPath(new URL('../src/movements/taxonomy.ts', import.meta.url)),
    },
  },
  server: { port: 5173, strictPort: true },
});
