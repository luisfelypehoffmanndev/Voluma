import { StyleSheet } from 'react-native';

import { radius, spacing } from '@/theme/tokens';

import { GlassSurface } from './GlassSurface';
import { PressableSurface } from './PressableSurface';
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
    // O raio acompanha o do GlassSurface: sem ele a camada de toque seria um
    // retangulo com quinas para fora do pill.
    <PressableSurface
      onPress={onPress}
      pressedOpacity={0.8}
      borderRadius={radius.pill}
      style={[styles.floating, { bottom }]}
    >
      <GlassSurface style={styles.floatingSurface}>
        <Body>{label}</Body>
      </GlassSurface>
    </PressableSurface>
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
});
