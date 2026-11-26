import type { ReactNode } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { theme } from '@/theme/tokens';

type Props = {
  children?: ReactNode;
  borderRadius?: number;
  /** Mantido por compatibilidade: a linguagem Blink nao tem aresta especular. */
  specular?: boolean;
  style?: StyleProp<ViewStyle>;
};

/**
 * A superficie que flutua (barra fixa, painel de sheet), agora OPACA.
 *
 * Na linguagem Blink (Design/design.md) nao existe vidro: nada translucido,
 * nada borrado. O nome continua para nao mexer nos chamadores; o que eles
 * recebem e um bloco `surfaceContainer` com borda de 1px.
 */
export function GlassSurface({ children, borderRadius, style }: Props) {
  return (
    <View style={[styles.surface, borderRadius !== undefined && { borderRadius }, style]}>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  surface: {
    backgroundColor: theme.surfaceContainer,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: theme.cardBorder,
    overflow: 'hidden',
  },
});
