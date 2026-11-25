import { Pressable, StyleSheet, TextInput, View } from 'react-native';

import { colors, fontSize, fonts, layout, radius, surfaces } from '@/theme/tokens';
import { MinusIcon, PlusIcon } from './icons';
import { PressableSurface } from './PressableSurface';
import { FONT_SCALE_CAP, Label, Mono } from './Text';
import { useNumberDraft, useRepeatPress } from './useNumberInput';

/**
 * Lado do botao de + e -.
 *
 * Era 32, com hitSlop de 12 compensando — o alvo existia, mas o OLHO mirava um
 * circulo de 32 e o polegar suado errava para o vizinho. 44 e o piso do iOS
 * visivel; o `hitSlop` leva o alvo ate os 48 de `layout.touch`.
 */
export const STEP_BUTTON_SIZE = 44;
const BUTTON_SIZE = STEP_BUTTON_SIZE;
const BUTTON_SLOP = (layout.touch - BUTTON_SIZE) / 2;

/** Largura minima da caixa do numero: cabe "137,5" sem o campo pular de tamanho. */
const VALUE_WIDTH = 74;

/**
 * O que a coluna de controles ocupa numa linha `layout="row"`.
 *
 * Exportado porque quem desenha ao lado de um stepper precisa saber quanto sobra
 * — hoje a figura do movimento em `TargetsEditor`. Derivado das constantes
 * abaixo em vez de escrito a mao nos dois lugares: mudar o botao de tamanho tem
 * que mover a figura junto, nao deixar ela por cima.
 */
export const CONTROLS_WIDTH = BUTTON_SIZE * 2 + VALUE_WIDTH;

type Props = {
  label: string;
  value: number;
  step?: number;
  min?: number;
  max?: number;
  /** Sufixo grudado no numero: "kg", "reps". */
  suffix?: string;
  format?: (value: number) => string;
  /**
   * `stacked` (padrao): label em cima, controles embaixo — para quando cabem
   * dois lado a lado. `row`: label a esquerda, controles a direita, ocupando a
   * largura toda — a unica forma que cabe em tela estreita quando sao tres.
   */
  layout?: 'stacked' | 'row';
  /**
   * Deixa o numero tocavel para digitar direto, para quando digitar e mais
   * rapido que contar toques — um numero especifico em mente, ou um salto
   * grande (carga).
   */
  editable?: boolean;
  /**
   * O valor so faz sentido inteiro (series, reps, idade, anos). Troca o
   * teclado decimal pelo numerico e trunca o que for digitado, em vez de
   * arredondar em duas casas como um peso ou uma distancia.
   */
  integer?: boolean;
  /**
   * Largura do rotulo, medida, so no layout `row`.
   *
   * Existe porque quem desenha no vao de uma linha precisa saber onde a coluna
   * dos rotulos termina, e `space-between` nao cria coluna nenhuma para
   * consultar. Medir e o que evita chutar um numero que muda com o rotulo mais
   * longo de cada modalidade e com a fonte do sistema.
   */
  onLabelWidth?: (width: number) => void;
  /**
   * `source` diz de onde veio a mudanca: `'step'` e um toque no + ou no -,
   * `'type'` e um numero digitado. So importa para quem, como o perfil, precisa
   * tratar os dois de um jeito diferente (ver `land()` em `ProfileForm.tsx`) —
   * a maioria dos usos ignora o segundo argumento.
   */
  onChange: (value: number, source: 'step' | 'type') => void;
};

/**
 * Ajuste de reps/peso por toque, sem teclado — com a opcao de digitar.
 *
 * Teclado no meio do treino e o pior caso do app: cobre metade da tela, exige
 * precisao com a mao suada e derruba o foco. Botoes grandes com hitSlop
 * resolvem a maioria dos ajustes reais, que sao de um passo por vez.
 *
 * Mas tem quem chega com um numero em mente — 45 anos, 8 series — e digitar
 * e mais rapido que contar toques, principalmente comecando de longe. Para
 * esses, `editable` abre o teclado ao tocar no proprio numero, sem tirar os
 * botoes de quem so quer ajustar um passo. `integer` troca o teclado decimal
 * pelo numerico e faz o que for digitado virar numero inteiro — sem casa
 * decimal, nunca faz sentido em series, reps, idade ou anos de treino.
 */
export function Stepper({
  label,
  value,
  step = 1,
  min = 0,
  max = Number.MAX_SAFE_INTEGER,
  suffix,
  format = String,
  layout = 'stacked',
  editable = false,
  integer = false,
  onLabelWidth,
  onChange,
}: Props) {
  const clamp = (next: number) => Math.min(max, Math.max(min, next));
  // Inteiro trunca ("digitado 3,7 vira 3"); o resto evita 62.50000000000001 ao
  // somar 2.5 repetidas vezes, arredondando em duas casas.
  const round = (next: number) => (integer ? Math.trunc(next) : Math.round(next * 100) / 100);

  const { draft, start: startEditing, change, commit: commitDraft } = useNumberDraft({
    value,
    format,
    integer,
    clamp,
    onCommit: (next) => onChange(next, 'type'),
  });

  const minus = useRepeatPress(
    value,
    (current) => clamp(round(current - step)),
    (next) => onChange(next, 'step'),
  );
  const plus = useRepeatPress(
    value,
    (current) => clamp(round(current + step)),
    (next) => onChange(next, 'step'),
  );

  const controls = (
    <View style={styles.row}>
      <PressableSurface
        accessibilityLabel={`Diminuir ${label.toLowerCase()}`}
        hitSlop={BUTTON_SLOP}
        onPress={minus.onPress}
        onPressIn={minus.onPressIn}
        onPressOut={minus.onPressOut}
        feedback="control"
        borderRadius={radius.pill}
        style={styles.button}
      >
        <MinusIcon size={18} color={colors.textPrimary} />
      </PressableSurface>

      <Pressable
        accessibilityLabel={editable ? `Digitar ${label.toLowerCase()}` : undefined}
        onPress={editable ? startEditing : undefined}
        disabled={!editable || draft !== null}
        style={[styles.valueBox, editable && styles.valueBoxEditable]}
      >
        {draft === null ? (
          <Mono style={styles.value}>{format(value)}</Mono>
        ) : (
          <TextInput
            accessibilityLabel={label}
            value={draft}
            onChangeText={change}
            onBlur={commitDraft}
            onSubmitEditing={commitDraft}
            keyboardType={integer ? 'number-pad' : 'decimal-pad'}
            returnKeyType="done"
            selectTextOnFocus
            autoFocus
            maxFontSizeMultiplier={FONT_SCALE_CAP.mono}
            style={[styles.value, styles.input]}
          />
        )}
        {suffix ? <Label style={styles.suffix}>{suffix}</Label> : null}
      </Pressable>

      <PressableSurface
        accessibilityLabel={`Aumentar ${label.toLowerCase()}`}
        hitSlop={BUTTON_SLOP}
        onPress={plus.onPress}
        onPressIn={plus.onPressIn}
        onPressOut={plus.onPressOut}
        feedback="control"
        borderRadius={radius.pill}
        style={styles.button}
      >
        <PlusIcon size={18} color={colors.textPrimary} />
      </PressableSurface>
    </View>
  );

  if (layout === 'row') {
    return (
      <View style={styles.rowContainer}>
        <Label onLayout={(event) => onLabelWidth?.(event.nativeEvent.layout.width)}>{label}</Label>
        {controls}
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Label style={styles.label}>{label}</Label>
      {controls}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
  },
  rowContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    // Sem isto as linhas colam uma na outra e errar o + de cima e acertar o -
    // de baixo vira rotina. 48 de alvo + o respiro de `layout.touchGap`.
    minHeight: layout.touch + layout.touchGap,
  },
  label: {
    marginBottom: 6,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  /**
   * Nivel 2 preenchido, nao so contorno: o contorno fino de antes desenhava um
   * circulo que o olho lia menor do que era. Preenchido, a area que se toca e a
   * area que se ve.
   */
  button: {
    width: BUTTON_SIZE,
    height: BUTTON_SIZE,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: surfaces.control,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
  },
  valueBox: {
    minWidth: VALUE_WIDTH,
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'center',
  },
  valueBoxEditable: {
    // Afordancia minima: sem isto nada diz que o numero aceita toque.
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
    paddingBottom: 2,
  },
  input: {
    // O TextInput do Android vem com padding proprio; sem zerar, o numero pula
    // alguns px ao entrar em edicao.
    padding: 0,
    minWidth: 48,
    textAlign: 'center',
  },
  value: {
    fontFamily: fonts.monoLight,
    fontSize: fontSize.numberLine,
    color: colors.textPrimary,
  },
  suffix: {
    marginLeft: 3,
  },
});
