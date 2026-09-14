import { useFocusEffect, useIsFocused } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { create } from 'zustand';

/**
 * Camada de leitura sobre o SQLite.
 *
 * Nao ha cache de objetos: o SQLite local ja e o cache. O que existe aqui e um
 * contador de versao global — qualquer escrita chama `bumpData()` e toda tela
 * montada recarrega sua propria consulta. Para um app de um usuario so, isso
 * evita a complexidade de invalidacao por chave sem custo perceptivel.
 */

type DataVersionState = {
  version: number;
  bump: () => void;
};

const useDataVersion = create<DataVersionState>((set) => ({
  version: 0,
  bump: () => set((state) => ({ version: state.version + 1 })),
}));

/** Chamar depois de qualquer escrita no repositorio. */
export const bumpData = () => useDataVersion.getState().bump();

export type QueryResult<T> = {
  data: T | null;
  loading: boolean;
  reload: () => void;
};

/**
 * Roda `query` no mount, ao voltar o foco para a tela e sempre que os dados
 * mudarem.
 *
 * `query` PRECISA vir memoizada com `useCallback` no chamador, com os proprios
 * parametros nas deps — e a identidade dela que dispara a reconsulta quando o
 * calendario troca de mes ou a tela troca de rotina.
 */
export function useQuery<T>(query: () => Promise<T>): QueryResult<T> {
  const version = useDataVersion((state) => state.version);
  const isFocused = useIsFocused();
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [localVersion, setLocalVersion] = useState(0);
  const settled = useRef(false);
  const focused = useRef(false);

  // Lido dentro do efeito sem entrar nas deps dele: um `bumpData` de OUTRA
  // tela nao pode disparar consulta aqui enquanto esta esta fora de foco (a
  // aba de baixo ja fica montada depois da primeira visita, e sem este
  // corte toda escrita no app faria as quatro abas consultarem o SQLite ao
  // mesmo tempo, competindo pelo mesmo banco por telas que ninguem ve agora).
  // O efeito de foco logo abaixo ja recarrega ao voltar, `bumpData` ou nao —
  // entao nao e preciso lembrar que ficou desatualizada, so nao correr atras
  // enquanto ninguem olha.
  const isFocusedRef = useRef(isFocused);
  isFocusedRef.current = isFocused;

  useEffect(() => {
    if (!isFocusedRef.current) return;

    let cancelled = false;

    // `loading` so vale para a primeira consulta. Nas recargas o dado anterior
    // continua na tela enquanto a nova chega: as telas fazem
    // `if (loading) return <placeholder>`, e como toda troca de aba dispara uma
    // recarga pelo foco, levantar esta flag de novo fazia a tela piscar para o
    // placeholder e voltar. Um dado alguns milissegundos velho e melhor que
    // isso.
    if (!settled.current) setLoading(true);

    query()
      .then((result) => {
        if (!cancelled) setData(result);
      })
      .finally(() => {
        if (cancelled) return;
        settled.current = true;
        setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [query, version, localVersion]);

  // Recarrega ao voltar para a tela: o usuario pode ter registrado series em
  // outra rota e voltado com o gesto de swipe.
  useFocusEffect(
    useCallback(() => {
      // O primeiro foco acontece junto com o mount, cuja consulta o efeito
      // acima ja disparou. Sem este guarda toda tela consulta o banco duas
      // vezes ao abrir.
      if (!focused.current) {
        focused.current = true;
        return;
      }
      setLocalVersion((current) => current + 1);
    }, []),
  );

  return { data, loading, reload: () => setLocalVersion((current) => current + 1) };
}
