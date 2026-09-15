import { StyleSheet, View } from 'react-native';

import { formatWeight } from '@/domain/volume';
import { colors, fontSize, spacing } from '@/theme/tokens';
import { Card } from '@/ui/Card';
import { CountingStat } from '@/ui/CountingStat';
import { Stepper } from '@/ui/Stepper';
import { Body, Meta, Mono } from '@/ui/Text';

export type VolumeDraft = { sets: number; reps: number; weightKg: number };

/**
 * "Aprende fazendo": em vez de explicar o que e volume, o usuario monta o dele.
 *
 * E a metrica central do app e a que da nome a ele; entender "series × reps ×
 * peso" com a propria mao vale mais que um paragrafo. O numero grande conta ate
 * o novo valor a cada toque — a mesma contagem do registro de treino, aqui
 * dentro da excecao do onboarding (§10).
 *
 * Nada disso e gravado: e um exemplo, nao um treino.
 */
export function LearnVolume({
  value,
  onChange,
}: {
  value: VolumeDraft;
  onChange: (next: VolumeDraft) => void;
}) {
  const volume = value.sets * value.reps * value.weightKg;

  return (
    <View style={styles.section}>
      <Body style={styles.heading}>Volume é o que você levantou</Body>
      <Meta>Monte o seu último supino e veja a conta.</Meta>

      <View style={styles.result}>
        <CountingStat kg={volume} size={fontSize.numberLg} />
        <Mono style={styles.formula}>
          {`${value.sets} × ${value.reps} × ${formatWeight(value.weightKg)} kg`}
        </Mono>
      </View>

      <Card>
        <Stepper
          label="Séries"
          layout="row"
          value={value.sets}
          min={1}
          max={10}
          onChange={(sets) => onChange({ ...value, sets })}
        />
        <View style={styles.divider} />
        <Stepper
          label="Repetições"
          layout="row"
          value={value.reps}
          min={1}
          max={30}
          onChange={(reps) => onChange({ ...value, reps })}
        />
        <View style={styles.divider} />
        <Stepper
          label="Peso"
          layout="row"
          value={value.weightKg}
          step={2.5}
          min={0}
          max={400}
          suffix="kg"
          format={formatWeight}
          onChange={(weightKg) => onChange({ ...value, weightKg })}
        />
      </Card>

      <Meta>É esse número que o Voluma acompanha, treino a treino e semana a semana.</Meta>
    </View>
  );
}

const styles = StyleSheet.create({
  section: {
    gap: spacing.md,
  },
  heading: {
    fontSize: fontSize.title,
    marginBottom: spacing.xs,
  },
  result: {
    paddingVertical: spacing.lg,
    gap: spacing.xs,
  },
  formula: {
    color: colors.textSecondary,
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: colors.divider,
    marginVertical: spacing.md,
  },
});
