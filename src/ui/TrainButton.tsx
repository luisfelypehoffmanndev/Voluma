import { StyleSheet, View } from 'react-native';

import { accentGlow, colors, radius } from '@/theme/tokens';

import { CheckIcon, PlayIcon } from './icons';
import { PressableSurface } from './PressableSurface';
import { useStartWorkout, useTodayStatus } from './useStartWorkout';

/** Lado do botao. Entre os 56 e 60 do pedido, e acima do alvo minimo de toque. */
export const TRAIN_BUTTON_SIZE = 56;

/**
 * "Treinar": o botao no centro da barra de abas.
 *
 * Nao e uma aba. Ele nao abre secao nenhuma: dispara o treino de hoje de onde
 * quer que a pessoa esteja, e e o mesmo caminho do botao da Hoje
 * (`useStartWorkout`).
 *
 * **E o accent das telas de aba** (design.md §2). As quatro abas existem em
 * volta dele, e nenhuma pode usar laranja em outro elemento — o botao da Hoje
 * virou vidro por isso.
 *
 * Sem texto: o estado do dia aparece no icone. Treino em andamento ganha um
 * ponto; dia finalizado troca o play pelo concluido. O numero ("2 de 5") fica
 * no botao da Hoje, que tem espaco para ele.
 *
 * Toque com o gesto "apaga" do §10 — superficie solida baixa a opacidade, nunca
 * muda de tamanho.
 */
export function TrainButton() {
  const start = useStartWorkout();
  const status = useTodayStatus();

  const label =
    status === 'completed'
      ? 'Treinar, treino de hoje concluído'
      : status === 'inProgress'
        ? 'Treinar, treino em andamento'
        : 'Treinar';

  return (
    <View style={styles.glow}>
      <PressableSurface
        onPress={() => void start()}
        feedback="solid"
        borderRadius={radius.pill}
        accessibilityRole="button"
        accessibilityLabel={label}
        style={styles.button}
      >
        {status === 'completed' ? (
          <CheckIcon size={26} color={colors.textOnAccent} strokeWidth={2} />
        ) : (
          // Um pouco para a direita: o triangulo tem o peso visual na base, e
          // centrado pela caixa ele parece puxado para a esquerda.
          <View style={styles.play}>
            <PlayIcon size={26} color={colors.textOnAccent} strokeWidth={1.8} />
          </View>
        )}
        {status === 'inProgress' ? <View style={styles.dot} /> : null}
      </PressableSurface>
    </View>
  );
}

const styles = StyleSheet.create({
  /** O mesmo glow do resto do accent: e o que faz o laranja ler como neon. */
  glow: {
    width: TRAIN_BUTTON_SIZE,
    height: TRAIN_BUTTON_SIZE,
    borderRadius: radius.pill,
    backgroundColor: colors.accent,
    shadowColor: colors.accent,
    shadowOpacity: accentGlow.opacity,
    shadowRadius: accentGlow.radius,
    shadowOffset: { width: 0, height: 0 },
    elevation: accentGlow.elevation,
  },
  button: {
    width: TRAIN_BUTTON_SIZE,
    height: TRAIN_BUTTON_SIZE,
    borderRadius: radius.pill,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  play: {
    marginLeft: 3,
  },
  /** "Em andamento": um ponto, como o de gravacao — sem texto, sem pulso. */
  dot: {
    position: 'absolute',
    top: 11,
    right: 11,
    width: 8,
    height: 8,
    borderRadius: radius.pill,
    backgroundColor: colors.textOnAccent,
  },
});
