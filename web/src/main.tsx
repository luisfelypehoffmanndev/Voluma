import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

import './styles.css';

// `?demo`: o painel roda com dados de mentira em memoria, sem login e sem
// tocar no banco (src/demo/backend.ts). Instalado antes de o app subir, para o
// cliente do Supabase ja nascer falando com ele.
async function start() {
  const demo = new URLSearchParams(window.location.search).has('demo');
  if (demo) {
    const { installDemo } = await import('./demo/backend');
    installDemo(import.meta.env.EXPO_PUBLIC_SUPABASE_URL as string);
  }
  const { App } = await import('./App');
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <App demo={demo} />
    </StrictMode>,
  );
}

void start();
