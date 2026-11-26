import { Pressable, StyleSheet } from 'react-native';

import { layout, radius, spacing, theme } from '@/theme/tokens';

import { Label } from './Text';

/**
 * Um filtro de toque unico: contorno fino apagado, e fundo elevado quando
 * selecionado. Sem accent: numa fileira de opcoes equivalentes, a cor diria que
 * uma delas importa mais que as outras.
 */
export function Chip({
  label,
  selected,
  onPress,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected }}
      // A pilula e baixa para caber em fileira; o alvo sobe ate `layout.touch`.
      hitSlop={{ top: (layout.touch - CHIP_HEIGHT) / 2, bottom: (layout.touch - CHIP_HEIGHT) / 2 }}
      style={[styles.chip, selected && styles.chipSelected]}
    >
      <Label style={selected ? styles.labelSelected : undefined}>{label}</Label>
    </Pressable>
  );
}

/** Altura visivel do chip — a mesma do segmento do `Segmented`. */
const CHIP_HEIGHT = 36;

const styles = StyleSheet.create({
  chip: {
    height: CHIP_HEIGHT,
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
    borderRadius: radius.pill,
    backgroundColor: theme.surfaceContainerHigh,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: theme.surfaceContainerHigh,
  },
  chipSelected: {
    backgroundColor: theme.primaryContainer,
    borderColor: theme.primaryContainer,
  },
  labelSelected: {
    color: theme.onPrimary,
  },
});
