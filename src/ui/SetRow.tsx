import { Pressable, StyleSheet, View } from 'react-native';

import { formatWeight } from '@/domain/volume';
import { colors, fonts, fontSize, radius, spacing, surfaces } from '@/theme/tokens';

import { CheckCell } from './CheckCell';
import { Stepper } from './Stepper';
import { Label, Meta, Mono } from './Text';

type Props = {
  /** 1-based, so para exibir — a posicao no array, nao o `setIndex` guardado
   *  (que pode ter buraco se uma serie do meio foi removida ja concluida). */
  index: number;
  reps: number;
  weightKg: number;
  done: boolean;
  /**
   * Esta e a serie da vez: a primeira nao marcada do exercicio.
   *
   * Ganha o contorno accent e os controles de ajuste. E o unico elemento com
   * accent da sessao fora das caixas marcadas — ver Design/design.md §2.
   */
  isNext: boolean;
  /** O que foi feito nesta serie no ultimo treino deste exercicio. */
  previous?: { reps: number; weightKg: number } | null;
  onToggle: () => void;
  onChangeReps: (reps: number) => void;
  onChangeWeight: (weightKg: number) => void;
  /** Copia o que foi feito na ultima vez para esta serie. */
  onCopyPrevious?: () => void;
};

/**
 * Uma serie do exercicio: o que fazer, e a caixa que diz que foi feito.
 *
 * **A serie e a unidade de registro**, nao o exercicio. Antes havia uma caixa
 * por exercicio e as series eram so campos: no meio do treino nada na tela
 * dizia em que serie o usuario estava, e era essa a queixa de "nao entendo o
 * que fazer". Agora a linha nao marcada mais acima e, literalmente, a proxima.
 *
 * Os `+`/`−` aparecem SO na serie da vez. Quem só confirma o que estava
 * previsto toca na caixa e pronto; quem mudou a carga ajusta ali, sem que as
 * outras cinco linhas carreguem controles que ninguem vai tocar agora. E o
 * "acao rapida primeiro, correcao depois" dos apps da categoria.
 */
export function SetRow({
  index,
  reps,
  weightKg,
  done,
  isNext,
  previous,
  onToggle,
  onChangeReps,
  onChangeWeight,
  onCopyPrevious,
}: Props) {
  return (
    <View style={[styles.row, isNext && styles.next]}>
      <View style={styles.line}>
        <Label style={[styles.index, isNext && styles.indexNext]}>{`SÉRIE ${index}`}</Label>

        {/* Em mono, e lado a lado: a serie e uma linha so, como nos apps da
            categoria. Empilhado, cada serie virava um bloco alto e a proxima
            saia da tela. */}
        <View style={styles.values}>
          <Mono style={styles.value}>{`${reps} × ${formatWeight(weightKg)}`}</Mono>
          <Label style={styles.unit}>kg</Label>
        </View>

        <CheckCell checked={done} onPress={onToggle} />
      </View>

      {/* A ultima vez naquela MESMA serie, nao a media do exercicio: e o que
          responde "quanto eu levantei aqui?" sem sair da tela. Tocar copia. */}
      {previous !== undefined ? (
        <Pressable
          disabled={!previous || !onCopyPrevious}
          onPress={onCopyPrevious}
          accessibilityLabel={
            previous
              ? `Repetir ${previous.reps} por ${formatWeight(previous.weightKg)} quilos da última vez`
              : undefined
          }
          style={styles.previous}
        >
          <Meta>
            {previous
              ? `última vez · ${previous.reps} × ${formatWeight(previous.weightKg)} kg`
              : 'última vez · —'}
          </Meta>
        </Pressable>
      ) : null}

      {isNext ? (
        <View style={styles.controls}>
          <Stepper
            layout="row"
            label="REPS"
            value={reps}
            min={1}
            max={100}
            editable
            integer
            onChange={onChangeReps}
          />
          <Stepper
            layout="row"
            label="PESO"
            value={weightKg}
            step={2.5}
            suffix="kg"
            editable
            format={formatWeight}
            onChange={onChangeWeight}
          />
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  /** Nivel 2 dentro do card — mesma escada que `surfaces.raised` documenta
   *  para "linhas de serie". */
  row: {
    backgroundColor: surfaces.raised,
    borderRadius: radius.inner,
    padding: spacing.md,
    marginBottom: spacing.sm,
    // A borda existe em toda serie, transparente por padrao: so aparecendo na
    // da vez, o conteudo andaria 1px ao virar a proxima (§6).
    borderWidth: 1,
    borderColor: 'transparent',
  },
  next: {
    borderColor: colors.accent,
  },
  line: {
    flexDirection: 'row',
    alignItems: 'center',
    // 48 e o alvo confortavel para o polegar; a caixa marcavel continua com a
    // mesma caixa visual e cresce so o alvo (ver `CheckCell`).
    minHeight: 48,
    gap: spacing.md,
  },
  index: {
    fontFamily: fonts.sansMedium,
    width: 62,
  },
  indexNext: {
    color: colors.accent,
  },
  values: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'flex-end',
    gap: 3,
  },
  value: {
    fontFamily: fonts.monoLight,
    fontSize: fontSize.numberSm,
  },
  unit: {
    color: colors.textSecondary,
  },
  previous: {
    paddingTop: 2,
    paddingBottom: spacing.xs,
  },
  controls: {
    marginTop: spacing.xs,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.divider,
    paddingTop: spacing.xs,
  },
});
