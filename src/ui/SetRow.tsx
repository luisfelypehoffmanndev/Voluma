import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { formatWeight } from '@/domain/volume';
import { fonts, layout, shape, spacing, theme } from '@/theme/tokens';

import { Button } from './Button';
import { CheckCell } from './CheckCell';
import { MinusIcon, PlusIcon } from './icons';
import { PressableSurface } from './PressableSurface';
import { Body, Label, Meta } from './Text';
import { useNumberDraft, useRepeatPress } from './useNumberInput';

/** O passo de carga por toque. Segurar repete e acelera (`useRepeatPress`). */
const WEIGHT_STEP = 2.5;
const REPS_MAX = 100;
const WEIGHT_MAX = 999;
/** Alvo de toque durante o treino (Design/design.md §4): a mao esta cansada. */
const STEP_SIZE = 48;

type Props = {
  /** 1-based, so para exibir. */
  index: number;
  total: number;
  reps: number;
  weightKg: number;
  done: boolean;
  /** `hero`: a serie da vez, com os steppers e o botao. `row`: uma linha. */
  mode: 'row' | 'hero';
  /** A serie da vez do exercicio da vez: so ela ganha o botao principal. */
  accent?: boolean;
  /** O que foi feito nesta serie no ultimo treino deste exercicio. */
  previous?: { reps: number; weightKg: number } | null;
  onToggle: () => void;
  onChangeReps: (reps: number) => void;
  onChangeWeight: (weightKg: number) => void;
  onCopyPrevious?: () => void;
};

/**
 * Uma serie do exercicio, na linguagem Blink (Design/design.md §7, Sessao).
 *
 * A serie da vez e um bloco com dois steppers grandes — carga e reps, ja
 * preenchidos com o valor previsto — e o botao largo "Concluir série". As
 * outras sao linhas: feitas com o check verde, futuras apagadas.
 */
export function SetRow(props: Props) {
  return props.mode === 'hero' ? <HeroSet {...props} /> : <TableSet {...props} />;
}

function TableSet({ index, reps, weightKg, done, onToggle }: Props) {
  return (
    <View style={styles.row}>
      <Body style={[styles.rowLabel, !done && styles.future]}>{`Série ${index}`}</Body>
      <Text style={[styles.rowValue, !done && styles.future]} maxFontSizeMultiplier={1.3}>
        {`${formatWeight(weightKg)} kg × ${reps}`}
      </Text>
      <CheckCell
        checked={done}
        onPress={onToggle}
        accessibilityLabel={`Série ${index}, ${done ? 'feita, tocar para desmarcar' : 'marcar como feita'}`}
      />
    </View>
  );
}

function HeroSet({
  index,
  total,
  reps,
  weightKg,
  accent = false,
  previous,
  onToggle,
  onChangeReps,
  onChangeWeight,
  onCopyPrevious,
}: Props) {
  const round = (value: number) => Math.round(value * 100) / 100;

  return (
    <View style={styles.hero}>
      <Label style={styles.heroLabel}>{`SÉRIE ${index} DE ${total}`}</Label>

      {previous ? (
        <Pressable onPress={onCopyPrevious} disabled={!onCopyPrevious} accessibilityRole="button">
          <Meta style={styles.center}>
            {`Última: ${formatWeight(previous.weightKg)} kg × ${previous.reps}`}
          </Meta>
        </Pressable>
      ) : null}

      <View style={styles.steppers}>
        <BigStepper
          label="CARGA"
          unit="kg"
          value={weightKg}
          format={formatWeight}
          integer={false}
          min={0}
          max={WEIGHT_MAX}
          minus={(v) => Math.max(0, round(v - WEIGHT_STEP))}
          plus={(v) => Math.min(WEIGHT_MAX, round(v + WEIGHT_STEP))}
          onChange={onChangeWeight}
        />
        <BigStepper
          label="REPS"
          unit=""
          value={reps}
          format={String}
          integer
          min={1}
          max={REPS_MAX}
          minus={(v) => Math.max(1, v - 1)}
          plus={(v) => Math.min(REPS_MAX, v + 1)}
          onChange={onChangeReps}
        />
      </View>

      <Button
        variant={accent ? 'primary' : 'inline'}
        label="Concluir série"
        onPress={onToggle}
      />
    </View>
  );
}

/** Numero grande no centro, − e + embaixo. Tocar no numero abre o teclado. */
function BigStepper({
  label,
  unit,
  value,
  format,
  integer,
  min,
  max,
  minus,
  plus,
  onChange,
}: {
  label: string;
  unit: string;
  value: number;
  format: (value: number) => string;
  integer: boolean;
  min: number;
  max: number;
  minus: (value: number) => number;
  plus: (value: number) => number;
  onChange: (value: number) => void;
}) {
  const draft = useNumberDraft({
    value,
    format,
    integer,
    clamp: (next) => Math.min(max, Math.max(min, next)),
    onCommit: onChange,
  });
  const down = useRepeatPress(value, minus, onChange);
  const up = useRepeatPress(value, plus, onChange);
  const name = label.toLowerCase();

  return (
    <View style={styles.stepper}>
      <Label>{label}</Label>
      <Pressable
        onPress={draft.start}
        disabled={draft.draft !== null}
        accessibilityLabel={`${name}, ${format(value)} ${unit}. Tocar para digitar`}
        style={styles.numberBox}
      >
        {draft.draft === null ? (
          <Text style={styles.number} numberOfLines={1} adjustsFontSizeToFit maxFontSizeMultiplier={1.2}>
            {format(value)}
          </Text>
        ) : (
          <TextInput
            value={draft.draft}
            onChangeText={draft.change}
            onBlur={draft.commit}
            onSubmitEditing={draft.commit}
            keyboardType={integer ? 'number-pad' : 'decimal-pad'}
            returnKeyType="done"
            selectTextOnFocus
            autoFocus
            maxFontSizeMultiplier={1.2}
            style={[styles.number, styles.input]}
          />
        )}
        {unit ? <Meta style={styles.unit}>{unit}</Meta> : null}
      </Pressable>
      <View style={styles.buttons}>
        <StepButton repeat={down} accessibilityLabel={`Diminuir ${name}`}>
          <MinusIcon size={22} color={theme.onSurface} />
        </StepButton>
        <StepButton repeat={up} accessibilityLabel={`Aumentar ${name}`}>
          <PlusIcon size={22} color={theme.onSurface} />
        </StepButton>
      </View>
    </View>
  );
}

type Repeat = ReturnType<typeof useRepeatPress>;

function StepButton({
  repeat,
  accessibilityLabel,
  children,
}: {
  repeat: Repeat;
  accessibilityLabel: string;
  children: React.ReactNode;
}) {
  return (
    <PressableSurface
      feedback="solid"
      borderRadius={shape.control}
      onPress={repeat.onPress}
      onPressIn={repeat.onPressIn}
      onPressOut={repeat.onPressOut}
      accessibilityLabel={accessibilityLabel}
      style={styles.stepButton}
    >
      {children}
    </PressableSurface>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: layout.touch + layout.touchGap,
    gap: spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: theme.outlineVariant,
  },
  rowLabel: {
    flex: 1,
    fontFamily: fonts.sansSemiBold,
  },
  rowValue: {
    fontFamily: fonts.displayBold,
    fontSize: 16,
    color: theme.onSurface,
    fontVariant: ['tabular-nums'],
  },
  future: {
    color: theme.onSurfaceVariant,
  },
  hero: {
    backgroundColor: theme.surfaceContainerHigh,
    borderRadius: shape.card,
    padding: spacing.lg,
    marginVertical: spacing.sm,
    gap: spacing.md,
  },
  heroLabel: {
    textAlign: 'center',
  },
  center: {
    textAlign: 'center',
  },
  steppers: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  stepper: {
    flex: 1,
    alignItems: 'center',
    gap: spacing.sm,
  },
  numberBox: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'center',
    minHeight: 60,
    alignSelf: 'stretch',
  },
  number: {
    fontFamily: fonts.display,
    fontSize: 48,
    lineHeight: 56,
    letterSpacing: -1.4,
    color: theme.onSurface,
    fontVariant: ['tabular-nums'],
    textAlign: 'center',
  },
  input: {
    padding: 0,
    minWidth: 72,
  },
  unit: {
    marginLeft: spacing.xs,
  },
  buttons: {
    flexDirection: 'row',
    gap: layout.touchGap,
  },
  stepButton: {
    width: STEP_SIZE,
    height: STEP_SIZE,
    borderRadius: shape.control,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.surfaceBright,
  },
});
