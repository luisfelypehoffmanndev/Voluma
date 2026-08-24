import type { ReactNode } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { colors, hitSlop, radius, spacing } from '@/theme/tokens';
import { Ambient } from './Ambient';
import { Title } from './Text';

/**
 * Base de toda tela. O `Ambient` fica atras de tudo: e o que da luminancia para
 * as superficies de vidro capturarem — sem ele o blur nao tem o que borrar.
 */
export function Screen({ children }: { children: ReactNode }) {
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.screen, { paddingTop: insets.top }]}>
      <Ambient />
      {children}
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
    backgroundColor: colors.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
  },
  pressed: {
    opacity: 0.6,
  },
});
