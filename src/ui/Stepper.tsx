import { useRef, useState } from 'react';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';

import { colors, fontSize, fonts, hitSlop, radius } from '@/theme/tokens';
import { MinusIcon, PlusIcon } from './icons';
import { PressableSurface } from './PressableSurface';
import { Label, Mono } from './Text';

/** Lado do botao redondo de + e -, tambem o alvo de toque minimo confortavel. */
const BUTTON_SIZE = 32;

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
   * Deixa o numero tocavel para digitar direto. Opt-in: so faz sentido onde o
   * salto pode ser grande (carga), nunca em reps, onde o passo unico ja resolve.
   */
  editable?: boolean;
  /**
   * Largura do rotulo, medida, so no layout `row`.
   *
   * Existe porque quem desenha no vao de uma linha precisa saber onde a coluna
   * dos rotulos termina, e `space-between` nao cria coluna nenhuma para
   * consultar. Medir e o que evita chutar um numero que muda com o rotulo mais
   * longo de cada modalidade e com a fonte do sistema.
   */
  onLabelWidth?: (width: number) => void;
  onChange: (value: number) => void;
};

/**
 * Ajuste de reps/peso por toque, sem teclado.
 *
 * Teclado no meio do treino e o pior caso do app: cobre metade da tela, exige
 * precisao com a mao suada e derruba o foco. Botoes grandes com hitSlop
 * resolvem 95% dos ajustes reais, que sao de um passo por vez.
 *
 * Os outros 5% sao o primeiro valor de uma carga: sair de 0 para 100kg de 2,5
 * em 2,5 sao 40 toques. Para esses, `editable` abre o teclado numerico ao tocar
 * no proprio numero — sem tirar os botoes de quem so quer ajustar um passo.
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
  onLabelWidth,
  onChange,
}: Props) {
  const clamp = (next: number) => Math.min(max, Math.max(min, next));
  // Evita 62.50000000000001 ao somar 2.5 repetidas vezes.
  const round = (next: number) => Math.round(next * 100) / 100;

  // `null` = nao esta editando. O ref anda junto porque `onSubmitEditing` e
  // `onBlur` disparam os dois no mesmo toque do "done": sem ele o segundo ainda
  // enxergaria o rascunho do estado antigo e gravaria duas vezes.
  const [draft, setDraft] = useState<string | null>(null);
  const draftRef = useRef<string | null>(null);
  const setBoth = (next: string | null) => {
    draftRef.current = next;
    setDraft(next);
  };

  const startEditing = () => setBoth(String(value).replace('.', ','));

  const commitDraft = () => {
    const current = draftRef.current;
    if (current === null) return;
    setBoth(null);
    // Virgula porque e o que o teclado pt-BR entrega e o que `formatWeight` mostra.
    const parsed = Number(current.trim().replace(',', '.'));
    // Campo vazio ou lixo digitado: mantem o valor que ja estava, nao zera.
    if (current.trim() === '' || !Number.isFinite(parsed)) return;
    onChange(clamp(round(parsed)));
  };

  const controls = (
    <View style={styles.row}>
      <PressableSurface
        hitSlop={hitSlop}
        onPress={() => onChange(clamp(round(value - step)))}
        pressedOpacity={0.5}
        borderRadius={radius.pill}
        style={styles.button}
      >
        <MinusIcon size={16} color={colors.textSecondary} />
      </PressableSurface>

      <Pressable
        onPress={editable ? startEditing : undefined}
        disabled={!editable || draft !== null}
        style={[styles.valueBox, editable && styles.valueBoxEditable]}
      >
        {draft === null ? (
          <Mono style={styles.value}>{format(value)}</Mono>
        ) : (
          <TextInput
            value={draft}
            onChangeText={setBoth}
            onBlur={commitDraft}
            onSubmitEditing={commitDraft}
            keyboardType="decimal-pad"
            returnKeyType="done"
            selectTextOnFocus
            autoFocus
            style={[styles.value, styles.input]}
          />
        )}
        {suffix ? <Label style={styles.suffix}>{suffix}</Label> : null}
      </Pressable>

      <PressableSurface
        hitSlop={hitSlop}
        onPress={() => onChange(clamp(round(value + step)))}
        pressedOpacity={0.5}
        borderRadius={radius.pill}
        style={styles.button}
      >
        <PlusIcon size={16} color={colors.textSecondary} />
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
    // 44 e o alvo de toque minimo; sem isto as linhas colam uma na outra e
    // errar o + de cima e acertar o - de baixo vira rotina.
    minHeight: 44,
  },
  label: {
    marginBottom: 6,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  button: {
    width: BUTTON_SIZE,
    height: BUTTON_SIZE,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
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
    fontSize: fontSize.numberSm,
    color: colors.textPrimary,
  },
  suffix: {
    marginLeft: 3,
  },
});
