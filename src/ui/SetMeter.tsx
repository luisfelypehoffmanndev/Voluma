import { StyleSheet, View } from 'react-native';

import { colors } from '@/theme/tokens';

/**
 * As series do dia como um medidor: um traco por serie, aceso quando feita.
 *
 * E o VU de um painel, nao uma barra de progresso. A barra continua diria
 * "37%", que ninguem conta; os tracos dizem "faltam estas", e o olho conta
 * sozinho quantas sao. Substituiu o anel com o total no meio, que mostrava "16"
 * sem dizer dezesseis o que — e nao mudava de cara ao longo do treino.
 *
 * Aceso/apagado na mesma matiz (§7): branco e o feito, o cinza do ponto vazio
 * do dot-matrix e o que falta. Sem accent — nesta tela ele e do botao central.
 *
 * Os tracos esticam para preencher a largura (`flex: 1`) ate um teto, para que
 * cinco series nao virem cinco blocos gordos nem trinta virem fio.
 */
export function SetMeter({ done, total }: { done: number; total: number }) {
  if (total <= 0) return null;
  return (
    <View
      style={styles.row}
      accessible
      accessibilityRole="progressbar"
      accessibilityLabel={`${done} de ${total} séries`}
      accessibilityValue={{ min: 0, max: total, now: done }}
    >
      {Array.from({ length: total }, (_, index) => (
        <View key={index} style={[styles.tick, index < done ? styles.done : styles.pending]} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    gap: 3,
  },
  tick: {
    flex: 1,
    maxWidth: 22,
    height: 14,
    borderRadius: 2,
  },
  done: {
    backgroundColor: colors.textPrimary,
  },
  pending: {
    backgroundColor: colors.dotEmpty,
  },
});
