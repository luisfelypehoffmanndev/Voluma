import { useCallback, useEffect, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import type { Targets } from '@/domain/types';
import { spacing } from '@/theme/tokens';

import { Stepper } from './Stepper';

/** Tempo de mao parada antes de gravar. Curto o bastante para nao se perder ao
 *  sair da tela, longo o bastante para um ajuste de 3 toques virar uma escrita. */
const COMMIT_DELAY = 400;

const formatWeight = (value: number): string =>
  Number.isInteger(value) ? String(value) : value.toFixed(1).replace('.', ',');

type Props = {
  value: Targets;
  onCommit: (targets: Targets) => void;
  /**
   * Muda quando o destino da gravacao muda — a chave da semana, por exemplo.
   * Ao mudar, a edicao pendente e descartada e a tela aceita o valor novo na
   * hora: navegar para outra semana com um ajuste no meio nao pode carregar os
   * numeros da semana anterior nem gravar neles.
   */
  resetKey?: string;
};

/**
 * Alvos de um exercicio: series, reps e carga.
 *
 * Os tres ficam empilhados, um por linha. Lado a lado eles nao cabem — cada
 * stepper pede 138px e a area util do card e ~310px num telefone comum, entao o
 * terceiro era cortado pelo `overflow: hidden` do Card.
 *
 * O valor exibido vive aqui, em estado local, e so desce para o banco depois que
 * a mao para. Antes cada toque gravava e recarregava, e o proximo toque somava em
 * cima do valor antigo que ainda estava na tela: dois toques rapidos no + viravam
 * um so. Os tres campos sao gravados juntos porque o destino grava a linha
 * inteira — commitar um de cada vez reescreveria os outros dois com o valor
 * velho.
 *
 * O componente nao sabe onde grava: quem chama decide se o destino e o plano do
 * dia ou o ajuste de uma semana. Foi assim que o eixo de semana entrou sem
 * mexer em nada da mecanica de debounce abaixo, que existe por causa de tres
 * bugs reais.
 */
export function TargetsEditor({ value, onCommit, resetKey }: Props) {
  const [targets, setTargets] = useState(value);

  const dirty = useRef(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const latest = useRef(targets);
  latest.current = targets;

  const commitRef = useRef(onCommit);
  commitRef.current = onCommit;

  // Enquanto ha edicao pendente o banco esta atrasado em relacao a tela; aceitar
  // o valor dele aqui faria o numero voltar sozinho no meio do ajuste.
  useEffect(() => {
    if (dirty.current) return;
    setTargets(value);
  }, [value.sets, value.reps, value.weightKg]);

  // Trocar de semana descarta a edicao pendente em vez de grava-la: o commit
  // atrasado cairia na semana nova, com os numeros da antiga.
  useEffect(() => {
    if (timer.current) {
      clearTimeout(timer.current);
      timer.current = null;
    }
    dirty.current = false;
    setTargets(value);
    // `value` de proposito fora das dependencias: so a troca de destino reseta.
  }, [resetKey]);

  const commit = useCallback(() => {
    dirty.current = false;
    timer.current = null;
    commitRef.current(latest.current);
  }, []);

  // Sair da tela no meio do ajuste nao pode perder o ultimo toque.
  useEffect(
    () => () => {
      if (!timer.current) return;
      clearTimeout(timer.current);
      commit();
    },
    [commit],
  );

  const change = (patch: Partial<Targets>) => {
    setTargets((current) => ({ ...current, ...patch }));
    dirty.current = true;
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(commit, COMMIT_DELAY);
  };

  return (
    <View style={styles.targets}>
      <Stepper
        layout="row"
        label="SÉRIES"
        value={targets.sets}
        min={1}
        max={12}
        onChange={(sets) => change({ sets })}
      />
      <Stepper
        layout="row"
        label="REPS"
        value={targets.reps}
        min={1}
        max={100}
        onChange={(reps) => change({ reps })}
      />
      <Stepper
        layout="row"
        label="PESO"
        value={targets.weightKg}
        step={2.5}
        suffix="kg"
        editable
        format={formatWeight}
        onChange={(weightKg) => change({ weightKg })}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  targets: {
    marginTop: -spacing.xs,
  },
});
