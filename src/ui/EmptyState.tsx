import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { spacing } from '@/theme/tokens';

import { Button } from './Button';
import { Body, Meta } from './Text';

type Props = {
  title: string;
  message: string;
  /** O botao que resolve o vazio. Obrigatorio: vazio sem saida so constata. */
  action: { label: string; onPress: () => void };
  style?: StyleProp<ViewStyle>;
};

/**
 * Lista vazia que ensina: titulo, uma frase e o botao que resolve.
 *
 * Antes era uma linha cinza ("Nenhum exercicio neste dia. Descanso.") que
 * constatava o vazio e deixava o usuario procurar sozinho onde se adiciona.
 *
 * O botao e `inline` (nivel 2), sem cor: o accent de cada tela ja tem dono, e
 * um vazio nao e o momento mais importante dela. Nao e vidro porque um vazio
 * aparece no MEIO do conteudo e rola com ele — ver a nota de posicao em
 * `Button.tsx`.
 */
export function EmptyState({ title, message, action, style }: Props) {
  return (
    <View style={[styles.wrap, style]}>
      <Body style={styles.center}>{title}</Body>
      <Meta style={styles.center}>{message}</Meta>
      <Button
        variant="inline"
        label={action.label}
        onPress={action.onPress}
        style={styles.button}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    paddingVertical: spacing.xxl,
    gap: spacing.xs,
  },
  center: {
    textAlign: 'center',
  },
  button: {
    marginTop: spacing.lg,
  },
});
