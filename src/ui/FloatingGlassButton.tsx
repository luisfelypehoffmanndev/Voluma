import { StyleSheet, View } from 'react-native';

import { spacing } from '@/theme/tokens';

import { Button } from './Button';

type Props = {
  label: string;
  onPress: () => void;
  /** Distancia do rodape — normalmente a folga da tab bar. */
  bottom: number;
};

/**
 * Botao fixo no rodape. Flutua sobre a lista rolavel, entao e vidro — a regra
 * do brief. O accent fica reservado para acoes terminais (finalizar, registrar);
 * estas sao acoes de edicao e nao competem por atencao.
 *
 * Ele e nivel 3, como a tab bar: esconde o que passa por baixo. Os cards da
 * mesma tela tambem sao vidro, mas de nivel 1 — muda a densidade, nao a materia.
 */
export function FloatingGlassButton({ label, onPress, bottom }: Props) {
  // Linguagem Blink: a acao que flutua no rodape e o botao principal da tela.
  return (
    <View style={[styles.floating, { bottom }]}>
      <Button variant="primary" label={label} onPress={onPress} />
    </View>
  );
}

const styles = StyleSheet.create({
  floating: {
    position: 'absolute',
    left: spacing.xl,
    right: spacing.xl,
  },
});
