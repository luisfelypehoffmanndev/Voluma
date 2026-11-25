import { Pressable, StyleSheet, TextInput, View } from 'react-native';

import { formatWeight } from '@/domain/volume';
import { colors, fontSize, fonts, layout, radius, spacing, surfaces } from '@/theme/tokens';

import { CheckCell } from './CheckCell';
import { MinusIcon, PlusIcon } from './icons';
import { PressableSurface } from './PressableSurface';
import { STEP_BUTTON_SIZE } from './Stepper';
import { FONT_SCALE_CAP, Label, Meta, Mono } from './Text';
import { useNumberDraft, useRepeatPress } from './useNumberInput';

/** O passo de carga por toque. Segurar repete e acelera (`useRepeatPress`). */
const WEIGHT_STEP = 2.5;
const REPS_MAX = 100;
const WEIGHT_MAX = 999;

type Props = {
  /** 1-based, so para exibir — a posicao no array, nao o `setIndex` guardado. */
  index: number;
  /** Quantas series o exercicio tem, para o "SÉRIE 3 DE 4" do bloco da vez. */
  total: number;
  reps: number;
  weightKg: number;
  done: boolean;
  /**
   * `hero`: a serie da vez — numero grande, controles, e a unica que se edita.
   * `row`: uma linha de tabela, para as feitas e as que ainda vem.
   */
  mode: 'row' | 'hero';
  /**
   * A serie da vez do EXERCICIO da vez: o contorno laranja, o unico accent da
   * tela de treino (design.md §2). Um card aberto fora de ordem tambem mostra a
   * propria serie da vez como bloco, mas sem cor — o laranja diz "e aqui",
   * e so pode dizer isso de um lugar.
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
 * **A serie da vez e o heroi da tela.** O numero grande da sessao era o volume
 * do dia, que muda a cada toque e nao responde nada que a pessoa pergunte entre
 * series. A pergunta e "o que eu faco agora?", e a resposta e a carga desta
 * serie — em mono de 56px, legivel com o celular apoiado no banco a um braco
 * de distancia. As reps vem ao lado, um degrau abaixo.
 *
 * As outras series sao linhas de tabela, sem caixa propria: antes cada serie
 * era um card dentro do card, e quatro series enchiam a tela. Agora a tabela e
 * densa e so a da vez ocupa espaco.
 *
 * O numero grande nao aparece duas vezes. Antes a serie da vez mostrava
 * "8 × 62,5" na linha e de novo dentro de cada stepper; agora o numero grande
 * E o campo: tocar nele abre o teclado numerico (60 → 80 em duas interacoes), e
 * os botoes embaixo so tem − e +.
 */
export function SetRow(props: Props) {
  return props.mode === 'hero' ? <HeroSet {...props} /> : <TableSet {...props} />;
}

function TableSet({ index, reps, weightKg, done, previous, onToggle, onCopyPrevious }: Props) {
  return (
    <View style={styles.row}>
      {/* Coluna de largura fixa: cresce pouco, para "SÉRIE 12" nao quebrar
          em duas linhas e desalinhar a tabela. */}
      <Label
        maxFontSizeMultiplier={FONT_SCALE_CAP.readout}
        style={[styles.index, done && styles.indexDone]}
      >{`SÉRIE ${index}`}</Label>

      <View style={styles.rowValues}>
        <Mono style={[styles.rowValue, !done && styles.pending]}>
          {`${reps} × ${formatWeight(weightKg)}`}
        </Mono>
        <Label style={styles.unit}>kg</Label>
        {previous !== undefined ? <Previous previous={previous} onCopy={onCopyPrevious} /> : null}
      </View>

      <CheckCell
        checked={done}
        onPress={onToggle}
        accessibilityLabel={`Série ${index}, ${reps} por ${formatWeight(weightKg)} quilos`}
      />
    </View>
  );
}

function HeroSet({
  index,
  total,
  reps,
  weightKg,
  done,
  accent = false,
  previous,
  onToggle,
  onChangeReps,
  onChangeWeight,
  onCopyPrevious,
}: Props) {
  const weight = useNumberDraft({
    value: weightKg,
    format: formatWeight,
    integer: false,
    clamp: (value) => Math.min(WEIGHT_MAX, Math.max(0, value)),
    onCommit: onChangeWeight,
  });
  const repsDraft = useNumberDraft({
    value: reps,
    format: String,
    integer: true,
    clamp: (value) => Math.min(REPS_MAX, Math.max(1, value)),
    onCommit: onChangeReps,
  });

  const round = (value: number) => Math.round(value * 100) / 100;
  const weightMinus = useRepeatPress(
    weightKg,
    (v) => Math.max(0, round(v - WEIGHT_STEP)),
    onChangeWeight,
  );
  const weightPlus = useRepeatPress(
    weightKg,
    (v) => Math.min(WEIGHT_MAX, round(v + WEIGHT_STEP)),
    onChangeWeight,
  );
  const repsMinus = useRepeatPress(reps, (v) => Math.max(1, v - 1), onChangeReps);
  const repsPlus = useRepeatPress(reps, (v) => Math.min(REPS_MAX, v + 1), onChangeReps);

  return (
    <View style={[styles.hero, accent && styles.heroAccent]}>
      <View style={styles.heroHead}>
        <Label style={styles.heroLabel}>{`SÉRIE ${index} DE ${total}`}</Label>
        <CheckCell
          checked={done}
          onPress={onToggle}
          accessibilityLabel={`Concluir série ${index}, ${reps} por ${formatWeight(weightKg)} quilos`}
        />
      </View>

      {/* O numero e o campo. `adjustsFontSizeToFit` porque "102,5" a 56px
          passa da largura de um telefone estreito ao lado das reps. */}
      <View style={styles.heroNumbers}>
        <Pressable
          onPress={weight.start}
          disabled={weight.draft !== null}
          accessibilityLabel={`Carga, ${formatWeight(weightKg)} quilos. Tocar para digitar`}
          style={styles.heroWeight}
        >
          <View style={styles.field}>
            {weight.draft === null ? (
              <Mono
                style={styles.heroValue}
                numberOfLines={1}
                adjustsFontSizeToFit
                maxFontSizeMultiplier={1}
              >
                {formatWeight(weightKg)}
              </Mono>
            ) : (
              <TextInput
                value={weight.draft}
                onChangeText={weight.change}
                onBlur={weight.commit}
                onSubmitEditing={weight.commit}
                keyboardType="decimal-pad"
                returnKeyType="done"
                selectTextOnFocus
                autoFocus
                maxFontSizeMultiplier={1}
                style={[styles.heroValue, styles.input]}
              />
            )}
          </View>
          <Label style={styles.heroUnit}>kg</Label>
        </Pressable>

        <Pressable
          onPress={repsDraft.start}
          disabled={repsDraft.draft !== null}
          accessibilityLabel={`${reps} repetições. Tocar para digitar`}
          style={styles.heroReps}
        >
          <Mono style={styles.times} maxFontSizeMultiplier={1}>
            ×
          </Mono>
          <View style={styles.field}>
            {repsDraft.draft === null ? (
              <Mono style={styles.repsValue} maxFontSizeMultiplier={1}>
                {String(reps)}
              </Mono>
            ) : (
              <TextInput
                value={repsDraft.draft}
                onChangeText={repsDraft.change}
                onBlur={repsDraft.commit}
                onSubmitEditing={repsDraft.commit}
                keyboardType="number-pad"
                returnKeyType="done"
                selectTextOnFocus
                autoFocus
                maxFontSizeMultiplier={1}
                style={[styles.repsValue, styles.input]}
              />
            )}
          </View>
        </Pressable>
      </View>

      {previous !== undefined ? <Previous previous={previous} onCopy={onCopyPrevious} /> : null}

      <View style={styles.controls}>
        <StepGroup label="PESO" name="carga" minus={weightMinus} plus={weightPlus} />
        <StepGroup label="REPS" name="repetições" minus={repsMinus} plus={repsPlus} />
      </View>
    </View>
  );
}

type Repeat = ReturnType<typeof useRepeatPress>;

/** "PESO  [−] [+]": o rotulo e os dois botoes. O valor ja esta grande em cima. */
function StepGroup({
  label,
  name,
  minus,
  plus,
}: {
  label: string;
  name: string;
  minus: Repeat;
  plus: Repeat;
}) {
  return (
    <View style={styles.group}>
      <Label>{label}</Label>
      <View style={styles.buttons}>
        <StepButton repeat={minus} accessibilityLabel={`Diminuir ${name}`}>
          <MinusIcon size={18} color={colors.textPrimary} />
        </StepButton>
        <StepButton repeat={plus} accessibilityLabel={`Aumentar ${name}`}>
          <PlusIcon size={18} color={colors.textPrimary} />
        </StepButton>
      </View>
    </View>
  );
}

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
  /**
   * Linha de tabela: sem caixa, so o divisor em cima. 48 de altura, o alvo de
   * toque, para a caixa de marcar nunca ficar espremida entre duas linhas.
   */
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: layout.touch + layout.touchGap,
    gap: spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.divider,
  },
  index: {
    width: 64,
  },
  indexDone: {
    color: colors.textPrimary,
  },
  rowValues: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'baseline',
    flexWrap: 'wrap',
    columnGap: 3,
  },
  rowValue: {
    fontFamily: fonts.monoLight,
    fontSize: fontSize.numberLine,
  },
  /** Serie que ainda vem: o numero e previsao, nao registro — um degrau abaixo. */
  pending: {
    color: colors.textAux,
  },
  unit: {
    marginRight: spacing.md,
  },
  /**
   * O bloco da vez: nivel 2 dentro do card. A borda existe sempre (transparente
   * sem accent) para o conteudo nao andar 1px ao ganhar o contorno (§6).
   */
  hero: {
    backgroundColor: surfaces.control,
    borderRadius: radius.inner,
    borderWidth: 1.5,
    borderColor: colors.borderStrong,
    padding: spacing.lg,
    marginVertical: spacing.sm,
    gap: spacing.sm,
  },
  heroAccent: {
    borderColor: colors.accent,
  },
  heroHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  heroLabel: {
    color: colors.textPrimary,
  },
  heroNumbers: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: spacing.lg,
  },
  heroWeight: {
    flexShrink: 1,
    flexDirection: 'row',
    alignItems: 'baseline',
  },
  heroValue: {
    fontFamily: fonts.monoLight,
    fontSize: fontSize.numberHero,
    lineHeight: fontSize.numberHero * 1.08,
    color: colors.textPrimary,
  },
  /** Afordancia minima de campo: o sublinhado diz que o numero aceita toque. */
  field: {
    flexShrink: 1,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.borderStrong,
  },
  heroUnit: {
    marginLeft: spacing.xs,
  },
  heroReps: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: spacing.sm,
  },
  times: {
    fontFamily: fonts.monoLight,
    fontSize: fontSize.numberLine,
    color: colors.textAux,
  },
  repsValue: {
    fontFamily: fonts.monoLight,
    fontSize: fontSize.numberDisplay,
    color: colors.textPrimary,
  },
  input: {
    // O TextInput do Android vem com padding proprio; sem zerar, o numero pula
    // alguns px ao entrar em edicao.
    padding: 0,
    minWidth: 56,
  },
  previous: {
    paddingVertical: spacing.xs,
  },
  /** Quebra em duas linhas com fonte grande, em vez de empurrar o + para fora. */
  controls: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    marginTop: spacing.xs,
    gap: spacing.md,
  },
  group: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  buttons: {
    flexDirection: 'row',
    gap: layout.touchGap,
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
