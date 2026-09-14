import { Pressable, StyleSheet, View } from 'react-native';

import { formatWeight } from '@/domain/volume';
import { colors, hitSlop, radius, spacing, surfaces } from '@/theme/tokens';

import { Stepper } from './Stepper';
import { Meta } from './Text';
import { TrashIcon } from './icons';

type Props = {
  /** 1-based, so para exibir — a posicao no array, nao o `setIndex` guardado
   *  (que pode ter buraco se uma serie do meio foi removida ja concluida). */
  index: number;
  reps: number;
  weightKg: number;
  onChangeReps: (reps: number) => void;
  onChangeWeight: (weightKg: number) => void;
  /** Omitido quando e a unica serie do exercicio — sempre sobra pelo menos uma. */
  onRemove?: () => void;
};

/**
 * Uma serie dentro do exercicio expandido: reps e carga proprios, ajustaveis
 * independente das demais series do mesmo exercicio.
 *
 * Reusa o `Stepper` em `layout="row"` duas vezes — o mesmo controle e o mesmo
 * gesto do `TargetsEditor`, so que um par por serie em vez de um so para o
 * exercicio inteiro. Empilhados, e nao lado a lado: dois `Stepper` ocupam
 * ~276px de controles cada, e a area util do card e ~310px — a mesma conta que
 * ja mantinha `TargetsEditor` empilhado em vez de numa linha so.
 *
 * Este componente nao sabe se o toque grava na hora ou fica so no rascunho —
 * quem decide isso e a tela (`StrengthExerciseCard`, `app/session/[id].tsx`),
 * pela mesma regra que ja valia para o exercicio inteiro: mexer no stepper NAO
 * grava a menos que o exercicio ja esteja concluido.
 */
export function SetRow({ index, reps, weightKg, onChangeReps, onChangeWeight, onRemove }: Props) {
  return (
    <View style={styles.row}>
      <View style={styles.header}>
        <Meta>{`SÉRIE ${index}`}</Meta>
        {onRemove ? (
          <Pressable hitSlop={hitSlop} onPress={onRemove}>
            <TrashIcon size={14} color={colors.textSecondary} />
          </Pressable>
        ) : null}
      </View>

      <Stepper layout="row" label="REPS" value={reps} min={1} max={100} onChange={onChangeReps} />
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
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.xs,
  },
});
