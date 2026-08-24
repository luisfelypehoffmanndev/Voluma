import type { ReactNode } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { colors, hitSlop, radius, spacing, surfaces } from '@/theme/tokens';
import { Ambient } from './Ambient';
import { Title } from './Text';

/**
 * Base de toda tela. O `Ambient` fica atras de tudo: e o campo de luz que as
 * superficies de vidro amostram — sem ele todas leem como cinza morto.
 *
 * O conteudo mora num filho proprio porque a area segura e dele, nao do campo:
 * filho absoluto se posiciona a partir da borda de padding do pai, entao com o
 * `paddingTop` na raiz o campo comecaria abaixo da barra de status e deixaria
 * uma faixa preta no topo.
 */
export function Screen({ children }: { children: ReactNode }) {
  const insets = useSafeAreaInsets();
  return (
    <View style={styles.screen}>
      <Ambient />
      <View style={[styles.content, { paddingTop: insets.top }]}>{children}</View>
    </View>
  );
}

type HeaderProps = {
  title: string;
  /** Acao a direita: um unico botao redondo, como nos mockups. */
  action?: { icon: ReactNode; onPress: () => void };
  secondaryAction?: { icon: ReactNode; onPress: () => void };
};

/** Cabecalho de tela: titulo a esquerda, acoes redondas a direita. */
export function Header({ title, action, secondaryAction }: HeaderProps) {
  return (
    <View style={styles.header}>
      <Title>{title}</Title>
      <View style={styles.actions}>
        {secondaryAction ? <RoundButton {...secondaryAction} /> : null}
        {action ? <RoundButton {...action} /> : null}
      </View>
    </View>
  );
}

export function RoundButton({ icon, onPress }: { icon: ReactNode; onPress: () => void }) {
  return (
    <Pressable
      hitSlop={hitSlop}
      onPress={onPress}
      style={({ pressed }) => [styles.round, pressed && styles.pressed]}
    >
      {icon}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  content: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.md,
    paddingBottom: spacing.xl,
  },
  actions: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  round: {
    width: 38,
    height: 38,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: surfaces.control,
    borderWidth: StyleSheet.hairlineWidth,
    borderTopColor: surfaces.specularTop,
    borderLeftColor: surfaces.specularSide,
    borderRightColor: surfaces.specularSide,
    borderBottomColor: surfaces.specularBottom,
  },
  /** Acende, como os cards: opacidade sobre superficie translucida apagaria o icone junto. */
  pressed: {
    backgroundColor: surfaces.controlPressed,
  },
});
