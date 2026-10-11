import { useCallback, useEffect, useRef } from 'react';
import { AppState } from 'react-native';

import { COMMIT_DELAY } from './TargetsEditor';

/**
 * Escrita adiada, coalescida e que nunca desiste.
 *
 * Tres garantias, nessa ordem de importancia:
 *
 * 1. **Coalesce.** Cinco toques seguidos na mesma caixa viram UMA escrita, a do
 *    estado final. Antes cada toque abria sua propria transacao, e duas delas
 *    perto no tempo se sobrepunham na conexao compartilhada — a origem do erro
 *    que fazia a caixa voltar sozinha (ver `serializeTransactions` em
 *    `src/db/client.ts`). Menos escrita e menos chance de colisao, alem de
 *    menos trabalho na JS thread no instante do toque.
 * 2. **Uma em voo por vez.** Se um estado novo chega enquanto a escrita
 *    anterior ainda nao voltou, ele espera e entra depois — nunca em paralelo.
 * 3. **Nao perde.** Flush no unmount e ao mandar o app para segundo plano, para
 *    que sair da tela (ou fechar o app) no meio do debounce grave mesmo assim.
 *
 * O que ele deliberadamente NAO faz e avisar quem chamou sobre falha: o estado
 * da tela e a intencao do usuario, e ela nao se desfaz porque o SQLite
 * engasgou. Falhou, tenta de novo na proxima vez que houver algo pendente.
 */
export function useWriteBehind<T>(perform: (value: T) => Promise<void>) {
  const pending = useRef<{ value: T } | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inFlight = useRef(false);
  const current = useRef<Promise<void> | null>(null);
  const performRef = useRef(perform);
  useEffect(() => {
    performRef.current = perform;
  });

  const flushRef = useRef<() => void>(() => {});

  const flush = useCallback(() => {
    if (timer.current) {
      clearTimeout(timer.current);
      timer.current = null;
    }
    if (inFlight.current) return; // o `finally` abaixo reentra quando voltar
    const next = pending.current;
    if (!next) return;

    pending.current = null;
    inFlight.current = true;
    current.current = performRef.current(next.value).finally(() => {
      inFlight.current = false;
      if (pending.current) flushRef.current();
    });
  }, []);

  useEffect(() => {
    flushRef.current = flush;
  }, [flush]);

  /**
   * Grava agora o que estiver pendente e so resolve quando nao sobrar nada —
   * nem na fila, nem em voo. E o que o "Finalizar treino" espera.
   */
  const settle = useCallback(async () => {
    flush();
    while (inFlight.current || pending.current) {
      if (current.current) await current.current;
      flush();
    }
  }, [flush]);

  const schedule = useCallback(
    (value: T) => {
      pending.current = { value };
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(flush, COMMIT_DELAY);
    },
    [flush],
  );

  /**
   * Corrige a escrita que ainda nao terminou: com uma pendente ou em voo, o
   * valor novo entra no lugar dela ou logo depois. Sem nenhuma, nao faz nada.
   *
   * Para quem so grava em certos momentos e ainda edita entre eles: a escrita
   * em curso leva o estado de quando foi pedida, e uma edicao feita antes de
   * ela voltar ficaria fora do banco (ver as series em `session/[id].tsx`).
   */
  const amend = useCallback(
    (value: T) => {
      if (inFlight.current || pending.current) schedule(value);
    },
    [schedule],
  );

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (state) => {
      if (state !== 'active') flush();
    });
    return () => {
      subscription.remove();
      flush();
    };
  }, [flush]);

  /**
   * Joga fora o que ainda nao foi gravado. So para quando o exercicio SAI da
   * tela (pular, remover): ai a escrita pendente ja nao descreve nada que o
   * usuario queira, e o flush do unmount a gravaria por cima da remocao.
   */
  const discard = useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
    pending.current = null;
  }, []);

  return { schedule, amend, flush, discard, settle };
}
