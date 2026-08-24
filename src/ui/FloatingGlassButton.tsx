import { Pressable, StyleSheet } from 'react-native';

import { spacing } from '@/theme/tokens';

import { GlassSurface } from './GlassSurface';
import { Body } from './Text';

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
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.floating, { bottom }, pressed && styles.pressed]}
    >
      <GlassSurface style={styles.floatingSurface}>
        <Body>{label}</Body>
      </GlassSurface>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  floating: {
    position: 'absolute',
    left: spacing.xl,
    right: spacing.xl,
  },
  floatingSurface: {
    height: 54,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pressed: {
    opacity: 0.8,
  },
});
