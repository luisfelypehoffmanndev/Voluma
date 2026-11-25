import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * Os dois caminhos para mudar um numero no meio do treino, fora do desenho.
 *
 * Moram aqui, e nao dentro do `Stepper`, porque a serie da vez (o bloco heroi
 * de `SetRow`) mostra o numero grande e os botoes separados — o mesmo
 * comportamento com outro desenho. Duas copias da regra de repeticao divergiam
 * na primeira correcao.
 */

/** Quanto o dedo precisa ficar parado antes de a repeticao comecar. */
const HOLD_DELAY = 380;
/** O primeiro intervalo de repeticao, e o mais curto que ela chega. */
const REPEAT_START = 160;
const REPEAT_FLOOR = 45;
/** Quanto cada repeticao encurta a seguinte: acelera sem saltar. */
const REPEAT_DECAY = 0.82;

/**
 * Segurar repete, e acelera.
 *
 * Ir de 60 para 80 kg em passos de 2,5 eram oito toques secos. Segurando, o
 * passo repete cada vez mais rapido e chega la em menos de um segundo. Sem
 * haptico nas repeticoes: o §10 proibe vibrar no stepper, e aqui seriam dezenas
 * de pulsos.
 *
 * `apply` recebe o valor ATUAL e devolve o proximo. O valor corrente vive num
 * ref, e nao vem da prop a cada repeticao: o pai so re-renderiza depois do
 * `onChange`, e repetir a partir da prop velha somaria o mesmo passo varias
 * vezes sobre o mesmo numero.
 *
 * O toque simples continua sendo UM passo, e e dado no `onPress` (na subida do
 * dedo), como qualquer botao. Se a repeticao chegou a disparar, a subida do
 * dedo nao soma mais um.
 */
export function useRepeatPress(
  value: number,
  apply: (current: number) => number,
  onChange: (next: number) => void,
) {
  const current = useRef(value);
  const applyRef = useRef(apply);
  const changeRef = useRef(onChange);
  useEffect(() => {
    current.current = value;
    applyRef.current = apply;
    changeRef.current = onChange;
  });

  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const repeated = useRef(false);

  const stop = useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
  }, []);

  useEffect(() => stop, [stop]);

  const step = useCallback(() => {
    const next = applyRef.current(current.current);
    if (next === current.current) return false;
    current.current = next;
    changeRef.current(next);
    return true;
  }, []);

  const onPressIn = useCallback(() => {
    repeated.current = false;
    stop();
    const tick = (interval: number) => {
      timer.current = setTimeout(() => {
        repeated.current = true;
        // Chegou no limite (min/max): para de agendar.
        if (!step()) return;
        tick(Math.max(REPEAT_FLOOR, interval * REPEAT_DECAY));
      }, interval);
    };
    timer.current = setTimeout(() => {
      repeated.current = true;
      if (step()) tick(REPEAT_START);
    }, HOLD_DELAY);
  }, [step, stop]);

  const onPress = useCallback(() => {
    if (!repeated.current) step();
  }, [step]);

  return { onPressIn, onPressOut: stop, onPress };
}

/**
 * Tocar no numero abre o teclado numerico, para o salto grande.
 *
 * `null` = nao esta editando. O ref anda junto porque `onSubmitEditing` e
 * `onBlur` disparam os dois no mesmo toque do "done": sem ele o segundo ainda
 * enxergaria o rascunho antigo e gravaria duas vezes.
 */
export function useNumberDraft({
  value,
  format,
  integer,
  clamp,
  onCommit,
}: {
  value: number;
  format: (value: number) => string;
  integer: boolean;
  clamp: (value: number) => number;
  onCommit: (value: number) => void;
}) {
  const [draft, setDraft] = useState<string | null>(null);
  const draftRef = useRef<string | null>(null);
  const setBoth = useCallback((next: string | null) => {
    draftRef.current = next;
    setDraft(next);
  }, []);

  // O rascunho parte do valor guardado, nao do formatado: se o formato
  // arredondasse, confirmar sem mexer gravaria outro numero. A excecao e quando
  // a caixa nem mostra numero — o "—" da idade em branco no perfil —: ai comeca
  // vazio, porque o valor interno por tras (-1) nao e algo que alguem deva ver.
  const start = () => {
    const shown = format(value).replace(',', '.');
    setBoth(Number.isFinite(Number(shown)) ? String(value).replace('.', ',') : '');
  };

  const commit = () => {
    const current = draftRef.current;
    if (current === null) return;
    setBoth(null);
    // Virgula porque e o que o teclado pt-BR entrega e o que `formatWeight` mostra.
    const parsed = Number(current.trim().replace(',', '.'));
    // Campo vazio ou lixo digitado: mantem o valor que ja estava, nao zera.
    if (current.trim() === '' || !Number.isFinite(parsed)) return;
    const rounded = integer ? Math.trunc(parsed) : Math.round(parsed * 100) / 100;
    onCommit(clamp(rounded));
  };

  return { draft, start, change: setBoth, commit };
}
