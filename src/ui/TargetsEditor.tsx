import { useCallback, useEffect, useRef, useState } from 'react';
import { StyleSheet, View, type LayoutChangeEvent } from 'react-native';

import { formatDistance, formatPace } from '@/domain/run';
import { formatWeight } from '@/domain/volume';
import type { ExerciseKind, Targets } from '@/domain/types';
import { colors, spacing } from '@/theme/tokens';

import { MovementFigure } from './MovementFigure';
import { CONTROLS_WIDTH, Stepper } from './Stepper';
import { Meta } from './Text';

/** Tempo de mao parada antes de gravar. Curto o bastante para nao se perder ao
 *  sair da tela, longo o bastante para um ajuste de 3 toques virar uma escrita.
 *
 *  Exportado porque o editor de series da tela de sessao reusa o mesmo numero
 *  para o proprio debounce por serie — o mesmo motivo de existir, so que um
 *  timer por linha em vez de um so para o exercicio inteiro. */
export const COMMIT_DELAY = 400;

/** Respiro entre a figura e o que vem dos dois lados dela. */
const FIGURE_GAP = spacing.md;

/**
 * Os limites da figura que ocupa o vao entre as duas colunas.
 *
 * Abaixo de `MIN` ela nao e desenhada: tela estreita ou fonte do sistema
 * ampliada comem o vao, e uma silhueta de 40px espremida entre numeros nao
 * demonstra movimento nenhum — vira sujeira. `MAX` existe porque o card tem
 * `overflow: hidden` e porque o brief pede respiro, nao preenchimento.
 */
const FIGURE_MIN = 56;
const FIGURE_MAX = 112;

/**
 * O lado da figura que cabe no vao, ou 0 quando nao vale a pena desenhar.
 *
 * `labelWidth` e medido (ver `onLabelWidth` no `Stepper`), nao estimado: o
 * rotulo mais longo muda por modalidade — `DISTÂNCIA` na corrida contra
 * `SÉRIES` na musculacao — e ainda cresce com a fonte do sistema. Chutar a
 * largura deixava a figura fora do centro do vao, que foi como isto nasceu.
 */
function figureSize(width: number, height: number, labelWidth: number): number {
  // A altura entra na conta por causa da corrida: dois steppers em vez de tres
  // dao 88px de vao vertical, e uma figura de 112 vazaria o card.
  const side = Math.min(width - labelWidth - CONTROLS_WIDTH - FIGURE_GAP * 2, height);
  if (side < FIGURE_MIN) return 0;
  return Math.min(side, FIGURE_MAX);
}

type Props = {
  value: Targets;
  /** `run` troca series/reps/carga por distancia e tempo. */
  kind?: ExerciseKind;
  onCommit: (targets: Targets) => void;
  /**
   * O slug da figura do movimento, de `artSlugFor(name)`. Sem ele nada e
   * desenhado.
   *
   * Opcional porque nem todo lugar que edita alvos quer a figura, e porque
   * exercicio criado a mao nao tem uma. Quem decide e a tela.
   */
  figureSlug?: string | null;
  /**
   * Muda quando o destino da gravacao muda — a chave da semana, por exemplo.
   * Ao mudar, a edicao pendente e descartada e a tela aceita o valor novo na
   * hora: navegar para outra semana com um ajuste no meio nao pode carregar os
   * numeros da semana anterior nem gravar neles.
   */
  resetKey?: string;
};

/**
 * Alvos de um exercicio: series, reps e carga; distancia e tempo na corrida.
 *
 * Os campos ficam empilhados, um por linha. Lado a lado eles nao cabem — cada
 * stepper pede 138px e a area util do card e ~310px num telefone comum, entao o
 * terceiro era cortado pelo `overflow: hidden` do Card.
 *
 * O valor exibido vive aqui, em estado local, e so desce para o banco depois que
 * a mao para. Antes cada toque gravava e recarregava, e o proximo toque somava em
 * cima do valor antigo que ainda estava na tela: dois toques rapidos no + viravam
 * um so. Os campos sao gravados juntos porque o destino grava a linha inteira —
 * commitar um de cada vez reescreveria os outros com o valor velho.
 *
 * O componente nao sabe onde grava: quem chama decide se o destino e o plano do
 * dia ou o ajuste de uma semana. Foi assim que o eixo de semana entrou sem
 * mexer em nada da mecanica de debounce abaixo, que existe por causa de tres
 * bugs reais.
 */
export function TargetsEditor({
  value,
  kind = 'strength',
  onCommit,
  resetKey,
  figureSlug,
}: Props) {
  const [targets, setTargets] = useState(value);

  // Guarda a caixa medida, nao o tamanho ja resolvido: assim trocar de exercicio
  // (ou renomear um) recalcula a figura na hora, sem esperar um novo layout.
  const [box, setBox] = useState({ width: 0, height: 0 });
  const measure = (event: LayoutChangeEvent) => {
    const { width, height } = event.nativeEvent.layout;
    setBox((current) =>
      current.width === width && current.height === height ? current : { width, height },
    );
  };

  // O maior rotulo manda: as linhas sao independentes, mas a figura e uma so e
  // precisa caber ao lado da mais larga delas.
  const [labelWidth, setLabelWidth] = useState(0);
  const reportLabel = useCallback(
    (width: number) => setLabelWidth((current) => (width > current ? width : current)),
    [],
  );

  const size = figureSlug ? figureSize(box.width, box.height, labelWidth) : 0;

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
  }, [value.sets, value.reps, value.weightKg, value.distanceKm, value.durationMin]);

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

  if (kind === 'run') {
    const pace = formatPace(targets.distanceKm, targets.durationMin);
    return (
      <View style={styles.targets}>
        <View style={styles.rows} onLayout={measure}>
          <Stepper
            layout="row"
            onLabelWidth={reportLabel}
            label="DISTÂNCIA"
            value={targets.distanceKm}
            step={0.5}
            min={0}
            max={200}
            suffix="km"
            editable
            format={formatDistance}
            onChange={(distanceKm) => change({ distanceKm })}
          />
          <Stepper
            layout="row"
            onLabelWidth={reportLabel}
            label="TEMPO"
            value={targets.durationMin}
            step={1}
            min={0}
            max={600}
            suffix="min"
            editable
            integer
            onChange={(durationMin) => change({ durationMin })}
          />

          {/* A figura mora no vao que o `space-between` de cada linha ja deixava
              vazio, entre a coluna dos rotulos e a dos controles. Absoluta porque
              um wrapper em linha encolheria os steppers, e o comentario do topo
              registra que eles foram empilhados justamente por falta de largura.

              `pointerEvents="none"` nao e detalhe: a caixa do numero e tocavel
              onde `editable`, e uma camada por cima engoliria esse toque. */}
          {size > 0 && figureSlug ? (
            <View pointerEvents="none" style={[styles.figure, { left: labelWidth + FIGURE_GAP }]}>
              <MovementFigure slug={figureSlug} size={size} animated />
            </View>
          ) : null}
        </View>

        {/* Ritmo e derivado, nunca gravado: some quando falta distancia ou tempo.
            Fica FORA do wrapper medido: dentro dele a figura centralizaria
            contando a altura do ritmo junto, e desceria por cima do texto. */}
        {pace ? <Meta style={styles.pace}>{`ritmo ${pace} /km`}</Meta> : null}
      </View>
    );
  }

  return (
    <View style={styles.targets}>
      <View style={styles.rows} onLayout={measure}>
        <Stepper
          layout="row"
          onLabelWidth={reportLabel}
          label="SÉRIES"
          value={targets.sets}
          min={1}
          max={12}
          editable
          integer
          onChange={(sets) => change({ sets })}
        />
        <Stepper
          layout="row"
          onLabelWidth={reportLabel}
          label="REPS"
          value={targets.reps}
          min={1}
          max={100}
          editable
          integer
          onChange={(reps) => change({ reps })}
        />
        <Stepper
          layout="row"
          onLabelWidth={reportLabel}
          label="PESO"
          value={targets.weightKg}
          step={2.5}
          suffix="kg"
          editable
          format={formatWeight}
          onChange={(weightKg) => change({ weightKg })}
        />

        {/* A figura mora no vao que o `space-between` de cada linha ja deixava
            vazio, entre a coluna dos rotulos e a dos controles. Absoluta porque
            um wrapper em linha encolheria os steppers, e o comentario do topo
            registra que eles foram empilhados justamente por falta de largura.

            `pointerEvents="none"` nao e detalhe: a caixa do numero e tocavel
            onde `editable`, e uma camada por cima engoliria esse toque. */}
        {size > 0 && figureSlug ? (
          <View pointerEvents="none" style={[styles.figure, { left: labelWidth + FIGURE_GAP }]}>
            <MovementFigure slug={figureSlug} size={size} animated />
          </View>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  targets: {
    marginTop: -spacing.xs,
  },
  /** So as linhas de stepper: e a caixa que a figura mede e sobre a qual centra. */
  rows: {
    position: 'relative',
  },
  /** `left` vem medido, na propria tag: depende da largura do maior rotulo. */
  figure: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    right: CONTROLS_WIDTH + FIGURE_GAP,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pace: {
    marginTop: spacing.sm,
    color: colors.textSecondary,
  },
});
