import { Pressable, StyleSheet, TextInput, View } from 'react-native';

import { formatWeight } from '@/domain/volume';
import { colors, fontSize, fonts, layout, radius, spacing, surfaces } from '@/theme/tokens';

import { Button } from './Button';
import { CheckCell } from './CheckCell';
import { CheckIcon, MinusIcon, PlusIcon } from './icons';
import { PressableSurface } from './PressableSurface';
import { STEP_BUTTON_SIZE } from './Stepper';
import { Body, FONT_SCALE_CAP, Label, Meta, Mono } from './Text';
import { useNumberDraft, useRepeatPress } from './useNumberInput';

/** O passo de carga por toque. Segurar repete e acelera (`useRepeatPress`). */
const WEIGHT_STEP = 2.5;
const REPS_MAX = 100;
const WEIGHT_MAX = 999;

type Props = {
  /** 1-based, so para exibir — a posicao no array, nao o `setIndex` guardado. */
  index: number;
  /** Quantas series o exercicio tem. */
  total: number;
  reps: number;
  weightKg: number;
  done: boolean;
  /**
   * `hero`: a serie da vez — a instrucao, os ajustes e o botao de concluir.
   * `row`: uma linha que diz se a serie esta feita ou falta.
   */
  mode: 'row' | 'hero';
  /**
   * A serie da vez do EXERCICIO da vez. So ela ganha o botao laranja: e o
   * "toque aqui" da tela, e so pode existir em um lugar.
   */
  accent?: boolean;
  /** O que foi feito nesta serie no ultimo treino deste exercicio. */
  previous?: { reps: number; weightKg: number } | null;
  onToggle: () => void;
  onChangeReps: (reps: number) => void;
  onChangeWeight: (weightKg: number) => void;
  /** Copia o que foi feito na ultima vez para esta serie. */
  onCopyPrevious?: () => void;
};

/**
 * Uma serie do exercicio.
 *
 * **Clareza antes de minimalismo** (plano 16, ajuste pos-Onda 0). Um primeiro
 * usuario abriu o treino e nao sabia o que fazer: a tela tinha numeros e uma
 * caixinha, e nada dizia "faca isto, depois toque aqui". Agora a serie da vez
 * diz as duas coisas com palavras — "Faça agora: 8 repetições com 62,5 kg" — e
 * o lugar de tocar e um botao largo com verbo: "Pronto, fiz esta série".
 *
 * As outras series sao linhas que dizem em texto o estado: "feita" ou "falta".
 */
export function SetRow(props: Props) {
  return props.mode === 'hero' ? <HeroSet {...props} /> : <TableSet {...props} />;
}

function TableSet({ index, done, previous, onToggle, onCopyPrevious }: Props) {
  return (
    <View style={styles.row}>
      <View style={styles.rowText}>
        <Body style={done ? undefined : styles.pending}>{`Série ${index}`}</Body>
        {previous !== undefined ? <Previous previous={previous} onCopy={onCopyPrevious} /> : null}
      </View>
      <Meta style={done ? styles.doneTag : undefined}>{done ? 'feita' : 'falta'}</Meta>
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
    <View style={[styles.hero, accent && styles.heroAccent]}>
      <Label style={styles.now}>FAÇA AGORA</Label>
      {/* A instrucao em frase: o numero sozinho ("62,5 × 8") pede que a pessoa
          saiba ler a notacao; a frase nao pede nada. */}
      <Body style={styles.instruction} maxFontSizeMultiplier={1.6}>
        <Body style={styles.instructionStrong}>{`${reps} repetições`}</Body>
        {` com `}
        <Body style={styles.instructionStrong}>{`${formatWeight(weightKg)} kg`}</Body>
      </Body>

      {previous !== undefined ? <Previous previous={previous} onCopy={onCopyPrevious} /> : null}

      <View style={styles.adjust}>
        <NumberLine
          label="Peso"
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
        <NumberLine
          label="Reps"
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

      {/* O lugar de tocar. Accent so na serie da vez do exercicio da vez: e o
          unico "toque aqui" da tela. */}
      <Button
        variant={accent ? 'primary' : 'inline'}
        label={`Pronto, fiz a série ${index}`}
        icon={<CheckIcon size={20} color={accent ? colors.textOnAccent : colors.textPrimary} />}
        onPress={onToggle}
      />
    </View>
  );
}

/** "Peso  [−]  62,5 kg  [+]": o numero no meio e tocavel para digitar. */
function NumberLine({
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
    <View style={styles.line}>
      <Body style={styles.lineLabel}>{label}</Body>
      <StepButton repeat={down} accessibilityLabel={`Diminuir ${name}`}>
        <MinusIcon size={20} color={colors.textPrimary} />
      </StepButton>
      <Pressable
        onPress={draft.start}
        disabled={draft.draft !== null}
        accessibilityLabel={`${label}, ${format(value)} ${unit}. Tocar para digitar`}
        style={styles.valueBox}
      >
        {draft.draft === null ? (
          <Mono style={styles.value} maxFontSizeMultiplier={FONT_SCALE_CAP.readout}>
            {format(value)}
          </Mono>
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
            maxFontSizeMultiplier={FONT_SCALE_CAP.readout}
            style={[styles.value, styles.input]}
          />
        )}
        {unit ? <Label style={styles.unit}>{unit}</Label> : null}
      </Pressable>
      <StepButton repeat={up} accessibilityLabel={`Aumentar ${name}`}>
        <PlusIcon size={20} color={colors.textPrimary} />
      </StepButton>
    </View>
  );
}

type Repeat = ReturnType<typeof useRepeatPress>;

const STEP_SLOP = (layout.touch - STEP_BUTTON_SIZE) / 2;

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
      feedback="control"
      borderRadius={radius.pill}
      hitSlop={STEP_SLOP}
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

/** A ultima vez naquela MESMA serie. Tocar copia os valores para hoje. */
function Previous({
  previous,
  onCopy,
}: {
  previous: { reps: number; weightKg: number } | null;
  onCopy?: () => void;
}) {
  return (
    <Pressable
      disabled={!previous || !onCopy}
      onPress={onCopy}
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
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: layout.touch + layout.touchGap,
    gap: spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.divider,
  },
  rowText: {
    flex: 1,
  },
  /** Serie que ainda vem: previsao, nao registro — um degrau abaixo. */
  pending: {
    color: colors.textAux,
  },
  doneTag: {
    color: colors.textPrimary,
  },
  hero: {
    backgroundColor: surfaces.control,
    borderRadius: radius.inner,
    borderWidth: 1.5,
    borderColor: colors.borderStrong,
    padding: spacing.lg,
    marginVertical: spacing.sm,
    gap: spacing.md,
  },
  heroAccent: {
    borderColor: colors.textPrimary,
  },
  now: {
    color: colors.textPrimary,
  },
  /** A instrucao: grande, em frase, com os numeros em destaque. */
  instruction: {
    fontSize: 22,
    lineHeight: 30,
    color: colors.textAux,
  },
  instructionStrong: {
    fontSize: 22,
    lineHeight: 30,
    fontFamily: fonts.sansMedium,
    color: colors.textPrimary,
  },
  adjust: {
    gap: spacing.sm,
    paddingTop: spacing.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.divider,
  },
  line: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    minHeight: layout.touch,
  },
  lineLabel: {
    width: 56,
  },
  valueBox: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'center',
    minHeight: layout.touch,
    paddingTop: spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.borderStrong,
  },
  value: {
    fontFamily: fonts.mono,
    fontSize: fontSize.numberLine + 4,
    color: colors.textPrimary,
  },
  input: {
    padding: 0,
    minWidth: 56,
    textAlign: 'center',
  },
  unit: {
    marginLeft: spacing.xs,
  },
  previous: {
    paddingVertical: spacing.xs,
  },
  stepButton: {
    width: STEP_BUTTON_SIZE,
    height: STEP_BUTTON_SIZE,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: surfaces.raised,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
  },
});
