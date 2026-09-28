import { useEffect, useMemo, useState } from 'react';

import { signedAvatarUrls } from '@/sync/avatar';

/**
 * URLs assinadas para as fotos de uma tela, numa chamada so.
 *
 * Enquanto as URLs nao chegam (ou se a rede falhar), o mapa fica vazio e cada
 * `Avatar` mostra a inicial — a foto nunca segura a tela.
 */
export function useAvatarUrls(paths: readonly (string | null)[]): ReadonlyMap<string, string> {
  // A chave e o conjunto de caminhos, nao a identidade do array: a lista de
  // amigos vira um array novo a cada render, e isso nao e motivo para assinar
  // tudo de novo.
  const key = useMemo(
    () => [...new Set(paths.filter((path): path is string => path !== null))].sort().join('|'),
    [paths],
  );
  const [signed, setSigned] = useState<{ key: string; urls: Map<string, string> } | null>(null);

  useEffect(() => {
    if (!key) return;
    let cancelled = false;
    signedAvatarUrls(key.split('|'))
      .then((urls) => {
        if (!cancelled) setSigned({ key, urls });
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [key]);

  return signed && signed.key === key ? signed.urls : EMPTY;
}

const EMPTY: ReadonlyMap<string, string> = new Map();
